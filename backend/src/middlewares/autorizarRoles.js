
import { buscarUsuarioPorId } from '../modules/auth/auth.repository.js';

// Verifica que la petición pertenezca a una cuenta activa.
export async function autenticarSesion(req, res, next) {
  try {
    const idUsuario = req.session?.idUsuario;

    // Si no hay sesión, no permitimos continuar.
    if (!idUsuario) {
      return res.status(401).json({
        mensaje: 'Debes iniciar sesión.'
      });
    }

    // Consultamos el estado y los roles actuales en PostgreSQL.
    const usuario = await buscarUsuarioPorId(idUsuario);

    if (!usuario || !usuario.activo || usuario.roles.length === 0) {
      return res.status(401).json({
        mensaje: 'Tu cuenta no tiene acceso al sistema.'
      });
    }

    // Compartimos la identidad verificada con los siguientes middlewares.
    req.usuario = usuario;

    next();

  } catch (error) {
    console.error('Error al verificar autenticación:', error);

    return res.status(500).json({
      mensaje: 'No se pudo verificar la sesión.'
    });
  }
}

export function requerirAutenticacion(req, res, next) {
  return autenticarSesion(req, res, () => {
    if (req.usuario.debe_cambiar_password) {
      return res.status(403).json({ mensaje: 'Debes cambiar tu contraseña para continuar.', codigo: 'CAMBIO_PASSWORD_REQUERIDO' });
    }
    return next();
  });
}

// Comprueba si el trabajador tiene alguno de los roles permitidos.
export function autorizarRoles(...rolesPermitidos) {
  return (req, res, next) => {
    const usuario = req.usuario;

    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Debes iniciar sesión.'
      });
    }

    // El usuario debe tener al menos uno de los roles permitidos.
    const autorizado = rolesPermitidos.some((rol) =>
      usuario.roles.includes(rol)
    );

    if (!autorizado) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para realizar esta operación.'
      });
    }

    next();
  };
}
