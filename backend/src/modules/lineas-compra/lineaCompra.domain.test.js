import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCantidad, consolidarLineas, contarPares, resumirPorModelo } from './lineaCompra.domain.js';

test('acepta cantidades enteras mayores o iguales a cero', () => {
  assert.equal(validarCantidad(12), 12);
  assert.equal(validarCantidad('6'), 6);
  assert.equal(validarCantidad(0), 0);

  for (const invalida of [-1, 1.5, 'abc', '', null, undefined, NaN, Infinity]) {
    assert.throws(() => validarCantidad(invalida), { status: 400 });
  }
});

test('rechaza cantidades que superan el máximo permitido por línea', () => {
  assert.throws(() => validarCantidad(100001), { status: 400 });
});

test('consolida en una sola línea los pedidos repetidos del mismo SKU', () => {
  const lineas = consolidarLineas([
    { id_sku: 5, cantidad: 4 },
    { id_sku: 7, cantidad: 2 },
    { id_sku: 5, cantidad: 8 }
  ]);

  assert.deepEqual(lineas, [
    { id_sku: 5, cantidad: 12 },
    { id_sku: 7, cantidad: 2 }
  ]);
});

test('una talla con cantidad cero no se guarda como línea', () => {
  assert.deepEqual(consolidarLineas([{ id_sku: 1, cantidad: 0 }, { id_sku: 2, cantidad: 3 }]), [{ id_sku: 2, cantidad: 3 }]);
});

test('una lista vacía es válida y significa que el borrador no tiene líneas', () => {
  assert.deepEqual(consolidarLineas([]), []);
  assert.deepEqual(consolidarLineas([{ id_sku: 1, cantidad: 0 }]), []);
});

test('no modifica el arreglo recibido', () => {
  const original = [{ id_sku: 1, cantidad: 1 }, { id_sku: 1, cantidad: 2 }];
  consolidarLineas(original);
  assert.deepEqual(original, [{ id_sku: 1, cantidad: 1 }, { id_sku: 1, cantidad: 2 }]);
});

test('rechaza una solicitud que no es una lista', () => {
  for (const invalida of [undefined, null, 'texto', {}, 5]) {
    assert.throws(() => consolidarLineas(invalida), { status: 400 });
  }
});

test('rechaza líneas con SKU inválido o cantidad inválida', () => {
  assert.throws(() => consolidarLineas([{ id_sku: 0, cantidad: 1 }]), { status: 400 });
  assert.throws(() => consolidarLineas([{ id_sku: 'x', cantidad: 1 }]), { status: 400 });
  assert.throws(() => consolidarLineas([{ id_sku: 3, cantidad: -1 }]), { status: 400 });
  assert.throws(() => consolidarLineas([{ id_sku: 3, cantidad: 1.5 }]), { status: 400 });
  assert.throws(() => consolidarLineas([null]), { status: 400 });
});

test('cuenta el total de pares de las líneas', () => {
  assert.equal(contarPares([{ cantidad: 12 }, { cantidad: 6 }]), 18);
  assert.equal(contarPares([]), 0);
});

test('resume los pares por modelo conservando el orden de aparición', () => {
  const resumen = resumirPorModelo([
    { nombre_modelo: 'Threshold', cantidad: 12 },
    { nombre_modelo: 'Colorado', cantidad: 6 },
    { nombre_modelo: 'Threshold', cantidad: 4 }
  ]);

  assert.deepEqual(resumen, [
    { nombre_modelo: 'Threshold', pares: 16 },
    { nombre_modelo: 'Colorado', pares: 6 }
  ]);
});
