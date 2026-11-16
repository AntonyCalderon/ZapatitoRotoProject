import { randomUUID } from 'node:crypto';
import {
  listarProductosSku,
  buscarProductoSkuPorId,
  obtenerOpcionesSku,
  crearProductoSku,
  cambiarEstadoProductoSku
} from './productoSku.repository.js';

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function validarId(valor, nombre) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw errorHttp(`El ID de ${nombre} no es válido.`, 400);
  }
  return id;
}

function verificarProblema(problema) {
  if (!problema) return;
  if (problema.tipo === 'sku_inexistente') {
    throw errorHttp('El producto SKU no existe.', 404);
  }
  if (problema.tipo === 'inexistente') {
    throw errorHttp(`El ${problema.componente} seleccionado no existe.`, 404);
  }
  throw errorHttp(`El ${problema.componente} seleccionado está inactivo.`, 409);
}

export async function obtenerProductosSku(busqueda = '', estado = 'todos') {
  if (typeof busqueda !== 'string' || busqueda.length > 100) {
    throw errorHttp('La búsqueda no es válida.', 400);
  }
  if (!['todos', 'activos', 'inactivos'].includes(estado)) {
    throw errorHttp('El filtro de estado no es válido.', 400);
  }
  return listarProductosSku(busqueda.trim(), estado);
}

export async function consultarProductoSku(idSku) {
  const producto = await buscarProductoSkuPorId(validarId(idSku, 'SKU'));
  if (!producto) throw errorHttp('El producto SKU no existe.', 404);
  return producto;
}

export async function consultarOpcionesSku() {
  return obtenerOpcionesSku();
}

export async function registrarProductoSku(idModelo, idTalla, idColor) {
  const modelo = validarId(idModelo, 'modelo');
  const talla = validarId(idTalla, 'talla');
  const color = validarId(idColor, 'color');

  // UUID v4 cabe en VARCHAR(50). La base garantiza unicidad y permite reintentar.
  for (let intento = 0; intento < 3; intento += 1) {
    const codigo = `SKU-${randomUUID()}`;
    try {
      const resultado = await crearProductoSku(modelo, talla, color, codigo);
      verificarProblema(resultado.problema);
      return resultado.producto;
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uq_sku_variante') {
        throw errorHttp('Ya existe un SKU para esta combinación de modelo, talla y color.', 409);
      }
      if (error.code === '23505' && error.constraint === 'producto_sku_codigo_sku_key') {
        if (intento < 2) continue;
        throw errorHttp('No se pudo generar un código SKU único tras tres intentos.', 409);
      }
      throw error;
    }
  }
}

export async function actualizarEstadoProductoSku(idSku, activo) {
  const id = validarId(idSku, 'SKU');
  if (typeof activo !== 'boolean') {
    throw errorHttp('El estado debe ser true o false.', 400);
  }
  const resultado = await cambiarEstadoProductoSku(id, activo);
  verificarProblema(resultado.problema);
  return resultado.producto;
}
