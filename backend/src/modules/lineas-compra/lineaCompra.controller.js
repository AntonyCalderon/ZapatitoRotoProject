/*
@file lineaCompra.controller.js
@description Traduce las peticiones HTTP de HU02 en llamadas al servicio y devuelve JSON.
*/

import { servicioLineasCompra } from './lineaCompra.service.js';

function responderError(res, error, operacion) {
  if ([400, 404, 409].includes(error.status)) {
    return res.status(error.status).json({ mensaje: error.message });
  }

  console.error(`Error al ${operacion}:`, error);
  return res.status(500).json({ mensaje: `No se pudo ${operacion}.` });
}

export async function listarModelosController(req, res) {
  try {
    const modelos = await servicioLineasCompra.consultarModelos();
    return res.status(200).json({ modelos });
  } catch (error) {
    return responderError(res, error, 'consultar los modelos');
  }
}

export async function listarColoresController(req, res) {
  try {
    const colores = await servicioLineasCompra.consultarColores(req.params.idModelo);
    return res.status(200).json({ colores });
  } catch (error) {
    return responderError(res, error, 'consultar los colores');
  }
}

export async function listarTallasController(req, res) {
  try {
    const tallas = await servicioLineasCompra.consultarTallas(req.params.idModelo, req.params.idColor);
    return res.status(200).json({ tallas });
  } catch (error) {
    return responderError(res, error, 'consultar las tallas');
  }
}

export async function consultarLineasController(req, res) {
  try {
    const resultado = await servicioLineasCompra.consultarLineasBorrador(req.params.idOrden);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderError(res, error, 'consultar las líneas del borrador');
  }
}

export async function guardarLineasController(req, res) {
  try {
    const resultado = await servicioLineasCompra.guardarLineasBorrador(req.params.idOrden, req.body?.lineas);
    return res.status(200).json({ mensaje: 'Líneas guardadas correctamente.', ...resultado });
  } catch (error) {
    return responderError(res, error, 'guardar las líneas del borrador');
  }
}

export async function agregarDetallesController(req, res) {
  try {
    const solicitadas = req.body?.lineas ?? [req.body];
    const resultado = await servicioLineasCompra.agregarDetallesBorrador(req.params.id, solicitadas);
    return res.status(201).json({ mensaje: 'Líneas guardadas correctamente.', ...resultado });
  } catch (error) { return responderError(res, error, 'agregar detalles'); }
}

export async function consultarDetallesController(req, res) {
  try {
    return res.json(await servicioLineasCompra.consultarLineasBorrador(req.params.id));
  } catch (error) { return responderError(res, error, 'consultar detalles'); }
}

export async function consultarCatalogoController(req, res) {
  try { return res.status(200).json(await servicioLineasCompra.consultarCatalogo()); }
  catch (error) { return responderError(res, error, 'consultar el catálogo de compra'); }
}


export async function modificarCantidadDetalleController(req, res) {
  try {
    const resultado = await servicioLineasCompra.modificarCantidadDetalle(req.params.id, req.params.detalleId, req.body?.cantidad, req.body?.cantidad_anterior);
    return res.json({ mensaje: 'Cantidad actualizada correctamente.', ...resultado });
  } catch (error) { return responderError(res, error, 'modificar la cantidad'); }
}

export async function quitarDetalleController(req, res) {
  try {
    const resultado = await servicioLineasCompra.quitarDetalle(req.params.id, req.params.detalleId);
    return res.json({ mensaje: 'Línea retirada correctamente.', ...resultado });
  } catch (error) { return responderError(res, error, 'quitar la línea del borrador'); }
}
