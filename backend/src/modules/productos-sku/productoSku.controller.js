import {
  obtenerProductosSku,
  consultarProductoSku,
  consultarOpcionesSku,
  registrarProductoSku,
  actualizarEstadoProductoSku
} from './productoSku.service.js';

function responderError(res, error, operacion) {
  if ([400, 404, 409].includes(error.status)) {
    return res.status(error.status).json({ mensaje: error.message });
  }
  console.error(`Error al ${operacion} SKU:`, error);
  return res.status(500).json({ mensaje: `No se pudo ${operacion} el producto SKU.` });
}

export async function listarProductosSkuController(req, res) {
  try {
    const productos = await obtenerProductosSku(req.query.q, req.query.estado);
    return res.status(200).json({ productos });
  } catch (error) {
    return responderError(res, error, 'listar');
  }
}

export async function consultarProductoSkuController(req, res) {
  try {
    const producto = await consultarProductoSku(req.params.id);
    return res.status(200).json({ producto });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
}

export async function opcionesSkuController(req, res) {
  try {
    return res.status(200).json(await consultarOpcionesSku());
  } catch (error) {
    return responderError(res, error, 'consultar opciones de');
  }
}

export async function crearProductoSkuController(req, res) {
  try {
    const { id_modelo, id_talla, id_color } = req.body ?? {};
    const producto = await registrarProductoSku(id_modelo, id_talla, id_color);
    return res.status(201).json({ mensaje: 'Producto SKU registrado correctamente.', producto });
  } catch (error) {
    return responderError(res, error, 'registrar');
  }
}

export async function cambiarEstadoProductoSkuController(req, res) {
  try {
    const producto = await actualizarEstadoProductoSku(req.params.id, req.body?.activo);
    return res.status(200).json({
      mensaje: producto.activo ? 'Producto SKU activado correctamente.' : 'Producto SKU desactivado correctamente.',
      producto
    });
  } catch (error) {
    return responderError(res, error, 'cambiar el estado de');
  }
}
