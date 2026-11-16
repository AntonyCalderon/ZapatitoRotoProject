import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { listarUsuarios, listarRoles, crearUsuario, cambiarEstado } from './usuario.repository.js';

function errorHttp(mensaje, status) { const e = new Error(mensaje); e.status = status; return e; }
export async function obtenerUsuarios() { return listarUsuarios(); }
export async function obtenerRoles() { return listarRoles(); }
export async function registrarUsuario(datos) {
  const { nombre, correo, roles } = datos ?? {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) throw errorHttp('El nombre es obligatorio y debe tener máximo 100 caracteres.', 400);
  if (typeof correo !== 'string' || correo.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) throw errorHttp('El correo no es válido.', 400);
  if (!Array.isArray(roles) || !roles.length || roles.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(roles).size !== roles.length) throw errorHttp('Selecciona uno o varios roles válidos sin duplicados.', 400);
  const passwordTemporal = randomBytes(24).toString('base64url');
  const hash = await argon2.hash(passwordTemporal, { type: argon2.argon2id });
  try {
    const usuario = await crearUsuario(nombre.trim(), correo.trim().toLowerCase(), hash, roles);
    return { usuario, passwordTemporal };
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uq_usuario_correo') throw errorHttp('Ya existe un usuario con ese correo.', 409);
    throw error;
  }
}
export async function actualizarEstado(id, activo, actor) {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw errorHttp('El ID del usuario no es válido.', 400);
  if (typeof activo !== 'boolean') throw errorHttp('El estado debe ser true o false.', 400);
  return cambiarEstado(numero, activo, actor);
}
