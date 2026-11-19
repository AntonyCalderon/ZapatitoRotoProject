import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioLineasCompra } from './lineaCompra.service.js';

const lineaGuardada = (id_sku, cantidad, nombre_modelo = 'Threshold') => ({
  id_sku, codigo_sku: `SKU-${id_sku}`, nombre_modelo, nombre_color: 'Negro', numero_talla: '40.0', cantidad
});

function crearRepositorioFalso({ orden = { estado: 'BORRADOR', lineas: [] }, problema = null } = {}) {
  const llamadas = [];
  return {
    llamadas,
    async listarModelosConSku() { return [{ id_modelo: 1, nombre_modelo: 'Threshold' }]; },
    async listarColoresPorModelo(idModelo) { llamadas.push(['colores', idModelo]); return []; },
    async listarTallasPorModeloYColor(idModelo, idColor) { llamadas.push(['tallas', idModelo, idColor]); return []; },
    async obtenerLineasDeOrden(idOrden) { llamadas.push(['leer', idOrden]); return orden; },
    async reemplazarLineas(idOrden, lineas) {
      llamadas.push(['guardar', idOrden, lineas]);
      if (problema) return { lineas: null, problema };
      return { lineas: lineas.map((l) => lineaGuardada(l.id_sku, l.cantidad)), problema: null };
    }
  };
}

test('guarda las líneas consolidadas y devuelve el total y los pares por modelo', async () => {
  const repositorio = crearRepositorioFalso();
  const servicio = crearServicioLineasCompra(repositorio);

  const resultado = await servicio.guardarLineasBorrador('7', [
    { id_sku: 1, cantidad: 6 },
    { id_sku: 2, cantidad: 3 },
    { id_sku: 1, cantidad: 6 },
    { id_sku: 9, cantidad: 0 }
  ]);

  assert.deepEqual(repositorio.llamadas[0], ['guardar', 7, [{ id_sku: 1, cantidad: 12 }, { id_sku: 2, cantidad: 3 }]]);
  assert.equal(resultado.total_pares, 15);
  assert.deepEqual(resultado.pares_por_modelo, [{ nombre_modelo: 'Threshold', pares: 15 }]);
});

test('permite guardar un borrador sin líneas', async () => {
  const repositorio = crearRepositorioFalso();
  const servicio = crearServicioLineasCompra(repositorio);

  const resultado = await servicio.guardarLineasBorrador(7, []);

  assert.equal(resultado.total_pares, 0);
  assert.deepEqual(repositorio.llamadas[0], ['guardar', 7, []]);
});

test('no abre la transacción cuando los datos son inválidos', async () => {
  const repositorio = crearRepositorioFalso();
  const servicio = crearServicioLineasCompra(repositorio);

  await assert.rejects(servicio.guardarLineasBorrador(7, [{ id_sku: 1, cantidad: -2 }]), { status: 400 });
  await assert.rejects(servicio.guardarLineasBorrador(7, [{ id_sku: 1, cantidad: 1.5 }]), { status: 400 });
  await assert.rejects(servicio.guardarLineasBorrador('abc', []), { status: 400 });
  await assert.rejects(servicio.guardarLineasBorrador(7, 'no es lista'), { status: 400 });
  assert.equal(repositorio.llamadas.length, 0);
});

test('traduce los problemas de la transacción a errores HTTP', async () => {
  const casos = [
    [{ tipo: 'orden_inexistente' }, 404],
    [{ tipo: 'no_es_borrador' }, 409],
    [{ tipo: 'sku_no_disponible', ids: [99] }, 409]
  ];

  for (const [problema, status] of casos) {
    const servicio = crearServicioLineasCompra(crearRepositorioFalso({ problema }));
    await assert.rejects(servicio.guardarLineasBorrador(7, [{ id_sku: 1, cantidad: 1 }]), { status });
  }
});

test('consulta las líneas de un borrador con su resumen', async () => {
  const orden = { estado: 'BORRADOR', lineas: [lineaGuardada(1, 12), lineaGuardada(2, 4, 'Colorado')] };
  const servicio = crearServicioLineasCompra(crearRepositorioFalso({ orden }));

  const resultado = await servicio.consultarLineasBorrador('5');

  assert.equal(resultado.estado, 'BORRADOR');
  assert.equal(resultado.total_pares, 16);
  assert.deepEqual(resultado.pares_por_modelo, [
    { nombre_modelo: 'Threshold', pares: 12 },
    { nombre_modelo: 'Colorado', pares: 4 }
  ]);
});

test('responde 404 si la orden consultada no existe', async () => {
  const servicio = crearServicioLineasCompra(crearRepositorioFalso({ orden: null }));
  await assert.rejects(servicio.consultarLineasBorrador(5), { status: 404 });
});

test('valida los identificadores antes de consultar colores y tallas', async () => {
  const repositorio = crearRepositorioFalso();
  const servicio = crearServicioLineasCompra(repositorio);

  await assert.rejects(servicio.consultarColores('abc'), { status: 400 });
  await assert.rejects(servicio.consultarTallas(1, 0), { status: 400 });
  assert.equal(repositorio.llamadas.length, 0);

  await servicio.consultarTallas('1', '2');
  assert.deepEqual(repositorio.llamadas[0], ['tallas', 1, 2]);
});
