import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import pool from '../../config/database.js';
import inventarioRoutes from './inventario.routes.js';

test('inventario protege consultas y rechaza filtros inválidos antes de consultar saldos', async t => {
  const roles = new Map([[1, ['Almacen']], [2, ['Administrador']], [3, ['Ventas']], [4, ['Compras']]]);
  t.mock.method(pool, 'query', async (sql, parametros) => {
    assert.match(sql, /FROM usuario u/);
    return { rows: [{ activo: true, roles: roles.get(parametros[0]), debe_cambiar_password: parametros[0] === 5 }] };
  });
  const conectar = t.mock.method(pool, 'connect', async () => {
    throw new Error('No se deben consultar saldos con permisos o filtros inválidos.');
  });
  const app = express();
  app.use((req, _res, next) => { req.session = { idUsuario: Number(req.get('x-test-session')) }; next(); });
  app.use('/api/almacen', inventarioRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  async function consultar(ruta, usuario, status) {
    const respuesta = await fetch(`http://127.0.0.1:${server.address().port}/api/almacen${ruta}`, {
      headers: { 'x-test-session': String(usuario) },
    });
    assert.equal(respuesta.status, status, ruta);
    return respuesta.json();
  }
  for (const ruta of ['/existencias', '/catalogo', '/kardex/1']) {
    for (const [usuario, estado] of [[0, 401], [2, 403], [3, 403], [4, 403]]) await consultar(ruta, usuario, estado);
  }
  for (const ruta of [
    '/existencias?pagina=0', '/existencias?tamano=101', '/existencias?pagina=1.2',
    '/existencias?id_modelo=-1', '/existencias?id_color=abc', '/existencias?id_talla=2147483648',
    '/existencias?catalogo=otros', '/existencias?situacion=rojo', '/existencias?q=a&q=b',
    '/existencias?q=' + 'a'.repeat(101), '/catalogo?catalogo=activos&catalogo=inactivos',
    '/kardex/1x', '/kardex/2147483648', '/kardex/0',
    '/kardex/1?desde=2026-02-30', '/kardex/1?desde=0000-01-01',
    '/kardex/1?desde=2026-11-22&hasta=2026-11-21',
    '/kardex/1?tipo_movimiento=CAMBIO', '/kardex/1?tamano=0',
  ]) {
    const error = await consultar(ruta, 1, 400);
    assert.equal(error.codigo, 'FILTRO_INVALIDO');
  }
  assert.equal(conectar.mock.callCount(), 0);
});
