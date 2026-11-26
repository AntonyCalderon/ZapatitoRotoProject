import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  codigoDespacho, formatearNumero, normalizarDireccion, prepararDocumento, tipoComprobante, validarAnulacion, validarId
} from './comprobante.domain.js';

const venta = {
  tipo_documento: 'RUC', numero_documento: '20123456789', razon_social_nombre: 'Gobierno Regional de prueba', segmento: 'B2G',
  tipo_documento_cliente: 'O/C', numero_documento_cliente: '0045-2026',
  tasa_igv: '0.1800', subtotal: '3120.00', igv: '561.60', total: '3681.60'
};
const lineas = [
  { codigo_sku: 'THR-NEG-40', modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 6, precio_unitario: '260.00', importe: '1560.00', precio_con_igv: '306.80' },
  { codigo_sku: 'THR-NEG-41', modelo: 'Threshold', color: 'Negro', talla: '41.0', cantidad: 6, precio_unitario: '260.00', importe: '1560.00', precio_con_igv: '306.80' }
];

test('RN-02: RUC recibe factura, DNI recibe boleta y una entidad pública nunca recibe boleta', () => {
  assert.deepEqual(tipoComprobante(venta), { tipo: 'Factura', serie: 'F001', correlativo: 'FACTURA' });
  assert.deepEqual(tipoComprobante({ tipo_documento: 'DNI', numero_documento: '12345678', segmento: 'B2C' }),
    { tipo: 'Boleta', serie: 'B001', correlativo: 'BOLETA' });
  for (const cliente of [
    { tipo_documento: 'DNI', numero_documento: '12345678', segmento: 'B2G' },
    { tipo_documento: 'RUC', numero_documento: '1234', segmento: 'B2B' },
    { tipo_documento: 'CE', numero_documento: '12345678', segmento: 'B2C' }
  ]) assert.throws(() => tipoComprobante(cliente), e => e.status === 409 && e.codigo === 'DOCUMENTO_CLIENTE_INVALIDO');
});

test('RN-04: número de 8 dígitos y código de despacho anual', () => {
  assert.equal(formatearNumero(3), '00000003');
  assert.equal(formatearNumero(99_999_999), '99999999');
  for (const n of [0, -1, 1.5, 100_000_000]) assert.throws(() => formatearNumero(n), e => e.codigo === 'SERIE_AGOTADA');
  assert.equal(codigoDespacho(2026, 2), 'OD-2026-002');
  assert.equal(codigoDespacho(2026, 1234), 'OD-2026-1234');
});

test('RN-05: la dirección es obligatoria y se normaliza', () => {
  assert.equal(normalizarDireccion(undefined), null);
  assert.equal(normalizarDireccion(''), null);
  assert.equal(normalizarDireccion('  Av.  de prueba   123  '), 'Av. de prueba 123');
  for (const valor of ['Av', 'x'.repeat(256), 123, {}]) {
    assert.throws(() => normalizarDireccion(valor), e => e.status === 400 && e.codigo === 'DIRECCION_INVALIDA');
  }
  assert.throws(() => prepararDocumento(venta, lineas, null), e => e.status === 400 && e.codigo === 'DIRECCION_REQUERIDA');
});

test('RN-06: el documento copia los montos congelados de la venta, sin costos', () => {
  const documento = prepararDocumento(venta, lineas, 'Av. de prueba 123');
  assert.deepEqual(documento.cliente, {
    tipo_documento: 'RUC', numero_documento: '20123456789', nombre: 'Gobierno Regional de prueba', direccion: 'Av. de prueba 123'
  });
  assert.deepEqual(documento.documento_respaldo, { tipo: 'O/C', numero: '0045-2026' });
  assert.deepEqual([documento.subtotal, documento.igv, documento.total, documento.moneda], ['3120.00', '561.60', '3681.60', 'PEN']);
  assert.equal(documento.lineas.length, 2);
  assert.equal('precio_con_igv' in documento.lineas[0], false);
  assert.equal(JSON.stringify(documento).includes('costo'), false);
});

test('no emite si faltan productos o importes de la venta', () => {
  assert.throws(() => prepararDocumento(venta, [], 'Av. de prueba 123'), e => e.codigo === 'VENTA_SIN_PRODUCTOS');
  assert.throws(() => prepararDocumento({ ...venta, total: null }, lineas, 'Av. de prueba 123'), e => e.codigo === 'MONTOS_PENDIENTES');
  assert.throws(() => prepararDocumento(venta, [{ ...lineas[0], importe: null }], 'Av. de prueba 123'), e => e.codigo === 'MONTOS_PENDIENTES');
});

test('la anulación exige un motivo del catálogo y un sustento', () => {
  assert.deepEqual(validarAnulacion({ motivo: '02', sustento: '  RUC   equivocado  ' }), { motivo: '02', sustento: 'RUC equivocado' });
  for (const cuerpo of [undefined, {}, { motivo: '04', sustento: 'Motivo válido' }, { motivo: 2, sustento: 'Motivo válido' }]) {
    assert.throws(() => validarAnulacion(cuerpo), e => e.status === 400 && e.codigo === 'MOTIVO_INVALIDO');
  }
  for (const sustento of [undefined, 'abc', 'x'.repeat(251)]) {
    assert.throws(() => validarAnulacion({ motivo: '01', sustento }), e => e.status === 400 && e.codigo === 'SUSTENTO_INVALIDO');
  }
});

test('valida identificadores antes de consultar', () => {
  assert.equal(validarId('18'), 18);
  for (const valor of ['0', '-1', '1.5', '1x', '05', '2147483648']) {
    assert.throws(() => validarId(valor), e => e.status === 400 && e.codigo === 'VENTA_INVALIDA');
  }
});
