import pool from '../../config/database.js';

export async function listarUsuarios() {
  const { rows } = await pool.query(`SELECT u.id_usuario, u.nombre, u.correo, u.activo, u.debe_cambiar_password,
    COALESCE(array_agg(r.nombre_rol ORDER BY r.nombre_rol) FILTER (WHERE r.id_rol IS NOT NULL AND r.activo), ARRAY[]::varchar[]) AS roles
    FROM usuario u LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN rol r ON r.id_rol = ur.id_rol GROUP BY u.id_usuario ORDER BY u.id_usuario`);
  return rows;
}
export async function listarRoles() {
  return (await pool.query('SELECT id_rol, nombre_rol FROM rol WHERE activo = TRUE ORDER BY nombre_rol')).rows;
}
export async function crearUsuario(nombre, correo, hash, ids) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const roles = await cliente.query('SELECT id_rol, nombre_rol FROM rol WHERE id_rol = ANY($1::int[]) AND activo = TRUE ORDER BY id_rol FOR SHARE', [ids]);
    if (roles.rows.length !== ids.length) { const e = new Error('Los roles deben existir y estar activos.'); e.status = 400; throw e; }
    const { rows } = await cliente.query(`INSERT INTO usuario (nombre, correo, password_hash, debe_cambiar_password)
      VALUES ($1, $2, $3, TRUE) RETURNING id_usuario, nombre, correo, activo, debe_cambiar_password`, [nombre, correo, hash]);
    await cliente.query('INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, unnest($2::int[])', [rows[0].id_usuario, ids]);
    await cliente.query('COMMIT');
    return { ...rows[0], roles: roles.rows.map(r => r.nombre_rol) };
  } catch (error) { await cliente.query('ROLLBACK'); throw error; } finally { cliente.release(); }
}
export async function cambiarEstado(id, activo, actor) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Serializa cambios de estado de administradores distintos.
    await cliente.query('SELECT pg_advisory_xact_lock(74120301)');
    const actual = await cliente.query('SELECT id_usuario, activo FROM usuario WHERE id_usuario = $1 FOR UPDATE', [id]);
    if (!actual.rowCount) { const e = new Error('El usuario no existe.'); e.status = 404; throw e; }
    if (!activo && id === actor) { const e = new Error('No puedes desactivar tu propia cuenta.'); e.status = 409; throw e; }
    if (!activo && actual.rows[0].activo) {
      const admins = await cliente.query(`SELECT u.id_usuario FROM usuario u JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        JOIN rol r ON r.id_rol = ur.id_rol WHERE u.activo AND r.activo AND r.nombre_rol = 'Administrador'`);
      if (admins.rows.length === 1 && admins.rows[0].id_usuario === id) { const e = new Error('No se puede desactivar el último Administrador activo.'); e.status = 409; throw e; }
    }
    const { rows } = await cliente.query('UPDATE usuario SET activo = $1 WHERE id_usuario = $2 RETURNING id_usuario, nombre, correo, activo, debe_cambiar_password', [activo, id]);
    await cliente.query('COMMIT');
    return rows[0];
  } catch (error) { await cliente.query('ROLLBACK'); throw error; } finally { cliente.release(); }
}
