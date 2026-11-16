import pool from '../../config/database.js';

// El administrador ve colores activos e inactivos.
export async function listarColores() {
  const resultado = await pool.query(
    `SELECT id_color, nombre_color, activo FROM color ORDER BY id_color ASC`
  );
  return resultado.rows;
}

export async function crearColor(nombreColor) {
  const resultado = await pool.query(
    `INSERT INTO color (nombre_color) VALUES ($1)
     RETURNING id_color, nombre_color, activo`,
    [nombreColor]
  );
  return resultado.rows[0];
}

// Bloqueamos el color para comprobar SKU y actualizarlo en una sola transacción.
export async function actualizarColor(idColor, nombreColor) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query(
      `SELECT nombre_color FROM color WHERE id_color = $1 FOR UPDATE`,
      [idColor]
    );
    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { color: null, referenciado: false };
    }

    if (actual.rows[0].nombre_color !== nombreColor) {
      const relacion = await cliente.query(
        `SELECT EXISTS (SELECT 1 FROM producto_sku WHERE id_color = $1) AS referenciado`,
        [idColor]
      );
      if (relacion.rows[0].referenciado) {
        await cliente.query('ROLLBACK');
        return { color: null, referenciado: true };
      }
    }

    const resultado = await cliente.query(
      `UPDATE color SET nombre_color = $1 WHERE id_color = $2
       RETURNING id_color, nombre_color, activo`,
      [nombreColor, idColor]
    );
    await cliente.query('COMMIT');
    return { color: resultado.rows[0], referenciado: false };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// La desactivación lógica conserva los SKU asociados.
export async function cambiarEstadoColor(idColor, activo) {
  const resultado = await pool.query(
    `UPDATE color SET activo = $1 WHERE id_color = $2
     RETURNING id_color, nombre_color, activo`,
    [activo, idColor]
  );
  return resultado.rows[0] ?? null;
}
