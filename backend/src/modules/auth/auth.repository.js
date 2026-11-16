/*
Busca una cuenta por correo y recupera sus roles. El Service utilizará estos datos para verificar el login.
*/
import pool from '../../config/database.js';

export async function buscarUsuarioPorCorreo(correo) {
  // Buscamos la cuenta y reunimos sus roles en un arreglo.
  const resultado = await pool.query(
    `SELECT
       u.id_usuario,
       u.nombre,
       u.correo,
       u.password_hash,
       u.activo,
       u.debe_cambiar_password,
       COALESCE(
         ARRAY_AGG(r.nombre_rol ORDER BY r.nombre_rol)
           FILTER (WHERE r.id_rol IS NOT NULL AND r.activo = TRUE),
         ARRAY[]::VARCHAR[]
       ) AS roles
     FROM usuario u
     LEFT JOIN usuario_rol ur
       ON ur.id_usuario = u.id_usuario
     LEFT JOIN rol r
       ON r.id_rol = ur.id_rol
     WHERE LOWER(TRIM(u.correo)) = LOWER(TRIM($1))
     GROUP BY u.id_usuario, u.nombre, u.correo,
              u.password_hash, u.activo`,
    [correo]
  );

  // Si no hay ninguna cuenta con ese correo, devolvemos null.
  return resultado.rows[0] ?? null;
}

// esto es para?? porque agregar mas: Agregar una función al Repository existente

// Recupera la cuenta y los roles actuales a partir de su ID.
export async function buscarUsuarioPorId(idUsuario) {
  const resultado = await pool.query(
    `SELECT
       u.id_usuario,
       u.nombre,
       u.correo,
       u.activo,
       u.debe_cambiar_password,
       COALESCE(
         ARRAY_AGG(r.nombre_rol ORDER BY r.nombre_rol)
           FILTER (WHERE r.id_rol IS NOT NULL AND r.activo = TRUE),
         ARRAY[]::VARCHAR[]
       ) AS roles
     FROM usuario u
     LEFT JOIN usuario_rol ur
       ON ur.id_usuario = u.id_usuario
     LEFT JOIN rol r
       ON r.id_rol = ur.id_rol
     WHERE u.id_usuario = $1
     GROUP BY u.id_usuario, u.nombre, u.correo, u.activo`,
    [idUsuario]
  );

  return resultado.rows[0] ?? null;
}

export async function buscarPasswordPorId(idUsuario) {
  const resultado = await pool.query('SELECT password_hash FROM usuario WHERE id_usuario = $1 AND activo = TRUE', [idUsuario]);
  return resultado.rows[0] ?? null;
}

// La comparación del hash anterior impide aceptar dos cambios concurrentes.
export async function actualizarPassword(idUsuario, hashAnterior, hashNuevo) {
  const resultado = await pool.query(`UPDATE usuario SET password_hash = $1, debe_cambiar_password = FALSE
    WHERE id_usuario = $2 AND password_hash = $3 AND activo = TRUE RETURNING id_usuario`, [hashNuevo, idUsuario, hashAnterior]);
  return resultado.rowCount === 1;
}
