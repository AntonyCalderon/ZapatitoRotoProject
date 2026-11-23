// Reglas puras de la salida física: sin SQL ni HTTP.

export function errorSalida(status, mensaje, codigo, extra = {}) {
  return Object.assign(new Error(mensaje), { status, codigo, ...extra });
}

export function validarIdDespacho(valor) {
  const texto = String(valor);
  const id = Number(texto);
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(id) || id > 2_147_483_647) {
    throw errorSalida(400, 'El despacho indicado no es válido.', 'DESPACHO_INVALIDO');
  }
  return id;
}

// Compara lo pedido con el stock físico y devuelve los SKU que no alcanzan (CA-03).
export function calcularFaltantes(lineas, saldos) {
  return lineas
    .map(linea => {
      const disponible = saldos.get(linea.id_sku) ?? 0;
      return {
        id_sku: linea.id_sku,
        codigo_sku: linea.codigo_sku,
        requerido: linea.cantidad,
        disponible,
        falta: linea.cantidad - disponible
      };
    })
    .filter(item => item.falta > 0);
}

export function mensajeFaltantes(faltantes) {
  const detalle = faltantes
    .map(f => `${f.codigo_sku}: se necesitan ${f.requerido}, hay ${f.disponible} (faltan ${f.falta})`)
    .join('; ');
  return `No hay stock suficiente para registrar la salida. ${detalle}.`;
}