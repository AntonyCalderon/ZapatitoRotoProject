import { calcularCostoAdquisicion } from './calculoCostoAdquisicion.js';
import { consultarCostosVigentesPorSku } from './costoAdquisicion.repository.js';

const ID_SKU_MAXIMO = 2_147_483_647;

export async function resumirCostoAdquisicion(conexion, lineas, tasaIgv) {
  if (!Array.isArray(lineas)) {
    throw new TypeError('Las líneas del borrador deben enviarse en una lista.');
  }

  const idsSku = lineas.map((linea) => {
    const idSku = linea?.idSku;
    if (!Number.isInteger(idSku) || idSku < 1 || idSku > ID_SKU_MAXIMO) {
      throw new RangeError('El ID del producto SKU no es válido.');
    }
    return idSku;
  });

  const costosVigentes = await consultarCostosVigentesPorSku(conexion, [...new Set(idsSku)]);
  const costoPorSku = new Map(costosVigentes.map((fila) => [fila.id_sku, fila.costo_unitario]));

  const lineasConCosto = lineas.map(({ idSku, cantidad }) => {
    if (!costoPorSku.has(idSku)) {
      throw new RangeError(`El producto SKU ${idSku} no existe.`);
    }
    return { idSku, cantidad, costoUnitario: costoPorSku.get(idSku) };
  });

  return calcularCostoAdquisicion(lineasConCosto, tasaIgv);
}
