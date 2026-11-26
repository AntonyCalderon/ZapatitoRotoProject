import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import pool from '../../config/database.js';
import ventaConfirmadaRoutes from './ventaConfirmada.routes.js';

const roles = new Map([[1, ['Ventas']], [2, ['Administrador']], [3, ['Almacen']], [4, ['Compras']]]);
const ventaBase = {
  id_orden_venta: 18, estado: 'Pendiente', fecha_creacion: '2026-11-25T20:00:00Z', fecha_confirmacion: '2026-11-25T22:40:00Z',
  tasa_igv: '0.1800', subtotal: '3120.00', igv: '561.60', total: '3681.60',
  tipo_documento_cliente: 'O/C', numero_documento_cliente: '0045-2026',
  id_cliente: 7, tipo_documento: 'RUC', numero_documento: '20123456789', razon_social_nombre: 'Gobierno Regional de prueba',
  direccion: 'Av. de prueba 123', tipo_cliente: 'Gobierno Regional', segmento: 'B2G'
};
const lineas = [
  { id_sku: 1, codigo_sku: 'THR-NEG-40', modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 6, precio_unitario: '260.00', importe: '1560.00', precio_con_igv: '306.80' },
  { id_sku: 2, codigo_sku: 'THR-NEG-41', modelo: 'Threshold', color: 'Negro', talla: '41.0', cantidad: 6, precio_unitario: '260.00', importe: '1560.00', precio_con_igv: '306.80' }
];
const vigenteBase = { id_comprobante: 30, tipo: 'Factura', serie: 'F001', numero: '00000003', subtotal: '3120.00', igv: '561.60', total: '3681.60' };

// Simula PostgreSQL: la sesión usa pool.query y cada operación usa una transacción de pool.connect.
function simularBase(t, { venta = ventaBase, vigente = null, previo = null, errorInsert, correlativo = 3 } = {}) {
  const sentencias = [];
  t.mock.method(pool, 'query', async (sql, parametros) => {
    if (sql.includes('FROM usuario u')) {
      return { rows: [{ id_usuario: parametros[0], activo: true, roles: roles.get(parametros[0]), debe_cambiar_password: false }] };
    }
    return responder(sql, parametros);
  });
  function responder(sql, parametros = []) {
    sentencias.push({ sql: sql.trim(), parametros });
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) return { rows: [] };
    if (/FROM orden_venta v\s+JOIN cliente c/.test(sql) && /WHERE v\.id_orden_venta = \$1/.test(sql)) {
      assert.deepEqual(parametros, [18, 1], 'la venta siempre se filtra por su vendedor');
      return { rows: venta ? [venta] : [] };
    }
    if (/FROM orden_venta v/.test(sql) && /v\.estado = ANY/.test(sql)) return { rows: [{ id_orden_venta: 18, estado: 'Pendiente' }] };
    if (/FROM detalle_orden_venta d/.test(sql)) return { rows: lineas };
    if (/FROM comprobante_pago WHERE id_orden_venta = \$1 AND estado = 'Emitido'/.test(sql)) return { rows: vigente ? [vigente] : [] };
    if (/FROM comprobante_pago WHERE id_orden_venta = \$1\s+ORDER BY/.test(sql)) return { rows: vigente ? [{ ...vigente, estado: 'Emitido' }] : [] };
    if (/FROM nota_credito n/.test(sql)) return { rows: [] };
    if (/FROM orden_despacho WHERE id_orden_venta/.test(sql)) return { rows: previo ? [previo] : [] };
    if (/^UPDATE cliente/.test(sql.trim())) return { rows: [] };
    if (/INSERT INTO correlativo_documento/.test(sql)) return { rows: [{ anio: 2026, ultimo_numero: correlativo }] };
    if (/INSERT INTO comprobante_pago/.test(sql)) {
      if (errorInsert) throw Object.assign(new Error('violación'), { code: errorInsert });
      const [, tipo, serie, numero, , , total] = parametros;
      return { rows: [{ id_comprobante: 31, tipo, serie, numero, estado: 'Emitido', fecha_emision: '2026-11-26T15:30:00Z', total }] };
    }
    if (/^UPDATE comprobante_pago SET estado = 'Anulado'/.test(sql.trim())) return { rows: [] };
    if (/INSERT INTO nota_credito/.test(sql)) {
      const [id_comprobante, serie, numero, motivo, , , , total] = parametros;
      return { rows: [{ id_nota_credito: 5, id_comprobante, serie, numero, motivo, fecha_emision: '2026-11-26T16:05:00Z', total }] };
    }
    if (/INSERT INTO orden_despacho/.test(sql)) {
      if (errorInsert) throw Object.assign(new Error('violación'), { code: errorInsert });
      return { rows: [{ id_orden_despacho: 9, codigo: parametros[0], estado: 'Pendiente de Despacho', fecha_emision: '2026-11-26T15:32:00Z' }] };
    }
    if (/^UPDATE orden_venta SET estado/.test(sql.trim())) return { rows: [] };
    if (/FROM comprobante_pago cp\s+WHERE cp\.id_comprobante/.test(sql)) {
      return { rows: [{ tipo: 'Factura', serie: 'F001', numero: '00000003', estado: 'Emitido', fecha: '26/11/2026', referencia: null, motivo: null, sustento: null,
        documento_emitido: { cliente: { tipo_documento: 'RUC', numero_documento: '20123456789', nombre: 'Gobierno Regional de prueba', direccion: 'Av. de prueba 123' },
          documento_respaldo: null, lineas, tasa_igv: '0.1800', subtotal: '3120.00', igv: '561.60', total: '3681.60' } }] };
    }
    throw new Error('Consulta inesperada: ' + sql);
  }
  const cliente = { liberado: 0, release() { this.liberado++; }, query: async (sql, parametros) => responder(sql, parametros) };
  const conectar = t.mock.method(pool, 'connect', async () => cliente);
  const sinMovimientos = () => assert.equal(sentencias.some(s => /stock_sku|kardex_movimiento/.test(s.sql)), false,
    'emitir, anular y enviar no tocan stock ni Kardex');
  return { sentencias, cliente, conectar, sinMovimientos };
}

async function levantar(t) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { idUsuario: Number(req.get('x-test-session')) }; next(); });
  app.use('/api/ventas/confirmadas', ventaConfirmadaRoutes);
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  await once(servidor, 'listening');
  return async function pedir(ruta, { usuario = 1, metodo = 'GET', cuerpo } = {}) {
    const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/api/ventas/confirmadas${ruta}`, {
      method: metodo,
      headers: { 'x-test-session': String(usuario), 'content-type': 'application/json' },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) })
    });
    const tipo = respuesta.headers.get('content-type') ?? '';
    return { status: respuesta.status, tipo, cuerpo: tipo.includes('json') ? await respuesta.json() : Buffer.from(await respuesta.arrayBuffer()) };
  };
}

const post = (cuerpo) => ({ metodo: 'POST', cuerpo });

test('solo el rol Ventas usa las rutas y los datos inválidos no abren transacción', async t => {
  const { conectar } = simularBase(t);
  const pedir = await levantar(t);
  for (const [ruta, opciones] of [['', {}], ['/18', {}], ['/18/comprobante', post({})], ['/18/comprobante/anular', post({})], ['/18/despacho', post()]]) {
    assert.equal((await pedir(ruta, { ...opciones, usuario: 0 })).status, 401, ruta);
    for (const usuario of [2, 3, 4]) assert.equal((await pedir(ruta, { ...opciones, usuario })).status, 403, ruta);
  }
  assert.equal((await pedir('/0/comprobante', post({}))).cuerpo.codigo, 'VENTA_INVALIDA');
  assert.equal((await pedir('/18/comprobante', post({ direccion: 'Av' }))).cuerpo.codigo, 'DIRECCION_INVALIDA');
  assert.equal((await pedir('/18/comprobante/anular', post({ motivo: '09', sustento: 'Sustento válido' }))).cuerpo.codigo, 'MOTIVO_INVALIDO');
  assert.equal((await pedir('/18/comprobante/anular', post({ motivo: '01', sustento: 'x' }))).cuerpo.codigo, 'SUSTENTO_INVALIDO');
  assert.equal(conectar.mock.callCount(), 0);
});

test('HU14: emite factura F001 con los montos de la venta, guarda la dirección y no toca stock', async t => {
  const { sentencias, cliente, sinMovimientos } = simularBase(t, { venta: { ...ventaBase, direccion: null } });
  const pedir = await levantar(t);
  const { status, cuerpo } = await pedir('/18/comprobante', post({ direccion: '  Av. de prueba   123 ', total: '1.00' }));
  assert.equal(status, 201);
  assert.deepEqual([cuerpo.comprobante.tipo, cuerpo.comprobante.serie, cuerpo.comprobante.numero], ['Factura', 'F001', '00000003']);
  assert.equal(cuerpo.comprobante.total, '3681.60', 'el total sale de la venta, no del cuerpo');
  const direccion = sentencias.find(s => s.sql.startsWith('UPDATE cliente'));
  assert.deepEqual(direccion.parametros, [7, 'Av. de prueba 123']);
  assert.deepEqual(sentencias.find(s => /INSERT INTO correlativo_documento/.test(s.sql)).parametros, ['FACTURA', 'F001', false]);
  const insert = sentencias.find(s => /INSERT INTO comprobante_pago/.test(s.sql));
  const documento = JSON.parse(insert.parametros[8]);
  assert.equal(documento.cliente.direccion, 'Av. de prueba 123');
  assert.equal(documento.lineas.length, 2);
  assert.match(sentencias.find(s => /FROM orden_venta v/.test(s.sql)).sql, /FOR UPDATE OF v, c/);
  assert.equal(sentencias[0].sql, 'BEGIN');
  assert.equal(sentencias.at(-1).sql, 'COMMIT');
  assert.equal(cliente.liberado, 1);
  sinMovimientos();
});

test('HU14: un cliente con DNI recibe boleta B001 y una dirección registrada no se reescribe', async t => {
  const { sentencias } = simularBase(t, { venta: { ...ventaBase, tipo_documento: 'DNI', numero_documento: '12345678', segmento: 'B2C' }, correlativo: 1 });
  const pedir = await levantar(t);
  const { status, cuerpo } = await pedir('/18/comprobante', post({}));
  assert.equal(status, 201);
  assert.equal(`${cuerpo.comprobante.tipo} ${cuerpo.comprobante.serie}-${cuerpo.comprobante.numero}`, 'Boleta B001-00000001');
  assert.equal(sentencias.some(s => s.sql.startsWith('UPDATE cliente')), false);
});

test('HU14: rechaza la emisión sin dirección, fuera de Pendiente o con comprobante vigente', async t => {
  const casos = [
    [{ venta: { ...ventaBase, direccion: null } }, 400, 'DIRECCION_REQUERIDA'],
    [{ venta: { ...ventaBase, estado: 'En Almacén' } }, 409, 'VENTA_NO_PENDIENTE'],
    [{ vigente: vigenteBase }, 409, 'COMPROBANTE_YA_EMITIDO'],
    [{ venta: null }, 404, 'VENTA_NO_ENCONTRADA'],
    [{ venta: { ...ventaBase, estado: 'Borrador' } }, 404, 'VENTA_NO_ENCONTRADA'],
    [{ venta: { ...ventaBase, total: null } }, 409, 'MONTOS_PENDIENTES'],
    [{ errorInsert: '23505' }, 409, 'COMPROBANTE_YA_EMITIDO']
  ];
  for (const [base, status, codigo] of casos) {
    await t.test(codigo + ' ' + status, async t2 => {
      const { sentencias, cliente } = simularBase(t2, base);
      const pedir = await levantar(t2);
      const respuesta = await pedir('/18/comprobante', post({}));
      assert.equal(respuesta.status, status);
      assert.equal(respuesta.cuerpo.codigo, codigo);
      assert.equal(sentencias.at(-1).sql, 'ROLLBACK');
      assert.equal(cliente.liberado, 1);
    });
  }
});

test('Corrección: anula con nota de crédito FC01 y deja la venta lista para otro comprobante', async t => {
  const { sentencias, sinMovimientos } = simularBase(t, { vigente: vigenteBase, correlativo: 1 });
  const pedir = await levantar(t);
  const { status, cuerpo } = await pedir('/18/comprobante/anular', post({ motivo: '02', sustento: 'RUC de la unidad ejecutora' }));
  assert.equal(status, 201);
  assert.equal(`${cuerpo.nota_credito.serie}-${cuerpo.nota_credito.numero}`, 'FC01-00000001');
  assert.equal(cuerpo.comprobante_anulado.estado, 'Anulado');
  assert.deepEqual(sentencias.find(s => s.sql.startsWith("UPDATE comprobante_pago SET estado = 'Anulado'")).parametros, [30]);
  const nota = sentencias.find(s => /INSERT INTO nota_credito/.test(s.sql)).parametros;
  assert.deepEqual(nota.slice(0, 8), [30, 'FC01', '00000001', '02', 'RUC de la unidad ejecutora', '3120.00', '561.60', '3681.60']);
  assert.equal(nota[8], 1, 'queda registrado quién anuló');
  assert.equal(sentencias.at(-1).sql, 'COMMIT');
  sinMovimientos();
});

test('Corrección: no se anula después de enviar a Almacén ni sin comprobante vigente', async t => {
  for (const [base, codigo] of [
    [{ vigente: vigenteBase, venta: { ...ventaBase, estado: 'En Almacén' } }, 'VENTA_NO_PENDIENTE'],
    [{ vigente: null }, 'SIN_COMPROBANTE']
  ]) {
    await t.test(codigo, async t2 => {
      const { sentencias } = simularBase(t2, base);
      const pedir = await levantar(t2);
      const respuesta = await pedir('/18/comprobante/anular', post({ motivo: '01', sustento: 'Se anula la operación' }));
      assert.equal(respuesta.status, 409);
      assert.equal(respuesta.cuerpo.codigo, codigo);
      assert.equal(sentencias.some(s => /INSERT INTO nota_credito/.test(s.sql)), false);
      assert.equal(sentencias.at(-1).sql, 'ROLLBACK');
    });
  }
});

test('HU15: crea la orden OD-2026-002 y pasa la venta a En Almacén sin tocar stock', async t => {
  const { sentencias, sinMovimientos } = simularBase(t, { vigente: vigenteBase, correlativo: 2 });
  const pedir = await levantar(t);
  const { status, cuerpo } = await pedir('/18/despacho', post());
  assert.equal(status, 201);
  assert.equal(cuerpo.despacho.codigo, 'OD-2026-002');
  assert.equal(cuerpo.despacho.estado, 'Pendiente de Despacho');
  assert.equal(cuerpo.estado_venta, 'En Almacén');
  assert.deepEqual(sentencias.find(s => /INSERT INTO correlativo_documento/.test(s.sql)).parametros, ['OD', '', true]);
  assert.deepEqual(sentencias.find(s => s.sql.startsWith('UPDATE orden_venta SET estado')).parametros, [18, 'En Almacén']);
  assert.equal(sentencias.at(-1).sql, 'COMMIT');
  sinMovimientos();
});

test('HU15: sin comprobante, ya enviada o fuera de Pendiente responde 409 y revierte', async t => {
  for (const [base, codigo] of [
    [{ vigente: null }, 'SIN_COMPROBANTE'],
    [{ vigente: vigenteBase, previo: { codigo: 'OD-2026-001' } }, 'DESPACHO_YA_ENVIADO'],
    [{ vigente: vigenteBase, venta: { ...ventaBase, estado: 'Despachado' } }, 'VENTA_NO_PENDIENTE'],
    [{ vigente: vigenteBase, errorInsert: '23505' }, 'DESPACHO_YA_ENVIADO']
  ]) {
    await t.test(codigo, async t2 => {
      const { sentencias, cliente } = simularBase(t2, base);
      const pedir = await levantar(t2);
      const respuesta = await pedir('/18/despacho', post());
      assert.equal(respuesta.status, 409);
      assert.equal(respuesta.cuerpo.codigo, codigo);
      assert.equal(sentencias.some(s => s.sql.startsWith('UPDATE orden_venta')), false);
      assert.equal(sentencias.at(-1).sql, 'ROLLBACK');
      assert.equal(cliente.liberado, 1);
    });
  }
});

test('el detalle propone el comprobante y no expone costos ni precios sin IGV', async t => {
  simularBase(t, { vigente: vigenteBase });
  const pedir = await levantar(t);
  const { status, cuerpo } = await pedir('/18');
  assert.equal(status, 200);
  assert.deepEqual(cuerpo.comprobante_propuesto, { tipo: 'Factura', serie: 'F001', motivo: null });
  assert.equal('id_cliente' in cuerpo.venta, false);
  assert.equal('precio_unitario' in cuerpo.lineas[0], false);
  assert.equal(JSON.stringify(cuerpo).includes('costo'), false);
  assert.equal(cuerpo.comprobantes[0].estado, 'Emitido');
  assert.equal(cuerpo.despacho, null);
  assert.equal((await pedir('')).cuerpo.ventas.length, 1);
});

test('el PDF se arma desde la copia guardada y aclara que no es válido ante SUNAT', async t => {
  simularBase(t);
  const pedir = await levantar(t);
  const { status, tipo, cuerpo } = await pedir('/18/comprobantes/30/pdf');
  assert.equal(status, 200);
  assert.match(tipo, /application\/pdf/);
  const texto = cuerpo.toString('latin1');
  assert.match(texto, /^%PDF-1\.4/);
  assert.match(texto, /FACTURA F001-00000003/);
  assert.match(texto, /NO VALIDO COMO COMPROBANTE ELECTRONICO ANTE SUNAT/);
  assert.match(texto, /Importe total: S\/ 3681\.60/);
  assert.equal((await pedir('/18/comprobantes/abc/pdf')).cuerpo.codigo, 'DOCUMENTO_INVALIDO');
});
