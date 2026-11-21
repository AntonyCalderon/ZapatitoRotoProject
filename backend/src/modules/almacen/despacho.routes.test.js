import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import pool from '../../config/database.js';
import despachoRoutes from './despacho.routes.js';

test('la bandeja y su detalle requieren una sesión de Almacén o Administración', async t => {
  const roles = new Map([[1, ['Almacen']], [2, ['Administrador']], [3, ['Ventas']], [4, ['Compras']]]);
  const despacho = { id_orden_despacho: 5, codigo: 'DES-005' };
  const productos = [{ id_sku: 1, modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 2 }];
  t.mock.method(pool, 'query', async (sql, parametros) => {
    if (sql.includes('FROM usuario u')) {
      return { rows: [{ activo: true, roles: roles.get(parametros[0]), debe_cambiar_password: false }] };
    }
    assert.match(sql, /^\s*SELECT\b/);
    assert.match(sql, /WHERE d\.estado = \$1/);
    assert.equal(parametros[0], 'Pendiente de Despacho');
    if (parametros.length === 1) {
      assert.match(sql, /ORDER BY d\.fecha_emision ASC, d\.id_orden_despacho ASC/);
      return { rows: [despacho] };
    }
    return { rows: parametros[1] === 5 ? [{ ...despacho, productos }] : [] };
  });

  const app = express();
  app.use((req, _res, next) => {
    req.session = { idUsuario: Number(req.get('x-test-session')) };
    next();
  });
  app.use('/despachos', despachoRoutes);
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  await once(servidor, 'listening');

  async function consultar(ruta, usuario, estado) {
    const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/despachos${ruta}`, {
      headers: { 'x-test-session': String(usuario) }
    });
    assert.equal(respuesta.status, estado);
    return respuesta.json();
  }

  for (const ruta of ['', '/5']) {
    await consultar(ruta, 0, 401);
    await consultar(ruta, 3, 403);
    await consultar(ruta, 4, 403);
  }

  assert.deepEqual(await consultar('', 1, 200), { despachos: [despacho] });
  assert.deepEqual(await consultar('/5', 2, 200), { despacho: { ...despacho, productos } });
  await consultar('/6', 1, 404);
  await consultar('/2147483648', 1, 400);
});
