import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularCostoAdquisicion } from './calculoCostoAdquisicion.js';

test('calcula el ejemplo de HU03 y recalcula al cambiar la cantidad', () => {
  const calcular = (cantidad) => calcularCostoAdquisicion([{ cantidad, costoUnitario: '180.00' }], '0.18');
  assert.deepEqual(calcular(12), {
    lineas: [{ cantidad: 12, costoUnitario: '180.00', importe: '2160.00' }],
    subtotalConocido: '2160.00',
    igv: '388.80',
    total: '2548.80'
  });
  assert.equal(calcular(13).total, '2761.20');
});

test('conserva los importes conocidos mientras falta un costo', () => {
  const resultado = calcularCostoAdquisicion([
    { idSku: 10, cantidad: 2, costoUnitario: '180.00' },
    { idSku: 11, cantidad: 3, costoUnitario: null }
  ], '0.18');

  assert.deepEqual(resultado.lineas.map((linea) => linea.importe), ['360.00', null]);
  assert.equal(resultado.subtotalConocido, '360.00');
  assert.equal(resultado.igv, null);
  assert.equal(resultado.total, null);
});

test('rechaza costos inválidos antes de calcular', () => {
  for (const costoUnitario of ['0', '0.00', '-5', 'abc', '180.001']) {
    assert.throws(() => calcularCostoAdquisicion([{ cantidad: 1, costoUnitario }], '0.18'), RangeError);
  }
});

test('aplica la tasa recibida al subtotal completo y redondea los medios centavos', () => {
  const resultado = calcularCostoAdquisicion([
    { cantidad: 1, costoUnitario: '0.02' },
    { cantidad: 1, costoUnitario: '0.03' }
  ], '0.1000');

  assert.equal(resultado.subtotalConocido, '0.05');
  assert.equal(resultado.igv, '0.01');
  assert.equal(resultado.total, '0.06');
});
