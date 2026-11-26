import assert from 'node:assert/strict';
import { test } from 'node:test';
import pool from '../../config/database.js';
import { listarPendientesDespacho, buscarPendienteDespacho } from '../almacen/despacho.repository.js';
import { consultarDisponibilidadVenta } from './precioVenta.repository.js';

// Ajustes que HU14 y HU15 necesitan en código de otras historias.

test('HU18 muestra solo el comprobante vigente: una factura anulada no duplica la fila', async t => {
  const consultas = [];
  t.mock.method(pool, 'query', async sql => { consultas.push(sql); return { rows: [] }; });
  await listarPendientesDespacho();
  await buscarPendienteDespacho(5);
  for (const sql of consultas) {
    assert.match(sql, /LEFT JOIN comprobante_pago cp ON cp\.id_orden_venta = v\.id_orden_venta AND cp\.estado = 'Emitido'/);
  }
});

test('HU15 RN-08: una venta En Almacén sigue reservando sus pares hasta la salida física', async t => {
  let consulta = '';
  const conexion = { query: async sql => { consulta = sql; return { rows: [] }; } };
  await consultarDisponibilidadVenta(1, conexion);
  assert.match(consulta, /v\.estado IN \('Pendiente', 'En Almacén'\)/);
  assert.doesNotMatch(consulta, /'Borrador'/);
});
