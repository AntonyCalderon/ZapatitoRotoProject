/*
Responsabilidad: recibir las peticiones HTTP, llamar al servicio y responder en JSON.
*/

import { obtenerMargenes, registrarMargen } from './margen.service.js';

// GET /api/margenes
export async function listarMargenesController(req, res) {
  try {
    const margenes = await obtenerMargenes();
    return res.status(200).json({ margenes });
  } catch (error) {
    console.error('Error al listar márgenes:', error.message);
    return res.status(500).json({ mensaje: 'No se pudieron obtener los márgenes.' });
  }
}

// PUT /api/margenes/:segmento
export async function guardarMargenController(req, res) {
  try {
    const { porcentaje } = req.body ?? {};
    const segmento = String(req.params.segmento).toUpperCase();

    // El usuario sale de la sesión, nunca del cliente (RN-06).
    const margen = await registrarMargen(segmento, porcentaje, req.session.idUsuario);

    return res.status(200).json({ mensaje: 'Margen guardado correctamente.', margen });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ mensaje: error.message });
    }

    console.error('Error al guardar margen:', error.message);
    return res.status(500).json({ mensaje: 'No se pudo guardar el margen.' });
  }
}