import {
  crearBorrador,
  listarBorradores,
  buscarOrdenCompraPorId,
  guardarBorrador,
  cancelarBorrador as cancelarBorradorEnBD
} from './ordenCompra.repository.js';

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function validarId(valor, nombre) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw errorHttp(`El ID de ${nombre} no es válido.`, 400);
  }
  return id;
}

export async function registrarBorrador(idUsuario) {
  return crearBorrador(idUsuario);
}

export async function obtenerBorradores(estado) {
  if (estado !== undefined && !['BORRADOR', 'EMITIDA', 'CANCELADO', 'CERRADO'].includes(estado)) {
    throw errorHttp('Estado inválido. Usa BORRADOR, EMITIDA, CANCELADO o CERRADO.', 400);
  }
  return listarBorradores(estado ?? null);
}

export async function consultarOrdenCompra(idOrden) {
  const orden = await buscarOrdenCompraPorId(validarId(idOrden, 'orden de compra'));
  if (!orden) throw errorHttp('La orden de compra no existe.', 404);
  return orden;
}

// RN-01 y CA-02: no se exige ningún dato; todo es opcional en un borrador.
export async function actualizarBorrador(idOrden, idProveedor, observacion) {
  const id = validarId(idOrden, 'orden de compra');

  const proveedor = idProveedor === undefined ? undefined : idProveedor === null
    ? null
    : validarId(idProveedor, 'proveedor');

  let texto = observacion === undefined ? undefined : null;
  if (observacion !== undefined && observacion !== null) {
    if (typeof observacion !== 'string' || observacion.length > 500) {
      throw errorHttp('La observación no es válida (máximo 500 caracteres).', 400);
    }
    texto = observacion.trim() === '' ? null : observacion.trim();
  }

  try {
    const resultado = await guardarBorrador(id, proveedor, texto);
    if (resultado.problema?.tipo === 'orden_inexistente') {
      throw errorHttp('La orden de compra no existe.', 404);
    }
    if (resultado.problema?.tipo === 'no_es_borrador') {
      throw errorHttp('Solo se puede guardar una orden en estado Borrador.', 409);
    }
    return resultado.orden;
  } catch (error) {
    if (error.code === '23503') {
      throw errorHttp('El proveedor seleccionado no existe.', 404);
    }
    throw error;
  }
}

export async function cancelarBorrador(idOrden, idUsuario) {
  const id = validarId(idOrden, 'orden de compra');
  const usuario = validarId(idUsuario, 'usuario');
  const resultado = await cancelarBorradorEnBD(id, usuario);
  if (resultado.problema?.tipo === 'orden_inexistente') {
    throw errorHttp('La orden de compra no existe.', 404);
  }
  if (resultado.problema?.tipo === 'no_es_borrador') {
    throw errorHttp('Solo se puede cancelar una solicitud en estado BORRADOR. Actualiza la bandeja.', 409);
  }
  return resultado.orden;
}
