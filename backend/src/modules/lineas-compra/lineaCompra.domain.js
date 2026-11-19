/*
@file lineaCompra.domain.js
@description Reglas puras de las líneas de una solicitud de compra (HU02).

No usa Express ni PostgreSQL, por eso se puede probar sin infraestructura.
Una línea representa un SKU (modelo, color y talla) y la cantidad de pares que se pide.
*/

export const CANTIDAD_MAXIMA_POR_LINEA = 100000;

export function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

// Acepta números o textos numéricos. Un texto vacío no es un número.
function aNumero(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
}

// Identificadores: enteros mayores que cero.
export function validarEntero(valor, nombre) {
  const numero = aNumero(valor);

  if (typeof numero !== 'number' || !Number.isSafeInteger(numero) || numero <= 0) {
    throw errorHttp(`${nombre} debe ser un número entero mayor que cero.`, 400);
  }

  return numero;
}

// RN-04: las cantidades son enteros mayores o iguales a cero.
export function validarCantidad(valor) {
  const cantidad = aNumero(valor);

  if (typeof cantidad !== 'number' || !Number.isSafeInteger(cantidad) || cantidad < 0) {
    throw errorHttp('La cantidad debe ser un número entero mayor o igual a cero.', 400);
  }

  if (cantidad > CANTIDAD_MAXIMA_POR_LINEA) {
    throw errorHttp(`La cantidad no puede superar ${CANTIDAD_MAXIMA_POR_LINEA} pares por línea.`, 400);
  }

  return cantidad;
}

/*
Valida cada línea y suma en una sola las que comparten SKU (RN-05 y RN-07).
Las líneas con total cero se descartan porque no se guardan (RN-04).
Una lista vacía es válida: representa un borrador sin productos.
Devuelve un arreglo nuevo y conserva el orden de la primera aparición de cada SKU.
*/
export function consolidarLineas(lineas) {
  if (!Array.isArray(lineas)) {
    throw errorHttp('Las líneas deben enviarse como una lista.', 400);
  }

  const acumulado = new Map();

  for (const linea of lineas) {
    if (linea === null || typeof linea !== 'object') {
      throw errorHttp('Cada línea debe indicar el SKU y la cantidad.', 400);
    }

    const idSku = validarEntero(linea.id_sku, 'El SKU');
    const cantidad = validarCantidad(linea.cantidad);
    const total = (acumulado.get(idSku) ?? 0) + cantidad;

    if (total > CANTIDAD_MAXIMA_POR_LINEA) {
      throw errorHttp(`La cantidad consolidada del SKU ${idSku} supera ${CANTIDAD_MAXIMA_POR_LINEA} pares.`, 400);
    }

    acumulado.set(idSku, total);
  }

  return [...acumulado]
    .filter(([, cantidad]) => cantidad > 0)
    .map(([id_sku, cantidad]) => ({ id_sku, cantidad }));
}

export function contarPares(lineas) {
  return lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
}

// RN-08: pares por modelo, en el orden en que aparece cada modelo.
export function resumirPorModelo(lineas) {
  const porModelo = new Map();

  for (const linea of lineas) {
    porModelo.set(linea.nombre_modelo, (porModelo.get(linea.nombre_modelo) ?? 0) + linea.cantidad);
  }

  return [...porModelo].map(([nombre_modelo, pares]) => ({ nombre_modelo, pares }));
}
