import pool from '../../config/database.js';

const columnas = `p.id_sku, p.codigo_sku, p.id_modelo, p.id_color, p.id_talla,
  p.activo, m.nombre_modelo, c.nombre_color, t.numero_talla,
  m.activo AS modelo_activo, c.activo AS color_activo, t.activo AS talla_activa`;
const uniones = `FROM producto_sku p
  JOIN modelo m ON m.id_modelo = p.id_modelo
  JOIN color c ON c.id_color = p.id_color
  JOIN talla t ON t.id_talla = p.id_talla`;

// Para nuevas operaciones de Compras, Ventas y Almacén, todos los estados deben ser TRUE.
// La disponibilidad exige p.activo AND m.activo AND c.activo AND t.activo.
export async function listarProductosSku(busqueda, estado) {
  const resultado = await pool.query(
    `SELECT ${columnas} ${uniones}
     WHERE ($1 = '' OR p.codigo_sku ILIKE '%' || $1 || '%'
       OR m.nombre_modelo ILIKE '%' || $1 || '%'
       OR c.nombre_color ILIKE '%' || $1 || '%'
       OR t.numero_talla::text ILIKE '%' || $1 || '%')
       AND ($2 = 'todos' OR p.activo = ($2 = 'activos'))
     ORDER BY p.id_sku ASC`,
    [busqueda, estado]
  );
  return resultado.rows;
}

export async function buscarProductoSkuPorId(idSku) {
  const resultado = await pool.query(
    `SELECT ${columnas} ${uniones} WHERE p.id_sku = $1`,
    [idSku]
  );
  return resultado.rows[0] ?? null;
}

export async function obtenerOpcionesSku() {
  const [modelos, tallas, colores] = await Promise.all([
    pool.query(`SELECT id_modelo, nombre_modelo FROM modelo WHERE activo = TRUE ORDER BY nombre_modelo`),
    pool.query(`SELECT id_talla, numero_talla FROM talla WHERE activo = TRUE ORDER BY numero_talla`),
    pool.query(`SELECT id_color, nombre_color FROM color WHERE activo = TRUE ORDER BY nombre_color`)
  ]);
  return { modelos: modelos.rows, tallas: tallas.rows, colores: colores.rows };
}

// FOR SHARE bloquea cambios de estado concurrentes hasta terminar la transacción.
async function verificarComponentesActivos(cliente, idModelo, idTalla, idColor) {
  const componentes = [
    ['modelo', 'id_modelo', idModelo],
    ['talla', 'id_talla', idTalla],
    ['color', 'id_color', idColor]
  ];
  for (const [tabla, columna, id] of componentes) {
    const resultado = await cliente.query(
      `SELECT activo FROM ${tabla} WHERE ${columna} = $1 FOR SHARE`,
      [id]
    );
    if (resultado.rowCount === 0) return { tipo: 'inexistente', componente: tabla };
    if (!resultado.rows[0].activo) return { tipo: 'inactivo', componente: tabla };
  }
  return null;
}

export async function crearProductoSku(idModelo, idTalla, idColor, codigoSku) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const problema = await verificarComponentesActivos(cliente, idModelo, idTalla, idColor);
    if (problema) {
      await cliente.query('ROLLBACK');
      return { producto: null, problema };
    }
    const resultado = await cliente.query(
      `INSERT INTO producto_sku (codigo_sku, id_modelo, id_color, id_talla)
       VALUES ($1, $2, $3, $4)
       RETURNING id_sku, codigo_sku, id_modelo, id_color, id_talla, activo`,
      [codigoSku, idModelo, idColor, idTalla]
    );
    await cliente.query('COMMIT');
    return { producto: resultado.rows[0], problema: null };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cambiarEstadoProductoSku(idSku, activo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query(
      `SELECT id_modelo, id_talla, id_color FROM producto_sku
       WHERE id_sku = $1 FOR UPDATE`,
      [idSku]
    );
    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { producto: null, problema: { tipo: 'sku_inexistente' } };
    }
    if (activo) {
      const { id_modelo, id_talla, id_color } = actual.rows[0];
      const problema = await verificarComponentesActivos(cliente, id_modelo, id_talla, id_color);
      if (problema) {
        await cliente.query('ROLLBACK');
        return { producto: null, problema };
      }
    }
    // Solo se modifica activo; código y combinación permanecen estables.
    const resultado = await cliente.query(
      `UPDATE producto_sku SET activo = $1 WHERE id_sku = $2
       RETURNING id_sku, codigo_sku, id_modelo, id_color, id_talla, activo`,
      [activo, idSku]
    );
    await cliente.query('COMMIT');
    return { producto: resultado.rows[0], problema: null };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
