import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import argon2 from 'argon2';
import pool from '../../config/database.js';
import { registrarUsuario, actualizarEstado } from './usuario.service.js';
import router from './usuario.routes.js';

const originalConnect = pool.connect.bind(pool);
const originalQuery = pool.query.bind(pool);
after(async () => { pool.connect = originalConnect; pool.query = originalQuery; await pool.end(); });

test('valida datos antes de acceder a la base', async () => {
  for (const datos of [{ nombre: '', correo: 'a@b.co', roles: [1] }, { nombre: 'Ana', correo: 'mal', roles: [1] }, { nombre: 'Ana', correo: 'a@b.co', roles: [1, 1] }]) {
    await assert.rejects(registrarUsuario(datos), { status: 400 });
  }
  await assert.rejects(actualizarEstado('x', true, 1), { status: 400 });
  await assert.rejects(actualizarEstado('2', 'false', 1), { status: 400 });
});

test('crea usuario y roles en una transacción con hash Argon2id', async () => {
  const llamadas = [];
  pool.connect = async () => ({ release() {}, async query(sql, args) {
    llamadas.push([sql, args]);
    if (sql.startsWith('SELECT id_rol')) return { rows: [{ id_rol: 1, nombre_rol: 'Ventas' }] };
    if (sql.includes('INSERT INTO usuario (')) return { rows: [{ id_usuario: 8, nombre: 'Ana', correo: 'ana@ejemplo.com', activo: true }] };
    return { rows: [] };
  } });
  const resultado = await registrarUsuario({ nombre: ' Ana ', correo: ' ANA@Ejemplo.com ', roles: [1] });
  const insercion = llamadas.find(([sql]) => sql.includes('INSERT INTO usuario ('));
  assert.equal(insercion[1][1], 'ana@ejemplo.com');
  assert.match(insercion[1][2], /^\$argon2id\$/);
  assert.equal(await argon2.verify(insercion[1][2], resultado.passwordTemporal), true);
  assert.equal(resultado.usuario.password_hash, undefined);
  assert.equal(llamadas.at(-1)[0], 'COMMIT');
});

test('revierte roles inválidos y correo duplicado', async () => {
  for (const duplicado of [false, true]) {
    const llamadas = [];
    pool.connect = async () => ({ release() {}, async query(sql) {
      llamadas.push(sql);
      if (sql.startsWith('SELECT id_rol')) return { rows: duplicado ? [{ id_rol: 1, nombre_rol: 'Ventas' }] : [] };
      if (sql.includes('INSERT INTO usuario (')) throw Object.assign(new Error('duplicado'), { code: '23505', constraint: 'uq_usuario_correo' });
      return { rows: [] };
    } });
    await assert.rejects(registrarUsuario({ nombre: 'Ana', correo: 'a@b.co', roles: [1] }), { status: duplicado ? 409 : 400 });
    assert.equal(llamadas.at(-1), 'ROLLBACK');
  }
});

test('protege cuenta propia, último administrador y usuario inexistente', async () => {
  for (const [id, actor, existe, admins, status] of [[1, 1, true, [1], 409], [2, 1, true, [2], 409], [3, 1, false, [], 404], [3, 1, true, [1], 200]]) {
    const llamadas = [];
    pool.connect = async () => ({ release() {}, async query(sql) {
      llamadas.push(sql);
      if (sql.startsWith('SELECT id_usuario, activo')) return { rowCount: existe ? 1 : 0, rows: existe ? [{ id_usuario: id, activo: true }] : [] };
      if (sql.startsWith('SELECT u.id_usuario')) return { rows: admins.map(id_usuario => ({ id_usuario })) };
      if (sql.startsWith('UPDATE')) return { rows: [{ id_usuario: id, activo: false }] };
      return { rows: [] };
    } });
    if (status === 200) assert.equal((await actualizarEstado(id, false, actor)).activo, false);
    else await assert.rejects(actualizarEstado(id, false, actor), { status });
    assert.ok(llamadas.some(sql => sql.includes('pg_advisory_xact_lock')));
    assert.equal(llamadas.at(-1), status === 200 ? 'COMMIT' : 'ROLLBACK');
  }
});

test('rutas requieren sesión y rol Administrador', async () => {
  const app = express();
  app.use((req, res, next) => { req.session = req.headers['x-test-session'] ? { idUsuario: 1 } : {}; next(); });
  app.use('/api/usuarios', router);
  pool.query = async () => ({ rows: [{ id_usuario: 1, activo: true, roles: ['Ventas'] }] });
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/usuarios`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { 'x-test-session': '1' } })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
