import pool from '../../config/database.js';

const activo = '(p.activo AND m.activo AND c.activo AND t.activo)';
const situacion = `CASE
  WHEN s.cantidad_actual = 0 THEN 'agotado'
  WHEN s.stock_minimo IS NULL THEN 'sin_minimo'
  WHEN s.cantidad_actual <= s.stock_minimo THEN 'stock_bajo'
  ELSE 'disponible' END`;
const origenProducto = `FROM producto_sku p
  JOIN modelo m ON m.id_modelo = p.id_modelo
  JOIN color c ON c.id_color = p.id_color
  JOIN talla t ON t.id_talla = p.id_talla
  JOIN stock_sku s ON s.id_sku = p.id_sku`;
const columnasProducto = `p.id_sku, p.codigo_sku, m.nombre_modelo AS modelo,
  c.nombre_color AS color, t.numero_talla::text AS talla,
  s.cantidad_actual, s.stock_minimo, ${activo} AS catalogo_activo,
  ${situacion} AS situacion`;

// El total, las filas y el saldo corresponden a la misma fotografía de la BD.
async function consultarSnapshot(consultar) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const resultado = await consultar(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

function filtrarCatalogo(catalogo) {
  return catalogo === 'todos' ? 'TRUE' : catalogo === 'activos' ? activo : `NOT ${activo}`;
}

export async function listarExistencias(filtros) {
  const valores = [];
  const condiciones = [filtrarCatalogo(filtros.catalogo)];
  function agregar(valor, condicion) {
    valores.push(valor);
    condiciones.push(condicion('$' + valores.length));
  }
  if (filtros.q) agregar(filtros.q, parametro =>
    `strpos(lower(concat_ws(' ', p.codigo_sku, m.nombre_modelo, c.nombre_color, t.numero_talla::text)), lower(${parametro})) > 0`);
  for (const [campo, columna] of [['id_modelo', 'p.id_modelo'], ['id_color', 'p.id_color'], ['id_talla', 'p.id_talla']]) {
    if (filtros[campo] !== null) agregar(filtros[campo], parametro => `${columna} = ${parametro}`);
  }
  if (filtros.situacion !== 'todos') agregar(filtros.situacion, parametro => `(${situacion}) = ${parametro}`);
  const donde = 'WHERE ' + condiciones.join(' AND ');
  return consultarSnapshot(async cliente => {
    const { rows: [conteo] } = await cliente.query(`SELECT count(*)::int AS total ${origenProducto} ${donde}`, valores);
    const { rows: items } = await cliente.query(`SELECT ${columnasProducto}
      ${origenProducto} ${donde} ORDER BY p.codigo_sku, p.id_sku
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, filtros.tamano, (filtros.pagina - 1) * filtros.tamano]);
    return { items, pagina: filtros.pagina, tamano: filtros.tamano, total: conteo.total };
  });
}

export async function obtenerCatalogo(catalogo) {
  const { rows: [opciones] } = await pool.query(`WITH variantes AS (
    SELECT m.id_modelo, m.nombre_modelo, c.id_color, c.nombre_color, t.id_talla, t.numero_talla
    ${origenProducto} WHERE ${filtrarCatalogo(catalogo)}
  ) SELECT
    COALESCE((SELECT json_agg(x ORDER BY x.nombre_modelo, x.id_modelo)
      FROM (SELECT DISTINCT id_modelo, nombre_modelo FROM variantes) x), '[]'::json) AS modelos,
    COALESCE((SELECT json_agg(x ORDER BY x.nombre_color, x.id_color)
      FROM (SELECT DISTINCT id_color, nombre_color FROM variantes) x), '[]'::json) AS colores,
    COALESCE((SELECT json_agg(json_build_object('id_talla', x.id_talla, 'numero_talla', x.numero_talla::text)
      ORDER BY x.numero_talla, x.id_talla)
      FROM (SELECT DISTINCT id_talla, numero_talla FROM variantes) x), '[]'::json) AS tallas`);
  return opciones;
}

export async function obtenerKardex(idSku, filtros) {
  return consultarSnapshot(async cliente => {
    const { rows: [productoConSaldo] } = await cliente.query(
      `SELECT ${columnasProducto} ${origenProducto} WHERE p.id_sku = $1`, [idSku]);
    if (!productoConSaldo) return null;
    const valores = [idSku];
    const condiciones = ['k.id_sku = $1'];
    if (filtros.desde) {
      valores.push(filtros.desde);
      condiciones.push(`k.fecha_movimiento >= ($${valores.length}::date::timestamp AT TIME ZONE 'America/Lima')`);
    }
    if (filtros.hasta) {
      valores.push(filtros.hasta);
      condiciones.push(`k.fecha_movimiento < (($${valores.length}::date + 1)::timestamp AT TIME ZONE 'America/Lima')`);
    }
    if (filtros.tipo_movimiento !== 'todos') {
      valores.push(filtros.tipo_movimiento);
      condiciones.push(`k.tipo_movimiento = $${valores.length}`);
    }
    const donde = 'WHERE ' + condiciones.join(' AND ');
    const { rows: [conteo] } = await cliente.query(
      `SELECT count(*)::int AS total FROM kardex_movimiento k ${donde}`, valores);
    const { rows: items } = await cliente.query(`SELECT k.id_movimiento::text,
      k.fecha_movimiento AS fecha, k.tipo_movimiento,
      CASE WHEN k.tipo_movimiento = 'SALIDA_VENTA' THEN 0 ELSE k.cantidad END AS entrada,
      CASE WHEN k.tipo_movimiento = 'SALIDA_VENTA' THEN k.cantidad ELSE 0 END AS salida,
      k.saldo_posterior, u.nombre AS responsable,
      CASE WHEN k.id_recepcion IS NOT NULL THEN
        json_build_object('tipo', 'RECEPCION', 'id', r.id_recepcion, 'codigo', oc.codigo)
      WHEN k.id_orden_despacho IS NOT NULL THEN
        json_build_object('tipo', 'DESPACHO', 'id', od.id_orden_despacho, 'codigo', od.codigo)
      ELSE json_build_object('tipo', 'APERTURA', 'id', NULL, 'codigo', NULL)
      END AS documento_origen
      FROM kardex_movimiento k
      JOIN usuario u ON u.id_usuario = k.id_usuario
      LEFT JOIN recepcion_compra r ON r.id_recepcion = k.id_recepcion
      LEFT JOIN orden_compra oc ON oc.id_orden_compra = r.id_orden_compra
      LEFT JOIN orden_despacho od ON od.id_orden_despacho = k.id_orden_despacho
      ${donde} ORDER BY k.fecha_movimiento DESC, k.id_movimiento DESC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, filtros.tamano, (filtros.pagina - 1) * filtros.tamano]);
    const { cantidad_actual, ...producto } = productoConSaldo;
    return { producto, cantidad_actual, items, pagina: filtros.pagina, tamano: filtros.tamano, total: conteo.total };
  });
}
