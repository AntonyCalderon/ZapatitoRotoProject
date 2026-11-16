import { listarTallas, crearTalla, actualizarTalla, cambiarEstadoTalla } from './talla.repository.js';

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function validarId(idTalla) {
  const id = Number(idTalla);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw errorHttp('El ID de la talla no es válido.', 400);
  }
  return id;
}

// Rechazamos cifras que PostgreSQL redondearía al guardar NUMERIC(4,1).
function validarNumero(numeroTalla) {
  if (typeof numeroTalla !== 'string' && typeof numeroTalla !== 'number') {
    throw errorHttp('El número de talla debe ser numérico.', 400);
  }
  const valor = String(numeroTalla).trim();
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d)?$/.test(valor) || Number(valor) <= 0) {
    throw errorHttp('La talla debe ser positiva, hasta 999.9 y con máximo un decimal.', 400);
  }
  return Number(valor).toFixed(1);
}

export async function obtenerTallas() {
  return listarTallas();
}

export async function registrarTalla(numeroTalla) {
  return crearTalla(validarNumero(numeroTalla));
}

export async function editarTalla(idTalla, numeroTalla) {
  const resultado = await actualizarTalla(validarId(idTalla), validarNumero(numeroTalla));
  if (resultado.referenciada) {
    throw errorHttp('No se puede cambiar el número: la talla tiene costos base o productos SKU relacionados.', 409);
  }
  if (!resultado.talla) {
    throw errorHttp('La talla no existe.', 404);
  }
  return resultado.talla;
}

export async function actualizarEstadoTalla(idTalla, activo) {
  const id = validarId(idTalla);
  if (typeof activo !== 'boolean') {
    throw errorHttp('El estado debe ser true o false.', 400);
  }
  const talla = await cambiarEstadoTalla(id, activo);
  if (!talla) {
    throw errorHttp('La talla no existe.', 404);
  }
  return talla;
}
