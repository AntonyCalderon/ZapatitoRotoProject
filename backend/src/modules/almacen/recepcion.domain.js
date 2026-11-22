import { createHash } from 'node:crypto';

export const errorRecepcion = (status, mensaje, codigo = 'RECEPCION_INVALIDA') =>
  Object.assign(new Error(mensaje), { status, codigo });

export function idRecepcion(valor) {
  const texto = String(valor ?? '');
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) > 2147483647)
    throw errorRecepcion(400, 'El identificador de orden no es válido.');
  return Number(texto);
}

export function validarVerificacion(idOrden, usuario, cuerpo, clave) {
  const id = idRecepcion(idOrden);
  if (typeof clave !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clave))
    throw errorRecepcion(400, 'La confirmación requiere una clave de idempotencia UUID válida.');
  const lineas = cuerpo?.lineas;
  if (!Array.isArray(lineas) || !lineas.length || lineas.length > 1000)
    throw errorRecepcion(400, 'Debes verificar todas las líneas de la compra.');
  const verificadas = lineas.map(l => {
    if (!l || l.verificado !== true || !Number.isInteger(l.id_detalle_compra) || l.id_detalle_compra < 1 || l.id_detalle_compra > 2147483647
      || !Number.isInteger(l.cantidad_recibida) || l.cantidad_recibida < 1 || l.cantidad_recibida > 100000)
      throw errorRecepcion(400, 'Cada línea debe estar verificada y tener identificador y cantidad válidos.');
    return { id_detalle_compra: l.id_detalle_compra, cantidad_recibida: l.cantidad_recibida };
  }).sort((a, b) => a.id_detalle_compra - b.id_detalle_compra);
  if (new Set(verificadas.map(l => l.id_detalle_compra)).size !== verificadas.length)
    throw errorRecepcion(400, 'No se puede verificar dos veces la misma línea.');
  const huella = createHash('sha256').update(JSON.stringify({ id, usuario, lineas: verificadas })).digest('hex');
  return { id, usuario, lineas: verificadas, clave: clave.toLowerCase(), huella };
}
