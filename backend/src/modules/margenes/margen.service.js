/*
Responsabilidad: reglas de negocio de los márgenes de utilidad.
No ejecuta SQL ni maneja peticiones HTTP.
*/

import { listarMargenes, guardarMargen } from './margen.repository.js';

const SEGMENTOS = ['B2G', 'B2B', 'B2C'];

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

export async function obtenerMargenes() {
  return listarMargenes();
}

export async function registrarMargen(segmento, porcentaje, idUsuario) {
  if (!SEGMENTOS.includes(segmento)) {
    throw errorHttp('El segmento no es válido.', 400);
  }

  const valor = Number(porcentaje);

  const esVacio =
    porcentaje === null ||
    porcentaje === undefined ||
    typeof porcentaje === 'boolean' ||
    (typeof porcentaje === 'string' && porcentaje.trim() === '');

  // Debe ser un número de 0 en adelante, con máximo dos decimales.
  if (
    esVacio ||
    !Number.isFinite(valor) ||
    valor < 0 ||
    valor > 9999.99 ||
    Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9
  ) {
    throw errorHttp(
      'El porcentaje debe ser un número de 0 o más, con máximo dos decimales.',
      400
    );
  }

  return guardarMargen(segmento, valor, idUsuario);
}