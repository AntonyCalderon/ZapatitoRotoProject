import pool from '../config/database.js';
import { prepararRevision, validarOrigenes } from '../modules/ordenes-compra/emision.domain.js';

const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

async function revisar(db, id) {
  const { rows: [orden] } = await db.query(
    `SELECT estado, id_proveedor FROM orden_compra WHERE id_orden_compra=$1 FOR UPDATE`, [id]);
  if (!orden) throw fallo(404, 'La orden no existe.');
  if (orden.estado !== 'BORRADOR') throw fallo(409, 'Solo se puede emitir un borrador.');
  const { rows: [proveedor] } = await db.query(
    'SELECT id_proveedor, razon_social, ruc, direccion FROM proveedor WHERE id_proveedor=$1', [orden.id_proveedor]);
  const { rows: lineas } = await db.query(
    `SELECT d.id_sku, p.codigo_sku, m.nombre_modelo, c.nombre_color, t.numero_talla, d.cantidad,
       p.activo AND m.activo AND c.activo AND t.activo AS activo,
       d.costo_unitario AS anterior, b.costo_vigente AS costo
     FROM detalle_orden_compra d JOIN producto_sku p USING(id_sku)
     JOIN modelo m USING(id_modelo) JOIN color c USING(id_color) JOIN talla t USING(id_talla)
     LEFT JOIN costo_base b ON b.id_modelo=p.id_modelo AND b.id_talla=p.id_talla
     WHERE d.id_orden_compra=$1 ORDER BY d.id_sku`, [id]);
  const { rows: [parametro] } = await db.query("SELECT valor FROM parametro_sistema WHERE clave='LOTE_MINIMO_PARES'");
  return prepararRevision(proveedor ?? null, lineas, Number(parametro?.valor));
}

export async function procesarEmision(idOrden, idUsuario, confirmacion) {
  const id = Number(idOrden);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw fallo(400, 'Identificador inválido.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const revision = await revisar(db, id);
    if (!confirmacion) {
      await db.query('COMMIT');
      return revision;
    }
    if (revision.avisos.length) throw fallo(409, revision.avisos.join(' '));
    const origenes = validarOrigenes(confirmacion.origenes);
    if (revision.version !== confirmacion.version) throw fallo(409, 'Hubo cambios. Revisa otra vez el resumen antes de emitir.');
    const { rows: [serie] } = await db.query(
      `INSERT INTO correlativo_documento(tipo_documento, anio, ultimo_numero)
       VALUES ('OC', EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Lima'), 1)
       ON CONFLICT (tipo_documento, serie, anio) DO UPDATE
       SET ultimo_numero=correlativo_documento.ultimo_numero+1 RETURNING anio, ultimo_numero`);
    const codigo = `OC-${serie.anio}-${String(serie.ultimo_numero).padStart(3,'0')}`;
    for (const origen of origenes) {
      await db.query(`INSERT INTO origen_orden_compra (id_orden_compra,tipo,referencia)
        VALUES ($1,$2,$3)`, [id, origen.tipo, origen.referencia]);
    }
    for (const linea of revision.lineas) {
      await db.query(`UPDATE detalle_orden_compra SET costo_unitario=$3, importe=$4
        WHERE id_orden_compra=$1 AND id_sku=$2`, [id, linea.id_sku, linea.costo, linea.importe]);
    }
    await db.query(`UPDATE orden_compra SET estado='EMITIDA', codigo=$2, id_usuario_emisor=$3,
      fecha_emision=now(), subtotal=$6, total=$4, documento_emitido=$5
      WHERE id_orden_compra=$1`, [id, codigo, idUsuario, revision.total,
      JSON.stringify({ proveedor: revision.proveedor, lineas: revision.lineas, pares: revision.pares }),
      revision.subtotal]);
    await db.query('COMMIT');
    return { codigo };
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '40001') throw fallo(409, 'Otra operación cambió la compra. Vuelve a revisarla.');
    throw error;
  } finally { db.release(); }
}
