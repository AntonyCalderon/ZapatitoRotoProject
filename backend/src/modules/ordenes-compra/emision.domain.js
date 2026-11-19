import { createHash } from 'node:crypto';
import { calcularCostoAdquisicion } from '../compras/calculoCostoAdquisicion.js';

export function validarOrigenes(origenes = []) {
  if (!Array.isArray(origenes) || origenes.some(origen =>
    !origen || !['Pedido', 'Contrato', 'Licitacion', 'Reposicion'].includes(origen.tipo) ||
    typeof origen.referencia !== 'string' || origen.referencia.trim().length > 80 ||
    (origen.tipo !== 'Reposicion' && !origen.referencia.trim()))) {
    throw Object.assign(new Error('Indica el tipo y la referencia de cada origen.'), { status: 400 });
  }
  return origenes.map(({ tipo, referencia }) => ({ tipo, referencia: referencia.trim() || null }));
}

export function prepararRevision(proveedor, lineas, minimo) {
  const avisos = [];
  const pares = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  if (!proveedor?.razon_social?.trim() || !proveedor.ruc?.trim() || !proveedor.direccion?.trim())
    avisos.push('Completa la razón social, el RUC y la dirección del proveedor.');
  if (!lineas.length) avisos.push('Agrega productos al borrador.');
  if (!Number.isSafeInteger(minimo) || minimo < 1) avisos.push('Revisa la configuración del lote mínimo.');
  else if (pares < minimo) avisos.push(`Se requieren al menos ${minimo} pares. Hay ${pares}.`);
  for (const linea of lineas) {
    if (!linea.activo) avisos.push(`El producto ${linea.codigo_sku} está inactivo.`);
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) avisos.push(`Revisa la cantidad de ${linea.codigo_sku}.`);
    if (!(Number(linea.costo) > 0)) avisos.push(`Falta el costo vigente de ${linea.codigo_sku}.`);
    else if (Number(linea.costo) >= 100000000) avisos.push(`El costo de ${linea.codigo_sku} supera el máximo por par.`);
  }
  const costos = avisos.length ? null : calcularCostoAdquisicion(
    lineas.map(l => ({ cantidad: l.cantidad, costoUnitario: l.costo })));
  if (costos && Number(costos.total) >= 1e10) avisos.push('El importe supera el máximo de la orden.');
  const revision = { proveedor, pares, minimo, avisos,
    lineas: lineas.map((l,i) => ({ ...l, importe: costos?.lineas[i].importe ?? null })),
    subtotal: costos?.subtotalConocido ?? null,
    total: avisos.length ? null : costos.total };
  const version = createHash('sha256').update(JSON.stringify(revision)).digest('hex');
  return { ...revision, version };
}
