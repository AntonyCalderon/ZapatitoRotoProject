
import argon2 from 'argon2';
import pool from '../src/config/database.js';

/*
Crea la primera cuenta Administrador. Protege su contraseña y vincula el usuario con su rol.
*/
async function crearAdministrador() {
  const nombre = process.env.ADMIN_NAME?.trim();
  const correo = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  let cliente;

  try {
    // Antes de guardar, comprobamos los datos recibidos.
    if (!nombre || !correo || !password) {
      throw new Error('Faltan datos del Administrador.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new Error('El correo no es válido.');
    }

    if (password.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres.');
    }

    // Convertimos la contraseña en un hash antes de guardarla.
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    // Abrimos una conexión para realizar las operaciones juntas.
    cliente = await pool.connect();
    await cliente.query('BEGIN');

    // Verificamos que todavía no exista un Administrador.
    const administradores = await cliente.query(`
      SELECT 1
      FROM usuario_rol ur
      JOIN rol r ON r.id_rol = ur.id_rol
      WHERE r.nombre_rol = 'Administrador'
      LIMIT 1
    `);

    if (administradores.rowCount > 0) {
      throw new Error('Ya existe un Administrador inicial.');
    }

    // Buscamos el identificador del rol Administrador.
    const roles = await cliente.query(`
      SELECT id_rol
      FROM rol
      WHERE nombre_rol = 'Administrador' AND activo = TRUE
    `);

    if (roles.rowCount === 0) {
      throw new Error('No existe el rol Administrador.');
    }

    const idRol = roles.rows[0].id_rol;

    // Guardamos al usuario con su contraseña protegida.
    const resultado = await cliente.query(
      `INSERT INTO usuario (nombre, correo, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id_usuario, nombre, correo`,
      [nombre, correo, passwordHash]
    );

    const usuario = resultado.rows[0];

    // Asociamos la cuenta recién creada al rol Administrador.
    await cliente.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol)
       VALUES ($1, $2)`,
      [usuario.id_usuario, idRol]
    );

    // Confirmamos ambas inserciones.
    await cliente.query('COMMIT');

    console.log('Administrador creado correctamente.');
    console.log('ID:', usuario.id_usuario);
    console.log('Nombre:', usuario.nombre);
    console.log('Correo:', usuario.correo);

  } catch (error) {
    // Si falla alguna operación, deshacemos los cambios.
    if (cliente) {
      await cliente.query('ROLLBACK');
    }

    console.error('No se pudo crear el Administrador:', error.message);
    process.exitCode = 1;

  } finally {
    // Devolvemos la conexión al Pool y terminamos el script.
    if (cliente) cliente.release();
    await pool.end();
  }
}

crearAdministrador();
