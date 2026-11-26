import pool from '../../config/database.js';

const PENDIENTE = 'Pendiente de Despacho';

const columnasDespacho = `
  d.id_orden_despacho, d.codigo, d.fecha_emision,
  c.razon_social_nombre AS cliente, c.direccion,
  cp.tipo AS tipo_comprobante, cp.serie AS serie_comprobante,
  cp.numero AS numero_comprobante`;

const origenDespacho = `
  FROM orden_despacho d
  JOIN orden_venta v ON v.id_orden_venta = d.id_orden_venta
  JOIN cliente c ON c.id_cliente = v.id_cliente
  LEFT JOIN comprobante_pago cp ON cp.id_orden_venta = v.id_orden_venta AND cp.estado = 'Emitido'`;

export async function listarPendientesDespacho() {
  const { rows } = await pool.query(`
    SELECT ${columnasDespacho}
    ${origenDespacho}
    WHERE d.estado = $1
    ORDER BY d.fecha_emision ASC, d.id_orden_despacho ASC`,
    [PENDIENTE]
  );
  return rows;
}

export async function buscarPendienteDespacho(idDespacho) {
  const { rows } = await pool.query(`
    SELECT ${columnasDespacho}, COALESCE(detalle.productos, '[]'::json) AS productos
    ${origenDespacho}
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'id_sku', p.id_sku,
        'modelo', m.nombre_modelo,
        'color', co.nombre_color,
        'talla', t.numero_talla::text,
        'cantidad', dv.cantidad
      ) ORDER BY dv.id_detalle_venta) AS productos
      FROM detalle_orden_venta dv
      JOIN producto_sku p ON p.id_sku = dv.id_sku
      JOIN modelo m ON m.id_modelo = p.id_modelo
      JOIN color co ON co.id_color = p.id_color
      JOIN talla t ON t.id_talla = p.id_talla
      WHERE dv.id_orden_venta = v.id_orden_venta
    ) detalle ON true
    WHERE d.estado = $1 AND d.id_orden_despacho = $2`,
    [PENDIENTE, idDespacho]
  );
  return rows[0] ?? null;
}
