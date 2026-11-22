import { consultarExistencias, consultarCatalogo, consultarKardex } from './inventario.service.js';

function responderError(res, error) {
  if (error.status === 400 || error.status === 404) {
    return res.status(error.status).json({ codigo: error.codigo, mensaje: error.message });
  }
  console.error('Error al consultar inventario:', error);
  return res.status(500).json({ codigo: 'INVENTARIO_ERROR', mensaje: 'No se pudo consultar el inventario.' });
}

export async function listarExistenciasController(req, res) {
  try {
    return res.json(await consultarExistencias(req.query));
  } catch (error) { return responderError(res, error); }
}

export async function consultarCatalogoController(req, res) {
  try {
    return res.json(await consultarCatalogo(req.query));
  } catch (error) { return responderError(res, error); }
}

export async function consultarKardexController(req, res) {
  try {
    return res.json(await consultarKardex(req.params.skuId, req.query));
  } catch (error) { return responderError(res, error); }
}
