import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularCostoAdquisicion } from './calculoCostoAdquisicion.js';

test('calcula el ejemplo de HU03 y recalcula al cambiar la cantidad', () => {
  const calcular = (cantidad) => calcularCostoAdquisicion([{ cantidad, costoUnitario: '180.00' }]);
  assert.deepEqual(calcular(12), {
    lineas: [{ cantidad: 12, costoUnitario: '180.00', importe: '2160.00' }],
    subtotalConocido: '2160.00',
    total: '2160.00'
  });
  assert.equal(calcular(13).total, '2340.00');
});

test('conserva los importes conocidos mientras falta un costo', () => {
  const resultado = calcularCostoAdquisicion([
    { idSku: 10, cantidad: 2, costoUnitario: '180.00' },
    { idSku: 11, cantidad: 3, costoUnitario: null }
  ]);

  assert.deepEqual(resultado.lineas.map((linea) => linea.importe), ['360.00', null]);
  assert.equal(resultado.subtotalConocido, '360.00');
  assert.equal(resultado.total, null);
});

test('rechaza costos inválidos antes de calcular', () => {
  for (const costoUnitario of ['0', '0.00', '-5', 'abc', '180.001']) {
    assert.throws(() => calcularCostoAdquisicion([{ cantidad: 1, costoUnitario }]), RangeError);
  }
});

test('suma los costos finales con exactitud de centavos, sin recargo', () => {
  const resultado = calcularCostoAdquisicion([
    { cantidad: 1, costoUnitario: '0.02' },
    { cantidad: 1, costoUnitario: '0.03' }
  ]);

  assert.equal(resultado.subtotalConocido, '0.05');
  assert.equal(resultado.total, '0.05');
});
