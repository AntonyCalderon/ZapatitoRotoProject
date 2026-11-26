import pool from '../../config/database.js';
import { calcularCostoAdquisicion } from '../compras/calculoCostoAdquisicion.js';

const catalogoActivo = 'p.activo AND m.activo AND co.activo AND t.activo';
const desdeCatalogo = `
  FROM producto_sku p
  JOIN modelo m ON m.id_modelo = p.id_modelo
  JOIN color co ON co.id_color = p.id_color
  JOIN talla t ON t.id_talla = p.id_talla
  LEFT JOIN stock_sku s ON s.id_sku = p.id_sku
  LEFT JOIN LATERAL (
    SELECT SUM(d.cantidad) AS cantidad
    FROM detalle_orden_venta d
    JOIN orden_venta v ON v.id_orden_venta = d.id_orden_venta
    WHERE d.id_sku = p.id_sku AND v.estado IN ('Pendiente', 'En Almacén')
  ) reservado ON true`;
// Las ventas Pendiente y En Almacén (HU15 RN-08) comprometen pares hasta la salida física; los borradores no reservan.
const stockDisponible = 'GREATEST(COALESCE(s.cantidad_actual, 0) - COALESCE(reservado.cantidad, 0), 0)::integer';
const columnasProducto = `p.id_sku, p.codigo_sku, m.id_modelo, m.nombre_modelo AS modelo,
  co.id_color, co.nombre_color AS color, t.id_talla, t.numero_talla::text AS talla,
  ${stockDisponible} AS disponible`;

const errorVenta = (status, mensaje) => Object.assign(new Error(mensaje), { status, publico: true });

export async function listarProductosParaPrecios(conexion = pool) {
  const { rows } = await conexion.query(`
    SELECT ${columnasProducto}
    ${desdeCatalogo}
    WHERE ${catalogoActivo}
    ORDER BY m.nombre_modelo, co.nombre_color, t.numero_talla, p.id_sku`);
  return rows;
}

export async function consultarDisponibilidadVenta(idSku, conexion = pool) {
  const { rows: [producto] } = await conexion.query(`
    SELECT ${columnasProducto}
    ${desdeCatalogo}
    WHERE p.id_sku = $1 AND ${catalogoActivo}`, [idSku]);
  return producto ?? null;
}

export async function listarBorradoresParaPrecios(idVendedor, conexion = pool) {
  const { rows } = await conexion.query(`
    SELECT v.id_orden_venta, v.fecha_creacion, c.razon_social_nombre AS cliente, tc.segmento
    FROM orden_venta v
    JOIN cliente c ON c.id_cliente = v.id_cliente
    JOIN tipo_cliente tc ON tc.id_tipo_cliente = COALESCE(v.id_tipo_cliente,c.id_tipo_cliente)
    WHERE v.id_usuario_vendedor = $1 AND v.estado = 'Borrador'
    ORDER BY v.fecha_creacion DESC, v.id_orden_venta DESC`, [idVendedor]);
  return rows;
}

async function verificarBorrador(conexion, idOrden, idVendedor, bloquear) {
  const { rows: [orden] } = await conexion.query(`
    SELECT estado FROM orden_venta
    WHERE id_orden_venta = $1 AND id_usuario_vendedor = $2
    ${bloquear ? 'FOR UPDATE' : ''}`, [idOrden, idVendedor]);
  if (!orden) throw errorVenta(404, 'No se encontró la venta.');
  if (orden.estado !== 'Borrador') throw errorVenta(409, 'Solo se pueden calcular precios para ventas en borrador.');
}

async function consultarConfiguracion(conexion, idOrden) {
  const { rows: [configuracion] } = await conexion.query(`
    SELECT v.id_orden_venta, c.razon_social_nombre AS cliente, tc.segmento,
           ps.valor::numeric(5,4)::text AS tasa, mu.porcentaje::text AS margen
    FROM orden_venta v
    JOIN cliente c ON c.id_cliente = v.id_cliente
    JOIN tipo_cliente tc ON tc.id_tipo_cliente = COALESCE(v.id_tipo_cliente,c.id_tipo_cliente)
    LEFT JOIN margen_utilidad mu ON mu.segmento = tc.segmento
    LEFT JOIN parametro_sistema ps ON ps.clave = 'IGV_TASA'
    WHERE v.id_orden_venta = $1`, [idOrden]);
  return configuracion;
}

async function calcularLineas(conexion, idOrden, { margen, tasa }) {
  const { rows } = await conexion.query(`
    WITH datos AS (
      SELECT ${columnasProducto}, d.id_detalle_venta, d.cantidad,
             (${catalogoActivo}) AS activo, cb.costo_vigente AS costo_unitario
      ${desdeCatalogo}
      JOIN detalle_orden_venta d ON d.id_sku = p.id_sku
      LEFT JOIN costo_base cb ON cb.id_modelo = p.id_modelo AND cb.id_talla = p.id_talla
      WHERE d.id_orden_venta = $1
    ), validadas AS (
      SELECT *, CASE
        WHEN NOT activo THEN 'El SKU ya no está disponible en el catálogo.'
        WHEN cantidad > disponible THEN 'Stock insuficiente. Disponible: ' || disponible || ' pares.'
        WHEN costo_unitario IS NULL THEN 'Falta registrar el costo base para este modelo y talla.'
        WHEN $2::numeric IS NULL THEN 'Falta configurar el margen para el segmento del cliente.'
        WHEN $3::numeric IS NULL THEN 'Falta configurar la tasa de IGV.'
      END AS motivo
      FROM datos
    ), precios AS (
      SELECT *, CASE WHEN motivo IS NULL
        THEN round(costo_unitario * (1 + $2::numeric / 100), 2)
      END AS precio_unitario
      FROM validadas
    )
    SELECT id_detalle_venta, id_sku, codigo_sku, modelo, color, talla, cantidad, motivo,
           costo_unitario::text, precio_unitario::text,
           (cantidad * precio_unitario)::text AS importe,
           round(precio_unitario * (1 + $3::numeric), 2)::text AS precio_con_igv
    FROM precios ORDER BY id_detalle_venta`, [idOrden, margen, tasa]);
  return rows;
}

async function guardarCalculo(conexion, idOrden, configuracion, lineas, totales) {
  if (lineas.length) {
    const calculo = lineas.map(linea => ({
      id_detalle_venta: linea.id_detalle_venta,
      costo_unitario: linea.motivo ? null : linea.costo_unitario,
      margen_porcentaje: linea.motivo ? null : configuracion.margen,
      precio_unitario: linea.precio_unitario,
      importe: linea.importe
    }));
    await conexion.query(`
      UPDATE detalle_orden_venta d SET
        costo_unitario = p.costo_unitario, margen_porcentaje = p.margen_porcentaje,
        precio_unitario = p.precio_unitario, importe = p.importe
      FROM jsonb_to_recordset($2) AS p (
        id_detalle_venta integer, costo_unitario numeric, margen_porcentaje numeric,
        precio_unitario numeric, importe numeric
      )
      WHERE d.id_orden_venta = $1 AND d.id_detalle_venta = p.id_detalle_venta`,
    [idOrden, JSON.stringify(calculo)]);
  }

  await conexion.query(`
    UPDATE orden_venta
    SET tasa_igv = $2, subtotal = $3, igv = $4, total = $5
    WHERE id_orden_venta = $1`,
  [idOrden, configuracion.tasa, totales.subtotal, totales.igv, totales.total]);
}

export async function resolverPreciosBorrador(idOrden, idVendedor, cambio, base = pool) {
  const conexion = await base.connect();
  try {
    // Orden y líneas se editan bajo el mismo bloqueo que debe tomar toda confirmación.
    await conexion.query(cambio ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await verificarBorrador(conexion, idOrden, idVendedor, Boolean(cambio));

    if (cambio?.tipo === 'agregar') {
      const insertada = await conexion.query(`
        INSERT INTO detalle_orden_venta (id_orden_venta, id_sku, cantidad)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_orden_venta, id_sku) DO NOTHING`, [idOrden, cambio.idSku, cambio.cantidad]);
      if (insertada.rowCount === 0) throw errorVenta(409, 'Ese SKU ya está en el borrador. Cada SKU admite una sola línea.');
    }

    if (cambio?.tipo === 'quitar') {
      const eliminada = await conexion.query(`
        DELETE FROM detalle_orden_venta WHERE id_orden_venta = $1 AND id_sku = $2`, [idOrden, cambio.idSku]);
      if (eliminada.rowCount === 0) throw errorVenta(404, 'El producto indicado no está en el borrador.');
    }

    const resultado = await recalcularPreciosVenta(conexion, idOrden, Boolean(cambio), cambio);
    await conexion.query('COMMIT');
    return resultado;
  } catch (error) {
    await conexion.query('ROLLBACK');
    if (error.code === '22003') throw errorVenta(409, 'El importe calculado supera el límite de la venta. Reduce la cantidad.');
    if (error.code === '23503' && cambio?.tipo === 'agregar') throw errorVenta(404, 'No se encontró el SKU indicado.');
    throw error;
  } finally {
    conexion.release();
  }
}

export async function recalcularPreciosVenta(conexion, idOrden, persistir = true, cambio) {
  const configuracion = await consultarConfiguracion(conexion, idOrden);
  const lineas = await calcularLineas(conexion, idOrden, configuracion);
  if (cambio?.tipo === 'agregar') {
    const nueva = lineas.find(linea => linea.id_sku === cambio.idSku);
    if (nueva.motivo) throw errorVenta(409, nueva.motivo);
  }

  // Se comparte el redondeo de soles e IGV de Compras para sumar importes exactos.
  const resumen = calcularCostoAdquisicion(lineas.map(linea => ({
    cantidad: linea.cantidad,
    costoUnitario: linea.precio_unitario
  })), configuracion.tasa ?? '0');
  const totales = configuracion.tasa === null || resumen.total === null
    ? { subtotal: null, igv: null, total: null }
    : { subtotal: resumen.subtotalConocido, igv: resumen.igv, total: resumen.total };

  if (persistir) await guardarCalculo(conexion, idOrden, configuracion, lineas, totales);
  return {
    id_orden_venta: configuracion.id_orden_venta,
    cliente: configuracion.cliente,
    segmento: configuracion.segmento,
    lineas: lineas.map(({ id_sku, codigo_sku, modelo, color, talla, cantidad, motivo, precio_con_igv, importe }) =>
      ({ id_sku, codigo_sku, modelo, color, talla, cantidad, motivo, precio_con_igv, importe })),
    ...totales
  };
}
