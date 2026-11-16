import argon2 from 'argon2';
import { buscarUsuarioPorCorreo, buscarPasswordPorId, actualizarPassword } from './auth.repository.js';

/*
Recibe las credenciales del login, busca la cuenta y comprueba su contraseña antes de permitir continuar.

¿Qué hace argon2.verify()?
Cuando creamos el primer Administrador, utilizamos argon2.hash() para proteger su contraseña.

Ahora hacemos lo contrario en términos de comprobación: no recuperamos la contraseña original, 
sino que verificamos si la ingresada coincide con el hash.
*/

export async function verificarCredenciales(correo, password) {
  // Comprobamos que el formulario haya enviado ambos datos.
  if (
    typeof correo !== 'string' ||
    typeof password !== 'string' ||
    !correo.trim() ||
    !password
  ) {
    const error = new Error('Debes ingresar correo y contraseña.');
    error.status = 400;
    throw error;
  }

  // Buscamos la cuenta en PostgreSQL mediante el Repository.
  const usuario = await buscarUsuarioPorCorreo(correo.trim());

  // Si no existe, está desactivada o no tiene roles, rechazamos el acceso.
  if (!usuario || !usuario.activo || usuario.roles.length === 0) {
    const error = new Error('Correo o contraseña incorrectos.');
    error.status = 401;
    throw error;
  }

  // Argon2 compara la contraseña recibida con el hash almacenado.
  const passwordValida = await argon2.verify(
    usuario.password_hash,
    password
  );

  if (!passwordValida) {
    const error = new Error('Correo o contraseña incorrectos.');
    error.status = 401;
    throw error;
  }

  // Devolvemos solo los datos necesarios, nunca el hash.
  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    correo: usuario.correo,
    roles: usuario.roles,
    debe_cambiar_password: usuario.debe_cambiar_password
  };
}

export async function cambiarPassword(idUsuario, actual, nueva) {
  if (typeof actual !== 'string' || !actual || typeof nueva !== 'string' || nueva.length < 12 || nueva.length > 128 || !nueva.trim()) {
    const error = new Error('Ingresa la contraseña actual y una nueva de entre 12 y 128 caracteres.'); error.status = 400; throw error;
  }
  const usuario = await buscarPasswordPorId(idUsuario);
  if (!usuario || !(await argon2.verify(usuario.password_hash, actual))) {
    const error = new Error('No se pudo verificar la contraseña actual.'); error.status = 400; throw error;
  }
  if (await argon2.verify(usuario.password_hash, nueva)) {
    const error = new Error('La nueva contraseña debe ser diferente de la actual.'); error.status = 400; throw error;
  }
  const hash = await argon2.hash(nueva, { type: argon2.argon2id });
  if (!(await actualizarPassword(idUsuario, usuario.password_hash, hash))) {
    const error = new Error('No se pudo completar el cambio. Inicia sesión nuevamente.'); error.status = 409; throw error;
  }
}
