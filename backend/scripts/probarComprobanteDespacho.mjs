// Prueba de funcionamiento de HU14 (PROYEC-25) y HU15 (PROYEC-26) contra PostgreSQL real.
// Aplica todas las migraciones en un esquema temporal y lo borra al terminar: no toca el esquema público.
// Uso: node scripts/probarComprobanteDespacho.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import pool from '../src/config/database.js';
import ventasConfirmadas from '../src/modules/ventas/ventaConfirmada.routes.js';
import preciosVenta from '../src/modules/ventas/precioVenta.routes.js';
import despachos from '../src/modules/almacen/despacho.routes.js';
import { instalarErroresApi } from '../src/middlewares/erroresApi.js';

const schema = 'qa_comprobante_' + Date.now();
assert.match(schema, /^qa_comprobante_\d+$/);
const connect = pool.connect.bind(pool);
const admin = await connect();
let creado = false, server, n = 0;
const ok = (condicion, mensaje) => { assert.ok(condicion, mensaje); n++; };

try {
  await admin.query(`CREATE SCHEMA ${schema}`); creado = true;
  await admin.query(`SET search_path TO ${schema}, public`);
  const carpeta = new URL('../../database/migration/', import.meta.url);
  for (const archivo of readdirSync(carpeta).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort()) {
    await admin.query(readFileSync(new URL(archivo, carpeta), 'utf8'));
  }
  console.log('Migraciones 001 a 018 aplicadas en', schema);

  await admin.query(`
    INSERT INTO usuario (nombre, correo, password_hash, debe_cambiar_password) VALUES
      ('Vendedor QA', 'ventas@qa.invalid', 'x', false), ('Almacén QA', 'almacen@qa.invalid', 'x', false),
      ('Otro vendedor QA', 'ventas2@qa.invalid', 'x', false);
    INSERT INTO usuario_rol (id_usuario, id_rol)
      SELECT u.id_usuario, r.id_rol FROM usuario u JOIN rol r ON r.nombre_rol = CASE u.correo
        WHEN 'almacen@qa.invalid' THEN 'Almacen' ELSE 'Ventas' END;
    INSERT INTO modelo (nombre_modelo) VALUES ('Threshold');
    INSERT INTO color (nombre_color) VALUES ('Negro');
    INSERT INTO talla (numero_talla) VALUES (40), (41);
    INSERT INTO producto_sku (codigo_sku, id_modelo, id_color, id_talla) VALUES ('THR-NEG-40', 1, 1, 1), ('THR-NEG-41', 1, 1, 2);
    INSERT INTO kardex_movimiento (id_sku, tipo_movimiento, cantidad, id_usuario) VALUES (1, 'APERTURA', 20, 2), (2, 'APERTURA', 20, 2);
    INSERT INTO cliente (id_tipo_cliente, tipo_documento, numero_documento, razon_social_nombre)
      SELECT id_tipo_cliente, 'RUC', '20123456789', 'Gobierno Regional QA' FROM tipo_cliente WHERE nombre = 'Gobierno Regional';
    INSERT INTO cliente (id_tipo_cliente, tipo_documento, numero_documento, razon_social_nombre, direccion)
      SELECT id_tipo_cliente, 'DNI', '12345678', 'Cliente particular QA', 'Jr. QA 456' FROM tipo_cliente WHERE nombre = 'Particular';
  `);
  // Ventas confirmadas como las dejará la HU13: estado Pendiente, precios e importes congelados.
  async function ventaPendiente(idCliente, vendedor, lineas, documento) {
    const subtotal = lineas.reduce((s, [, cantidad]) => s + cantidad * 260, 0);
    const igv = Math.round(subtotal * 18) / 100;
    const { rows: [venta] } = await admin.query(`
      INSERT INTO orden_venta (id_cliente, id_usuario_vendedor, id_tipo_cliente, estado, fecha_confirmacion,
        tipo_documento_cliente, numero_documento_cliente, tasa_igv, subtotal, igv, total)
      SELECT $1, $2, id_tipo_cliente, 'Pendiente', now(), 'O/C', $6, 0.18, $3, $4, $5 FROM cliente WHERE id_cliente = $1
      RETURNING id_orden_venta`, [idCliente, vendedor, subtotal, igv, subtotal + igv, documento]);
    for (const [idSku, cantidad] of lineas) {
      await admin.query(`INSERT INTO detalle_orden_venta (id_orden_venta, id_sku, cantidad, costo_unitario, margen_porcentaje, precio_unitario, importe)
        VALUES ($1, $2, $3, 200, 30, 260, $4)`, [venta.id_orden_venta, idSku, cantidad, cantidad * 260]);
    }
    return venta.id_orden_venta;
  }
  const gobierno = await ventaPendiente(1, 1, [[1, 6], [2, 6]], '0045-2026');
  const particular = await ventaPendiente(2, 1, [[1, 1]], '0001-2026');
  const carrera = await ventaPendiente(2, 1, [[2, 1]], '0002-2026');

  pool.connect = async () => { const c = await connect(); await c.query(`SET search_path TO ${schema}, public`); return c; };
  pool.query = async (sql, valores) => { const c = await pool.connect(); try { return await c.query(sql, valores); } finally { c.release(); } };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { idUsuario: Number(req.get('x-test-session')) }; next(); });
  app.use('/api/ventas/precios', preciosVenta);
  app.use('/api/ventas/confirmadas', ventasConfirmadas);
  app.use('/api/almacen/pendientes-despacho', despachos);
  instalarErroresApi(app);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  async function pedir(ruta, { usuario = 1, cuerpo, metodo = cuerpo === undefined ? 'GET' : 'POST', status = 200 } = {}) {
    const r = await fetch(url + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'x-test-session': String(usuario) },
      ...(cuerpo === undefined || cuerpo === null ? {} : { body: JSON.stringify(cuerpo) }) });
    const datos = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
    assert.equal(r.status, status, `${metodo} ${ruta}: ${JSON.stringify(datos).slice(0, 300)}`); n++;
    return datos;
  }
  const base = '/api/ventas/confirmadas/';
  const disponible = async idSku => (await pedir(`/api/ventas/precios/productos/${idSku}/disponibilidad`)).producto.disponible;
  const stockYKardex = async () => (await admin.query(`
    SELECT s.id_sku, s.cantidad_actual, (SELECT SUM(k.cantidad) FILTER (WHERE k.tipo_movimiento <> 'SALIDA_VENTA')
      - COALESCE(SUM(k.cantidad) FILTER (WHERE k.tipo_movimiento = 'SALIDA_VENTA'), 0) FROM kardex_movimiento k WHERE k.id_sku = s.id_sku)::int AS kardex
    FROM stock_sku s ORDER BY s.id_sku`)).rows;
  const inicial = await stockYKardex();

  // Reserva previa: 20 físicos menos los pares de ventas Pendiente.
  ok(await disponible(1) === 20 - 6 - 1 && await disponible(2) === 20 - 6 - 1, 'la reserva inicial cuenta las ventas Pendiente');

  // HU15 CA-02: sin comprobante no se envía.
  ok((await pedir(base + gobierno + '/despacho', { cuerpo: null, metodo: 'POST', status: 409 })).codigo === 'SIN_COMPROBANTE', 'CA-02');

  // HU14: la dirección es obligatoria; después se emite la factura con los montos de la venta.
  ok((await pedir(base + gobierno + '/comprobante', { cuerpo: {}, status: 400 })).codigo === 'DIRECCION_REQUERIDA', 'RN-05');
  const { comprobante: primera } = await pedir(base + gobierno + '/comprobante', { cuerpo: { direccion: 'Av. QA 123, Ayacucho' }, status: 201 });
  ok(primera.tipo === 'Factura' && primera.serie === 'F001' && primera.numero === '00000001' && primera.total === '3681.60', 'CA-01 y CA-02');
  ok((await pedir(base + gobierno + '/comprobante', { cuerpo: {}, status: 409 })).codigo === 'COMPROBANTE_YA_EMITIDO', 'CA-03');
  const { rows: [guardado] } = await admin.query('SELECT documento_emitido, id_usuario FROM comprobante_pago WHERE id_comprobante = $1', [primera.id_comprobante]);
  ok(guardado.documento_emitido.cliente.direccion === 'Av. QA 123, Ayacucho' && guardado.documento_emitido.lineas.length === 2 && guardado.id_usuario === 1, 'RN-06 copia guardada');

  // HU14: boleta para DNI y emisión simultánea con un solo número.
  const { comprobante: boleta } = await pedir(base + particular + '/comprobante', { cuerpo: {}, status: 201 });
  ok(`${boleta.tipo} ${boleta.serie}-${boleta.numero}` === 'Boleta B001-00000001', 'RN-02 boleta');
  const simultaneas = await Promise.all([1, 2].map(() => fetch(url + base + carrera + '/comprobante', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-session': '1' }, body: '{}' }).then(r => r.status)));
  ok(simultaneas.sort().join() === '201,409', 'dos emisiones simultáneas: una gana y la otra recibe 409');
  ok((await admin.query(`SELECT ultimo_numero FROM correlativo_documento WHERE tipo_documento = 'BOLETA'`)).rows[0].ultimo_numero === 2, 'el correlativo avanzó una sola vez');
  ok(JSON.stringify(await stockYKardex()) === JSON.stringify(inicial), 'CA-04: emitir no cambia stock ni Kardex');

  // Corrección: anular con nota de crédito y emitir otra factura con el número siguiente.
  const anulacion = await pedir(base + gobierno + '/comprobante/anular', { cuerpo: { motivo: '02', sustento: 'RUC de la unidad ejecutora' }, status: 201 });
  ok(`${anulacion.nota_credito.serie}-${anulacion.nota_credito.numero}` === 'FC01-00000001', 'nota de crédito FC01');
  const { comprobante: segunda } = await pedir(base + gobierno + '/comprobante', { cuerpo: {}, status: 201 });
  ok(segunda.numero === '00000002', 'el número anulado no se reutiliza (RN-04)');
  const detalle = await pedir(base + gobierno);
  ok(detalle.comprobantes.map(c => c.estado).join() === 'Anulado,Emitido' && detalle.notas_credito.length === 1, 'historial de comprobantes');
  ok(!JSON.stringify(detalle).includes('costo'), 'el detalle de Ventas no expone costos');
  const pdfAnulado = await pedir(`${base}${gobierno}/comprobantes/${primera.id_comprobante}/pdf`);
  ok(pdfAnulado.toString('latin1').includes('FUE ANULADO') && pdfAnulado.toString('latin1').includes('NO VALIDO COMO COMPROBANTE ELECTRONICO'), 'PDF del anulado');
  const pdfNota = await pedir(`${base}${gobierno}/notas-credito/${anulacion.nota_credito.id_nota_credito}/pdf`);
  ok(pdfNota.toString('latin1').includes('Comprobante que modifica: Factura F001-00000001'), 'PDF de la nota');

  // HU15: crea la orden de despacho, pasa la venta a En Almacén y mantiene la reserva (RN-08).
  const { despacho } = await pedir(base + gobierno + '/despacho', { cuerpo: null, metodo: 'POST', status: 201 });
  ok(/^OD-\d{4}-001$/.test(despacho.codigo) && despacho.estado === 'Pendiente de Despacho', 'RN-02 de HU15');
  ok((await admin.query('SELECT estado FROM orden_venta WHERE id_orden_venta = $1', [gobierno])).rows[0].estado === 'En Almacén', 'RN-04 de HU15');
  ok(await disponible(1) === 13 && await disponible(2) === 13, 'RN-08: la venta En Almacén sigue reservando');
  ok((await pedir(base + gobierno + '/despacho', { cuerpo: null, metodo: 'POST', status: 409 })).codigo === 'DESPACHO_YA_ENVIADO', 'RN-03 de HU15');
  ok((await pedir(base + gobierno + '/comprobante/anular', { cuerpo: { motivo: '01', sustento: 'Ya no se puede' }, status: 409 })).codigo === 'VENTA_NO_PENDIENTE', 'no se anula después del envío');
  ok(JSON.stringify(await stockYKardex()) === JSON.stringify(inicial), 'enviar no cambia stock ni Kardex');

  // HU18: Almacén lo ve con el comprobante vigente, sin filas duplicadas por la factura anulada.
  const { despachos: cola } = await pedir('/api/almacen/pendientes-despacho', { usuario: 2 });
  const fila = cola.filter(d => d.codigo === despacho.codigo);
  ok(fila.length === 1 && `${fila[0].serie_comprobante}-${fila[0].numero_comprobante}` === 'F001-00000002' && fila[0].direccion === 'Av. QA 123, Ayacucho', 'CA-03 de HU15');
  const { despacho: paraAlmacen } = await pedir('/api/almacen/pendientes-despacho/' + despacho.id_orden_despacho, { usuario: 2 });
  ok(paraAlmacen.productos.length === 2 && !JSON.stringify(paraAlmacen).includes('precio'), 'RN-06 de HU15: sin precios');

  // Cada vendedor ve solo sus ventas; Almacén no usa las rutas de Ventas.
  await pedir(base + gobierno, { usuario: 3, status: 404 });
  await pedir(base + gobierno, { usuario: 2, status: 403 });
  console.log(`Prueba de funcionamiento HU14 y HU15: ${n} comprobaciones correctas.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await admin.query('RESET search_path');
  if (creado) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  admin.release();
  await pool.end();
}
