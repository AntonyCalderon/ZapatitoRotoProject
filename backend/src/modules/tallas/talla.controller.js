import { obtenerTallas, registrarTalla, editarTalla, actualizarEstadoTalla } from './talla.service.js';

function responderError(res, error, operacion) {
  if ([400, 404, 409].includes(error.status)) {
    return res.status(error.status).json({ mensaje: error.message });
  }
  if (error.code === '23505') {
    return res.status(409).json({ mensaje: 'Ya existe una talla con ese número.' });
  }
  console.error(`Error al ${operacion} talla:`, error);
  return res.status(500).json({ mensaje: `No se pudo ${operacion} la talla.` });
}

export async function listarTallasController(req, res) {
  try {
    const tallas = await obtenerTallas();
    return res.status(200).json({ tallas });
  } catch (error) {
    return responderError(res, error, 'listar');
  }
}

export async function crearTallaController(req, res) {
  try {
    const talla = await registrarTalla(req.body?.numero_talla);
    return res.status(201).json({ mensaje: 'Talla registrada correctamente.', talla });
  } catch (error) {
    return responderError(res, error, 'registrar');
  }
}

export async function editarTallaController(req, res) {
  try {
    const talla = await editarTalla(req.params.id, req.body?.numero_talla);
    return res.status(200).json({ mensaje: 'Talla actualizada correctamente.', talla });
  } catch (error) {
    return responderError(res, error, 'actualizar');
  }
}

export async function cambiarEstadoTallaController(req, res) {
  try {
    const talla = await actualizarEstadoTalla(req.params.id, req.body?.activo);
    return res.status(200).json({
      mensaje: talla.activo ? 'Talla activada correctamente.' : 'Talla desactivada correctamente.',
      talla
    });
  } catch (error) {
    return responderError(res, error, 'cambiar el estado de');
  }
}
