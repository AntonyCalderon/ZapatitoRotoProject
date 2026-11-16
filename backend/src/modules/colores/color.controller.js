import { obtenerColores, registrarColor, editarColor, actualizarEstadoColor } from './color.service.js';

function responderError(res, error, operacion) {
  if ([400, 404, 409].includes(error.status)) {
    return res.status(error.status).json({ mensaje: error.message });
  }
  if (error.code === '23505') {
    return res.status(409).json({ mensaje: 'Ya existe un color con ese nombre.' });
  }
  console.error(`Error al ${operacion} color:`, error);
  return res.status(500).json({ mensaje: `No se pudo ${operacion} el color.` });
}

export async function listarColoresController(req, res) {
  try {
    return res.status(200).json({ colores: await obtenerColores() });
  } catch (error) {
    return responderError(res, error, 'listar');
  }
}

export async function crearColorController(req, res) {
  try {
    const color = await registrarColor(req.body?.nombre_color);
    return res.status(201).json({ mensaje: 'Color registrado correctamente.', color });
  } catch (error) {
    return responderError(res, error, 'registrar');
  }
}

export async function editarColorController(req, res) {
  try {
    const color = await editarColor(req.params.id, req.body?.nombre_color);
    return res.status(200).json({ mensaje: 'Color actualizado correctamente.', color });
  } catch (error) {
    return responderError(res, error, 'actualizar');
  }
}

export async function cambiarEstadoColorController(req, res) {
  try {
    const color = await actualizarEstadoColor(req.params.id, req.body?.activo);
    return res.status(200).json({
      mensaje: color.activo ? 'Color activado correctamente.' : 'Color desactivado correctamente.',
      color
    });
  } catch (error) {
    return responderError(res, error, 'cambiar el estado de');
  }
}
