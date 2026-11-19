import {
  registrarBorrador,
  obtenerBorradores,
  consultarOrdenCompra,
  actualizarBorrador
} from './ordenCompra.service.js';

function responderError(res, error, operacion) {
  if ([400, 404, 409].includes(error.status)) {
    return res.status(error.status).json({ mensaje: error.message });
  }
  console.error(`Error al ${operacion} el borrador:`, error);
  return res.status(500).json({ mensaje: `No se pudo ${operacion} el borrador.` });
}

export async function crearBorradorController(req, res) {
  try {
    const orden = await registrarBorrador(req.session.idUsuario);
    return res.status(201).json({ mensaje: 'Borrador creado correctamente.', orden });
  } catch (error) {
    return responderError(res, error, 'crear');
  }
}

export async function listarBorradoresController(req, res) {
  try {
    const borradores = await obtenerBorradores(req.query.estado);
    return res.status(200).json({ borradores });
  } catch (error) {
    return responderError(res, error, 'listar');
  }
}

export async function consultarOrdenCompraController(req, res) {
  try {
    const orden = await consultarOrdenCompra(req.params.id);
    return res.status(200).json({ orden });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
}

export async function guardarBorradorController(req, res) {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ mensaje: 'Envía un objeto JSON con los datos del borrador.' });
    }
    const { id_proveedor, observacion } = req.body;
    const orden = await actualizarBorrador(req.params.id, id_proveedor, observacion);
    return res.status(200).json({ mensaje: 'Borrador guardado correctamente.', orden });
  } catch (error) {
    return responderError(res, error, 'guardar');
  }
}
