import pool from '../../config/database.js';
import { errorRecepcion } from './recepcion.domain.js';

const pendiente = `o.estado = 'EMITIDA' AND NOT EXISTS (
  SELECT 1 FROM recepcion_compra r WHERE r.id_orden_compra = o.id_orden_compra)`;

// Lectura compartida por Compras. Una cabecera sola no acredita entrada física:
// cada línea debe tener su movimiento exacto de recepción en Kardex.
export const resumenRecepcionSQL = `SELECT r.id_recepcion, r.id_usuario_almacen,
  u.nombre AS usuario_almacen, r.fecha_recepcion,
  EXISTS(SELECT 1 FROM detalle_orden_compra d WHERE d.id_orden_compra = r.id_orden_compra)
  AND NOT EXISTS(SELECT 1 FROM detalle_orden_compra d
    WHERE d.id_orden_compra = r.id_orden_compra AND NOT EXISTS(
      SELECT 1 FROM kardex_movimiento k WHERE k.id_recepcion = r.id_recepcion
      AND k.id_sku = d.id_sku AND k.tipo_movimiento = 'ENTRADA_COMPRA' AND k.cantidad = d.cantidad
    )) AS lote_verificado
  FROM recepcion_compra r JOIN usuario u ON u.id_usuario = r.id_usuario_almacen
  WHERE r.id_orden_compra = oc.id_orden_compra`;

export async function listarRecepcionesPendientes() {
  const { rows } = await pool.query(`SELECT o.id_orden_compra, o.codigo, p.razon_social AS proveedor,
    COALESCE(SUM(d.cantidad), 0)::int AS pares, 'EN_TRANSITO' AS situacion_logistica
    FROM orden_compra o JOIN proveedor p USING(id_proveedor)
    LEFT JOIN detalle_orden_compra d USING(id_orden_compra)
    WHERE ${pendiente} GROUP BY o.id_orden_compra,p.razon_social ORDER BY o.fecha_emision,o.id_orden_compra`);
  return rows;
}

export async function buscarRecepcionPendiente(id) {
  const { rows } = await pool.query(`SELECT o.id_orden_compra,o.codigo,p.razon_social AS proveedor,
    d.id_detalle_compra,s.id_sku,s.codigo_sku,m.nombre_modelo AS modelo,
    c.nombre_color AS color,t.numero_talla::text AS talla,d.cantidad
    FROM orden_compra o JOIN proveedor p USING(id_proveedor)
    LEFT JOIN detalle_orden_compra d USING(id_orden_compra)
    LEFT JOIN producto_sku s USING(id_sku) LEFT JOIN modelo m USING(id_modelo)
    LEFT JOIN color c USING(id_color) LEFT JOIN talla t USING(id_talla)
    WHERE o.id_orden_compra=$1 AND ${pendiente} ORDER BY d.id_sku`, [id]);
  if (!rows.length) return null;
  const { id_orden_compra, codigo, proveedor } = rows[0];
  const lineas = rows.filter(l => l.id_detalle_compra !== null).map(({ id_detalle_compra,id_sku,codigo_sku,modelo,color,talla,cantidad }) =>
    ({ id_detalle_compra,id_sku,codigo_sku,modelo,color,talla,cantidad }));
  return { id_orden_compra,codigo,proveedor,situacion_logistica:'EN_TRANSITO',lineas };
}

async function leerRecepcion(cliente, idOrden) {
  const { rows: [r] } = await cliente.query(`SELECT oc.codigo, r.*,
    (SELECT COALESCE(sum(k.cantidad),0)::int FROM kardex_movimiento k WHERE k.id_recepcion=r.id_recepcion) AS pares
    FROM orden_compra oc JOIN LATERAL (${resumenRecepcionSQL}) r ON true WHERE oc.id_orden_compra=$1`, [idOrden]);
  return r;
}

export async function registrarRecepcionCompleta(datos) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [orden] } = await c.query('SELECT estado FROM orden_compra WHERE id_orden_compra=$1 FOR UPDATE',[datos.id]);
    if (!orden) throw errorRecepcion(404,'La orden de compra no existe.');
    if (orden.estado !== 'EMITIDA') throw errorRecepcion(409,'Solo se puede recibir una compra emitida.');
    const { rows: [anterior] } = await c.query(`SELECT id_orden_compra,clave_idempotencia,huella_verificacion
      FROM recepcion_compra WHERE id_orden_compra=$1 OR clave_idempotencia=$2`,[datos.id,datos.clave]);
    if (anterior) {
      if (anterior.id_orden_compra !== datos.id || anterior.clave_idempotencia !== datos.clave || anterior.huella_verificacion !== datos.huella)
        throw errorRecepcion(409,'La compra ya tiene recepción o la clave corresponde a otra verificación.','RECEPCION_YA_REGISTRADA');
      const recepcion = await leerRecepcion(c,datos.id);
      await c.query('COMMIT');return { recepcion,repetida:true };
    }
    const { rows: lineas } = await c.query(`SELECT id_detalle_compra,id_sku,cantidad FROM detalle_orden_compra
      WHERE id_orden_compra=$1 ORDER BY id_sku FOR SHARE`,[datos.id]);
    if (!lineas.length || lineas.length !== datos.lineas.length || lineas.some(l =>
      !datos.lineas.some(v => v.id_detalle_compra === l.id_detalle_compra && v.cantidad_recibida === l.cantidad)))
      throw errorRecepcion(409,'La verificación no coincide con todas las líneas de la compra. Actualiza y verifica nuevamente.');
    const saldos = await c.query('SELECT id_sku FROM stock_sku WHERE id_sku=ANY($1::int[]) ORDER BY id_sku FOR UPDATE',[lineas.map(l => l.id_sku)]);
    if (saldos.rowCount !== lineas.length) throw errorRecepcion(409,'Falta preparar el stock de un SKU de la compra.');
    const { rows: [cabecera] } = await c.query(`INSERT INTO recepcion_compra
      (id_orden_compra,id_usuario_almacen,clave_idempotencia,huella_verificacion)
      VALUES($1,$2,$3,$4) RETURNING id_recepcion`,[datos.id,datos.usuario,datos.clave,datos.huella]);
    for (const l of lineas) await c.query(`INSERT INTO kardex_movimiento
      (id_sku,tipo_movimiento,cantidad,id_usuario,id_recepcion) VALUES($1,'ENTRADA_COMPRA',$2,$3,$4)`,
    [l.id_sku,l.cantidad,datos.usuario,cabecera.id_recepcion]);
    const recepcion = await leerRecepcion(c,datos.id);
    await c.query('COMMIT');return { recepcion,repetida:false };
  } catch (error) {
    await c.query('ROLLBACK');
    if (error.code === '23505') throw errorRecepcion(409,'La compra o esta confirmación ya fueron registradas.','RECEPCION_YA_REGISTRADA');
    throw error;
  } finally { c.release(); }
}
