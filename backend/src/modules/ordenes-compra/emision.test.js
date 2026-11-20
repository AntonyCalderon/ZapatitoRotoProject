import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararRevision, validarOrigenes } from './emision.domain.js';
import { pdfOrden } from './ordenPdf.js';

const proveedor = { razon_social: 'Proveedor (Lima)', ruc: '20123456789', direccion: 'Av. Perú 10' };
const producto = { codigo_sku: 'CAT-01', activo: true, cantidad: 12, costo: '12.34',
  anterior: '11.00', importe: '148.08', nombre_modelo: 'Bota', nombre_color: 'Negro', numero_talla: '42' };

test('consolida solo referencias válidas y admite reposición sin referencia', () => {
  assert.deepEqual(validarOrigenes([{tipo:'Reposicion', referencia:''}]), [{tipo:'Reposicion', referencia:null}]);
  assert.throws(() => validarOrigenes([{tipo:'Contrato', referencia:' '}]), {status:400});
  assert.throws(() => validarOrigenes(null), {status:400});
});

test('12 pares con costos vigentes y con IGV', () => {
  const r = prepararRevision(proveedor, [producto], 12, '0.18');
  assert.deepEqual(r.avisos, []);
  assert.equal(r.subtotal,'148.08');
  assert.equal(r.igv,'26.65');
  assert.equal(r.total,'174.73');
  assert.notEqual(r.version, prepararRevision(proveedor, [{ ...producto, costo:'13.00', importe:'156.00' }],12,'0.18').version);
});
test('informa los requisitos pendientes y respeta el mínimo configurable', () => {
  const r = prepararRevision(null, [{ ...producto, activo:false, costo:null, importe:null }], 13, '0.18');
  assert.equal(r.total,null);
  assert.equal(r.avisos.length,4);
  assert.match(prepararRevision(proveedor, [],12,'0.18').avisos.join(' '), /Agrega productos/);
});
test('PDF multipágina conserva importes y excluye información interna', () => {
  const orden = {codigo:'OC-2026-001', fecha:'19/11/2026', total:'14808.00',
    documento_emitido:{ proveedor, pares:1200, lineas:Array(100).fill(producto), contrato:'PRIVADO' }};
  const pdf = pdfOrden(orden).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.match(pdf,/\/Count 5/);
  assert.ok(pdf.includes('S/ 14808.00'));
  assert.ok(!pdf.includes('PRIVADO'));
  const offset = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(offset,offset+4),'xref');
});
