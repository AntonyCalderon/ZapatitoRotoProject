import { verificarCredenciales, cambiarPassword } from './auth.service.js';
import { buscarUsuarioPorId } from './auth.repository.js';

// Recibe correo y contraseña enviados desde el formulario.
export async function login(req, res) {
  try {
    const { correo, password } = req.body ?? {};

    // El Service consulta PostgreSQL y verifica con Argon2.
    const usuario = await verificarCredenciales(correo, password);

    // Renovamos el identificador de sesión al iniciar sesión.
    await new Promise((resolve, reject) => {
      req.session.regenerate(error => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Conservamos únicamente el identificador del usuario.
    req.session.idUsuario = usuario.id_usuario;

    await new Promise((resolve, reject) => {
      req.session.save(error => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.status(200).json({
      mensaje: 'Inicio de sesión correcto.',
      usuario
    });

  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      return res.status(error.status).json({
        mensaje: error.message
      });
    }

    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });
  }
}

// Identifica al usuario que tiene una sesión activa.
export async function obtenerSesion(req, res) {
  try {
    if (!req.session.idUsuario) {
      return res.status(401).json({
        mensaje: 'No has iniciado sesión.'
      });
    }

    // Consultamos nuevamente PostgreSQL para obtener roles vigentes.
    const usuario = await buscarUsuarioPorId(req.session.idUsuario);

    if (!usuario || !usuario.activo || usuario.roles.length === 0) {
      return res.status(401).json({
        mensaje: 'La cuenta ya no tiene acceso.'
      });
    }

    return res.status(200).json({
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        roles: usuario.roles,
        debe_cambiar_password: usuario.debe_cambiar_password
      }
    });

  } catch (error) {
    console.error('Error al consultar sesión:', error);
    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });
  }
}

export async function cambiarPasswordController(req, res) {
  const idUsuario = req.usuario.id_usuario;
  try {
    await cambiarPassword(idUsuario, req.body?.passwordActual, req.body?.passwordNueva);
  } catch (error) {
    if ([400, 409].includes(error.status)) return res.status(error.status).json({ mensaje: error.message });
    console.error('Error al cambiar contraseña.');
    return res.status(500).json({ mensaje: 'No se pudo cambiar la contraseña.' });
  }
  try {
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.idUsuario = idUsuario;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    const usuario = await buscarUsuarioPorId(idUsuario);
    if (!usuario || !usuario.activo || !usuario.roles.length) throw new Error('Sesión no disponible');
    return res.json({ mensaje: 'Contraseña actualizada.', usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, roles: usuario.roles, debe_cambiar_password: usuario.debe_cambiar_password } });
  } catch {
    res.clearCookie('aym.sid', { path: '/' });
    return res.status(500).json({ mensaje: 'La contraseña se cambió, pero no se pudo renovar la sesión. Inicia sesión nuevamente.' });
  }
}

// Destruye la sesión y elimina la cookie del navegador.
export async function logout(req, res) {
  try {
    await new Promise((resolve, reject) => {
      req.session.destroy(error => {
        if (error) reject(error);
        else resolve();
      });
    });

    res.clearCookie('aym.sid', { path: '/' });

    return res.status(200).json({
      mensaje: 'Sesión cerrada correctamente.'
    });

  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });
  }
}
