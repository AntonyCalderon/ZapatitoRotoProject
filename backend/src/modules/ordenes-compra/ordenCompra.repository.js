import pool from '../../config/database.js';

const columnas = `oc.id_orden_compra, oc.estado, oc.id_proveedor, oc.id_usuario_creador,
  u.nombre AS creador, oc.fecha_creacion, oc.observacion, oc.codigo, oc.subtotal, oc.total,
  pr.razon_social AS proveedor`;
const uniones = `FROM orden_compra oc JOIN usuario u ON u.id_usuario = oc.id_usuario_creador
  LEFT JOIN proveedor pr ON pr.id_proveedor = oc.id_proveedor`;

// El borrador nace vacío: solo se registran usuario creador, fecha y estado (RN-01).
export async function crearBorrador(idUsuario) {
  const resultado = await pool.query(
    `INSERT INTO orden_compra (id_usuario_creador) VALUES ($1)
     RETURNING id_orden_compra, estado, id_proveedor, id_usuario_creador, fecha_creacion, observacion`,
    [idUsuario]
  );
  return resultado.rows[0];
}

export async function listarBorradores(estado = null) {
  const resultado = await pool.query(
    `SELECT ${columnas} ${uniones}
     WHERE ($1::varchar IS NULL OR oc.estado = $1)
     ORDER BY oc.fecha_creacion DESC`, [estado]
  );
  return resultado.rows;
}

export async function buscarOrdenCompraPorId(idOrden) {
  const resultado = await pool.query(
    `SELECT ${columnas} ${uniones} WHERE oc.id_orden_compra = $1`,
    [idOrden]
  );
  return resultado.rows[0] ?? null;
}

// FOR UPDATE evita guardar sobre una orden que otro proceso cambia de estado a la vez.
export async function guardarBorrador(idOrden, idProveedor, observacion) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query(
      `SELECT estado FROM orden_compra WHERE id_orden_compra = $1 FOR UPDATE`,
      [idOrden]
    );
    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { orden: null, problema: { tipo: 'orden_inexistente' } };
    }
    if (actual.rows[0].estado !== 'BORRADOR') {
      await cliente.query('ROLLBACK');
      return { orden: null, problema: { tipo: 'no_es_borrador' } };
    }
    const resultado = await cliente.query(
      `UPDATE orden_compra
       SET id_proveedor = CASE WHEN $4::boolean THEN $2 ELSE id_proveedor END,
           observacion = CASE WHEN $5::boolean THEN $3 ELSE observacion END
       WHERE id_orden_compra = $1
       RETURNING id_orden_compra, estado, id_proveedor, id_usuario_creador, fecha_creacion, observacion`,
      [idOrden, idProveedor, observacion, idProveedor !== undefined, observacion !== undefined]
    );
    await cliente.query('COMMIT');
    return { orden: resultado.rows[0], problema: null };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}