import pool from '../../config/database.js';

// El catálogo administrativo muestra las tallas activas e inactivas.
export async function listarTallas() {
  const resultado = await pool.query(
    `SELECT id_talla, numero_talla, activo FROM talla ORDER BY numero_talla ASC`
  );
  return resultado.rows;
}

export async function crearTalla(numeroTalla) {
  const resultado = await pool.query(
    `INSERT INTO talla (numero_talla) VALUES ($1)
     RETURNING id_talla, numero_talla, activo`,
    [numeroTalla]
  );
  return resultado.rows[0];
}

// La transacción protege la comprobación de relaciones y el cambio de número.
export async function actualizarTalla(idTalla, numeroTalla) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query(
      `SELECT numero_talla FROM talla WHERE id_talla = $1 FOR UPDATE`,
      [idTalla]
    );
    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { talla: null, referenciada: false };
    }

    if (Number(actual.rows[0].numero_talla) !== Number(numeroTalla)) {
      const relaciones = await cliente.query(
        `SELECT EXISTS (SELECT 1 FROM costo_base WHERE id_talla = $1)
             OR EXISTS (SELECT 1 FROM producto_sku WHERE id_talla = $1)
             AS referenciada`,
        [idTalla]
      );
      if (relaciones.rows[0].referenciada) {
        await cliente.query('ROLLBACK');
        return { talla: null, referenciada: true };
      }
    }

    const resultado = await cliente.query(
      `UPDATE talla SET numero_talla = $1 WHERE id_talla = $2
       RETURNING id_talla, numero_talla, activo`,
      [numeroTalla, idTalla]
    );
    await cliente.query('COMMIT');
    return { talla: resultado.rows[0], referenciada: false };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// La desactivación no borra la talla ni altera sus relaciones.
export async function cambiarEstadoTalla(idTalla, activo) {
  const resultado = await pool.query(
    `UPDATE talla SET activo = $1 WHERE id_talla = $2
     RETURNING id_talla, numero_talla, activo`,
    [activo, idTalla]
  );
  return resultado.rows[0] ?? null;
}
