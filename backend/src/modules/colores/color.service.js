import { listarColores, crearColor, actualizarColor, cambiarEstadoColor } from './color.repository.js';

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function validarId(idColor) {
  const id = Number(idColor);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw errorHttp('El ID del color no es válido.', 400);
  }
  return id;
}

// El nombre se guarda sin espacios externos y respeta VARCHAR(50).
function validarNombre(nombreColor) {
  if (typeof nombreColor !== 'string' || !nombreColor.trim()) {
    throw errorHttp('El nombre del color es obligatorio.', 400);
  }
  const nombre = nombreColor.trim();
  if (nombre.length > 50) {
    throw errorHttp('El nombre del color no puede superar 50 caracteres.', 400);
  }
  return nombre;
}

export async function obtenerColores() {
  return listarColores();
}

export async function registrarColor(nombreColor) {
  return crearColor(validarNombre(nombreColor));
}

export async function editarColor(idColor, nombreColor) {
  const resultado = await actualizarColor(validarId(idColor), validarNombre(nombreColor));
  if (resultado.referenciado) {
    throw errorHttp('No se puede cambiar el nombre: el color tiene productos SKU relacionados.', 409);
  }
  if (!resultado.color) {
    throw errorHttp('El color no existe.', 404);
  }
  return resultado.color;
}

export async function actualizarEstadoColor(idColor, activo) {
  const id = validarId(idColor);
  if (typeof activo !== 'boolean') {
    throw errorHttp('El estado debe ser true o false.', 400);
  }
  const color = await cambiarEstadoColor(id, activo);
  if (!color) {
    throw errorHttp('El color no existe.', 404);
  }
  return color;
}
