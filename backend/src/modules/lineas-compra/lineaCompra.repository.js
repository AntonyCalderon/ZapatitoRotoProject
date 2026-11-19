/*
@file lineaCompra.repository.js
@description Consultas PostgreSQL de HU02: elegir SKUs y guardar las líneas de un borrador de compra.

Un SKU se puede comprar cuando el SKU, su modelo, su color y su talla están activos.
*/

import pool from '../../config/database.js';

const UNIONES_SKU = `
  JOIN modelo m ON m.id_modelo = p.id_modelo
  JOIN color c ON c.id_color = p.id_color
  JOIN talla t ON t.id_talla = p.id_talla`;

const CONDICION_COMPRABLE = 'p.activo AND m.activo AND c.activo AND t.activo';

const SKU_COMPRABLE = `FROM producto_sku p ${UNIONES_SKU} WHERE ${CONDICION_COMPRABLE}`;

// Las líneas ya guardadas se muestran aunque el SKU se desactive después.
const SQL_LINEAS_DE_ORDEN = `
  SELECT d.id_detalle_compra, d.costo_unitario, d.importe, d.id_sku, p.codigo_sku, m.nombre_modelo, c.nombre_color, t.numero_talla, d.cantidad
  FROM detalle_orden_compra d
  JOIN producto_sku p ON p.id_sku = d.id_sku ${UNIONES_SKU}
  WHERE d.id_orden_compra = $1
  ORDER BY m.nombre_modelo, c.nombre_color, t.numero_talla`;

export async function listarModelosConSku() {
  const resultado = await pool.query(
    `SELECT DISTINCT m.id_modelo, m.nombre_modelo ${SKU_COMPRABLE}
     ORDER BY m.nombre_modelo`
  );
  return resultado.rows;
}

export async function listarColoresPorModelo(idModelo) {
  const resultado = await pool.query(
    `SELECT DISTINCT c.id_color, c.nombre_color ${SKU_COMPRABLE}
       AND p.id_modelo = $1
     ORDER BY c.nombre_color`,
    [idModelo]
  );
  return resultado.rows;
}

export async function listarTallasPorModeloYColor(idModelo, idColor) {
  const resultado = await pool.query(
    `SELECT p.id_sku, t.id_talla, t.numero_talla ${SKU_COMPRABLE}
       AND p.id_modelo = $1 AND p.id_color = $2
     ORDER BY t.numero_talla`,
    [idModelo, idColor]
  );
  return resultado.rows;
}

// Devuelve null si la orden no existe.
export async function obtenerLineasDeOrden(idOrden) {
  const orden = await pool.query(
    'SELECT estado FROM orden_compra WHERE id_orden_compra = $1',
    [idOrden]
  );
  if (orden.rowCount === 0) return null;

  const lineas = await pool.query(SQL_LINEAS_DE_ORDEN, [idOrden]);
  return { estado: orden.rows[0].estado, lineas: lineas.rows };
}

/*
Reemplaza todas las líneas del borrador en una sola transacción.
FOR UPDATE bloquea la orden para que nadie la emita o cancele mientras se guardan sus líneas.
Si algún SKU ya no se puede comprar, no se guarda nada.
*/
export async function reemplazarLineas(idOrden, lineas) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const orden = await cliente.query(
      'SELECT estado FROM orden_compra WHERE id_orden_compra = $1 FOR UPDATE',
      [idOrden]
    );
    if (orden.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { lineas: null, problema: { tipo: 'orden_inexistente' } };
    }
    if (orden.rows[0].estado !== 'BORRADOR') {
      await cliente.query('ROLLBACK');
      return { lineas: null, problema: { tipo: 'no_es_borrador' } };
    }

    await cliente.query('DELETE FROM detalle_orden_compra WHERE id_orden_compra = $1', [idOrden]);

    if (lineas.length > 0) {
      const insertadas = await cliente.query(
        `INSERT INTO detalle_orden_compra (id_orden_compra, id_sku, cantidad)
         SELECT $1, p.id_sku, e.cantidad
         FROM unnest($2::int[], $3::int[]) AS e(id_sku, cantidad)
         JOIN producto_sku p ON p.id_sku = e.id_sku ${UNIONES_SKU}
         WHERE ${CONDICION_COMPRABLE}
         RETURNING id_sku`,
        [idOrden, lineas.map((l) => l.id_sku), lineas.map((l) => l.cantidad)]
      );

      if (insertadas.rowCount !== lineas.length) {
        const guardados = new Set(insertadas.rows.map((fila) => fila.id_sku));
        const ids = lineas.map((l) => l.id_sku).filter((id) => !guardados.has(id));
        await cliente.query('ROLLBACK');
        return { lineas: null, problema: { tipo: 'sku_no_disponible', ids } };
      }
    }

    const detalle = await cliente.query(SQL_LINEAS_DE_ORDEN, [idOrden]);
    await cliente.query('COMMIT');
    return { lineas: detalle.rows, problema: null };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// Agrega un lote atómico y acumula pares repetidos bajo el bloqueo de la orden.
// No reemplaza ni elimina líneas existentes.
export async function agregarDetalles(idOrden, lineas) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const orden = await cliente.query('SELECT estado FROM orden_compra WHERE id_orden_compra=$1 FOR UPDATE', [idOrden]);
    if (!orden.rowCount || orden.rows[0].estado !== 'BORRADOR') {
      await cliente.query('ROLLBACK');
      return { problema: { tipo: orden.rowCount ? 'no_es_borrador' : 'orden_inexistente' } };
    }
    const insertadas = await cliente.query(`
      INSERT INTO detalle_orden_compra (id_orden_compra,id_sku,cantidad)
      SELECT $1,p.id_sku,e.cantidad FROM unnest($2::int[],$3::int[]) AS e(id_sku,cantidad)
      JOIN producto_sku p ON p.id_sku=e.id_sku ${UNIONES_SKU}
      WHERE ${CONDICION_COMPRABLE}
      ON CONFLICT (id_orden_compra,id_sku) DO UPDATE
      SET cantidad=detalle_orden_compra.cantidad + EXCLUDED.cantidad
      WHERE detalle_orden_compra.cantidad + EXCLUDED.cantidad <= 100000
      RETURNING id_sku`,
      [idOrden, lineas.map(l => l.id_sku), lineas.map(l => l.cantidad)]);
    if (insertadas.rowCount !== lineas.length) {
      await cliente.query('ROLLBACK');
      return { problema: { tipo: 'detalle_no_agregado', ids: lineas.filter(l => !insertadas.rows.some(r => r.id_sku === l.id_sku)).map(l => l.id_sku) } };
    }
    const resultado = await cliente.query(SQL_LINEAS_DE_ORDEN, [idOrden]);
    await cliente.query('COMMIT');
    return { lineas: resultado.rows, problema: null };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally { cliente.release(); }
}

// Catálogo de consulta de Compras. Una sola lectura mantiene coherentes las
// opciones y sus SKU. El costo vigente es referencia; no se fija en el detalle.
export async function listarCatalogoCompra() {
  const resultado = await pool.query(`
    SELECT p.id_sku, p.codigo_sku, p.id_modelo, p.id_color, p.id_talla,
      m.nombre_modelo, c.nombre_color, t.numero_talla,
      cb.costo_vigente AS costo_base_vigente
    FROM producto_sku p ${UNIONES_SKU}
    LEFT JOIN costo_base cb ON cb.id_modelo=p.id_modelo AND cb.id_talla=p.id_talla
    WHERE ${CONDICION_COMPRABLE}
    ORDER BY m.nombre_modelo, m.id_modelo, c.nombre_color, t.numero_talla
  `);
  const variantes = resultado.rows;
  const modelos = [...new Map(variantes.map(v => [v.id_modelo, {id_modelo:v.id_modelo,nombre_modelo:v.nombre_modelo}])).values()];
  const colores = [...new Map(variantes.map(v => [v.id_color, {id_color:v.id_color,nombre_color:v.nombre_color}])).values()]
    .sort((a,b) => a.nombre_color.localeCompare(b.nombre_color, 'es'));
  const tallas = [...new Map(variantes.map(v => [v.id_talla, {id_talla:v.id_talla,numero_talla:v.numero_talla}])).values()]
    .sort((a,b) => Number(a.numero_talla)-Number(b.numero_talla));
  return {modelos,colores,tallas,variantes};
}
