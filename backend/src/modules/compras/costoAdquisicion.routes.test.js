import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import pool from '../../config/database.js';
import router from './costoAdquisicion.routes.js';

async function iniciarPrueba(t) {
  const variante = { id_modelo: 1, id_talla: 40, activo: true, modelo_activo: true, talla_activa: true, color_activo: true };
  const productos = new Map([
    [1, { ...variante, id_color: 1 }],
    [2, { ...variante, id_color: 2 }],
    [3, { ...variante, id_talla: 41 }],
    [4, { ...variante, activo: false }]
  ]);
  const catalogo = new Map();
  const altas = [];
  t.mock.method(pool, 'query', async (sql, argumentos) => {
    if (sql.includes('FROM usuario u')) {
      const roles = argumentos[0] === 1 ? ['Compras'] : ['Ventas'];
      return { rows: [{ activo: true, debe_cambiar_password: false, roles }] };
    }
    if (sql.includes('FROM orden_compra oc')) return { rows: [{ estado: 'BORRADOR' }] };
    if (sql.includes('FROM producto_sku p')) {
      const sku = productos.get(argumentos[0]);
      return { rows: sku ? [sku] : [] };
    }
    if (sql.includes('LEFT JOIN costo_base AS c')) {
      const rows = argumentos[0].map((id_sku) => {
        const { id_modelo, id_talla } = productos.get(id_sku);
        const costo = catalogo.get(`${id_modelo}/${id_talla}`);
        return { id_sku, costo_unitario: costo?.costo_vigente ?? null };
      });
      return { rows };
    }
    if (sql.includes('FROM costo_base')) {
      const costo = catalogo.get(argumentos.join('/'));
      return { rows: costo ? [costo] : [] };
    }
    if (sql.includes('INSERT INTO costo_base')) {
      const [id_modelo, id_talla, importe] = argumentos;
      const costo = { id_costo_base: 1, id_modelo, id_talla, costo_vigente: importe.toFixed(2) };
      catalogo.set(`${id_modelo}/${id_talla}`, costo);
      altas.push(costo);
      return { rows: [costo] };
    }
    assert.fail(`Consulta inesperada: ${sql}`);
  });

  const app = express();
  app.use(express.json(), (req, res, next) => {
    req.session = { idUsuario: Number(req.get('x-test-session')) };
    next();
  });
  app.use('/api/compras', router);
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  await once(servidor, 'listening');
  const url = `http://127.0.0.1:${servidor.address().port}/api/compras`;

  async function enviar(ruta, cuerpo, estadoEsperado, usuario = 1) {
    const respuesta = await fetch(url + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-session': String(usuario) },
      body: JSON.stringify(cuerpo)
    });
    const datos = await respuesta.json();
    assert.equal(respuesta.status, estadoEsperado, JSON.stringify(datos));
    return datos;
  }

  return { enviar, altas, catalogo };
}

test('registra un costo por modelo y talla, lo usa para sus colores y recalcula el borrador', async (t) => {
  const { enviar, altas, catalogo } = await iniciarPrueba(t);
  const resumen = '/ordenes/7/resumen-costos';
  const lineas = [{ id_sku: 1, cantidad: 5 }, { id_sku: 2, cantidad: 7 }];
  const pendiente = await enviar(resumen, { lineas }, 200);
  assert.equal(pendiente.total, null);
  assert.deepEqual(pendiente.lineas.map(({ costoUnitario }) => costoUnitario), [null, null]);

  const alta = await enviar('/costos-faltantes/1', { costoUnitario: '180.00' }, 201);
  assert.deepEqual(alta.costo, { id_costo_base: 1, id_modelo: 1, id_talla: 40, costo_vigente: '180.00' });
  await enviar('/costos-faltantes/2', { costoUnitario: '200.00' }, 409);
  assert.equal(altas.length, 1);

  const completo = await enviar(resumen, { lineas }, 200);
  assert.deepEqual(completo.lineas.map(({ costoUnitario }) => costoUnitario), ['180.00', '180.00']);
  assert.deepEqual([completo.subtotalConocido, completo.total], ['2160.00', '2160.00']);

  const conOtraTalla = await enviar(resumen, { lineas: [...lineas, { id_sku: 3, cantidad: 1 }] }, 200);
  assert.equal(conOtraTalla.subtotalConocido, '2160.00');
  assert.equal(conOtraTalla.total, null);

  catalogo.set('1/40', { ...alta.costo, costo_vigente: '200.00' });
  const actualizado = await enviar(resumen, { lineas }, 200);
  assert.equal(actualizado.total, '2400.00');
});

test('rechaza altas sin rol Compras, con costos inválidos o con productos inactivos', async (t) => {
  const { enviar, altas } = await iniciarPrueba(t);
  const ruta = '/costos-faltantes/1';
  await enviar(ruta, { costoUnitario: '180.00' }, 401, 0);
  await enviar(ruta, { costoUnitario: '180.00' }, 403, 2);
  for (const costoUnitario of ['0', '-1', 'texto', '1.234']) {
    await enviar(ruta, { costoUnitario }, 400);
  }
  await enviar('/costos-faltantes/4', { costoUnitario: '180.00' }, 409);
  assert.equal(altas.length, 0);
});
