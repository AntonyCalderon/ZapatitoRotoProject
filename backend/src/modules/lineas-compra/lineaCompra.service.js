/*
@file lineaCompra.service.js
@description Casos de uso de HU02: seleccionar modelos, colores y tallas dentro de un borrador de compra.

Depende de un repositorio recibido por parámetro y no de PostgreSQL directamente,
así se puede probar con un repositorio falso y cambiar la fuente de datos sin tocar la lógica.
*/

import * as repositorioPostgres from './lineaCompra.repository.js';
import {
  errorHttp,
  validarEntero,
  consolidarLineas,
  contarPares,
  resumirPorModelo
} from './lineaCompra.domain.js';

// RN-08: el resumen calcula pares por modelo y total general, no el costo.
function armarResumen(lineas) {
  return {
    lineas,
    total_pares: contarPares(lineas),
    pares_por_modelo: resumirPorModelo(lineas)
  };
}

function verificarProblema(problema) {
  if (!problema) return;

  if (problema.tipo === 'detalle_no_agregado') {
    throw errorHttp('No se pudo agregar el lote: hay productos no disponibles o se supera el máximo de pares por línea.', 409);
  }
  if (problema.tipo === 'orden_inexistente') {
    throw errorHttp('La orden de compra no existe.', 404);
  }
  if (problema.tipo === 'no_es_borrador') {
    throw errorHttp('Solo se pueden modificar las líneas de una orden en estado Borrador.', 409);
  }
  throw errorHttp(`Los SKU ${problema.ids.join(', ')} no existen o no están disponibles para comprar.`, 409);
}

export function crearServicioLineasCompra(repositorio) {
  async function consultarModelos() {
    return repositorio.listarModelosConSku();
  }

  async function consultarColores(idModelo) {
    const modelo = validarEntero(idModelo, 'El modelo');
    return repositorio.listarColoresPorModelo(modelo);
  }

  // Devuelve las tallas con SKU disponible para armar la cuadrícula de cantidades.
  async function consultarTallas(idModelo, idColor) {
    const modelo = validarEntero(idModelo, 'El modelo');
    const color = validarEntero(idColor, 'El color');
    return repositorio.listarTallasPorModeloYColor(modelo, color);
  }

  async function consultarLineasBorrador(idOrden) {
    const orden = validarEntero(idOrden, 'La orden de compra');
    const resultado = await repositorio.obtenerLineasDeOrden(orden);

    if (!resultado) throw errorHttp('La orden de compra no existe.', 404);

    return { estado: resultado.estado, ...armarResumen(resultado.lineas) };
  }

  /*
  Guarda manualmente las líneas del borrador. Valida las cantidades antes de abrir
  la transacción y suma los pedidos repetidos de un mismo SKU en una sola línea.
  */
  async function guardarLineasBorrador(idOrden, lineasSolicitadas) {
    const orden = validarEntero(idOrden, 'La orden de compra');
    const lineas = consolidarLineas(lineasSolicitadas);

    const resultado = await repositorio.reemplazarLineas(orden, lineas);
    verificarProblema(resultado.problema);

    return armarResumen(resultado.lineas);
  }

  async function agregarDetallesBorrador(idOrden, solicitadas) {
    const orden = validarEntero(idOrden, 'La orden de compra');
    if (!Array.isArray(solicitadas) || solicitadas.length === 0) throw errorHttp('Indica al menos una línea.', 400);
    for (const linea of solicitadas) {
      if (!linea || !Number.isSafeInteger(Number(linea.cantidad)) || Number(linea.cantidad) <= 0) {
        throw errorHttp('La cantidad debe ser un entero positivo.', 400);
      }
    }
    const lineas = consolidarLineas(solicitadas);
    const resultado = await repositorio.agregarDetalles(orden, lineas);
    verificarProblema(resultado.problema);
    return armarResumen(resultado.lineas);
  }

  async function consultarCatalogo() {
    return repositorio.listarCatalogoCompra();
  }

  return {
    consultarCatalogo,
    agregarDetallesBorrador,
    consultarModelos,
    consultarColores,
    consultarTallas,
    consultarLineasBorrador,
    guardarLineasBorrador
  };
}

export const servicioLineasCompra = crearServicioLineasCompra(repositorioPostgres);
