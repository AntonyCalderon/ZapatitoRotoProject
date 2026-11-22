import { listarExistencias, obtenerCatalogo, obtenerKardex } from './inventario.repository.js';

function invalido(mensaje) {
  return Object.assign(new Error(mensaje), { status: 400, codigo: 'FILTRO_INVALIDO' });
}

function texto(valor, nombre) {
  if (typeof valor !== 'string') throw invalido(`${nombre} debe tener un solo valor de texto.`);
  return valor.trim();
}

function entero(valor, nombre, maximo = 2147483647) {
  const cadena = texto(valor, nombre);
  if (!/^[1-9]\d*$/.test(cadena) || !Number.isSafeInteger(Number(cadena)) || Number(cadena) > maximo) {
    throw invalido(`${nombre} debe ser un entero entre 1 y ${maximo}.`);
  }
  return Number(cadena);
}

function opcion(valor, nombre, opciones, predeterminado) {
  if (valor === undefined) return predeterminado;
  const cadena = texto(valor, nombre);
  if (!opciones.includes(cadena)) throw invalido(`${nombre} no es válido. Opciones: ${opciones.join(', ')}.`);
  return cadena;
}

function fecha(valor, nombre) {
  if (valor === undefined) return null;
  const cadena = texto(valor, nombre);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cadena) || cadena.startsWith('0000')) {
    throw invalido(`${nombre} debe ser una fecha válida con formato YYYY-MM-DD.`);
  }
  const fechaUtc = new Date(cadena + 'T00:00:00Z');
  if (Number.isNaN(fechaUtc.getTime()) || fechaUtc.toISOString().slice(0, 10) !== cadena) {
    throw invalido(`${nombre} no es una fecha válida.`);
  }
  return cadena;
}

function paginacion(query) {
  return {
    pagina: query.pagina === undefined ? 1 : entero(query.pagina, 'pagina'),
    tamano: query.tamano === undefined ? 20 : entero(query.tamano, 'tamano', 100),
  };
}

const estadosCatalogo = ['activos', 'inactivos', 'todos'];

export async function consultarExistencias(query = {}) {
  const q = query.q === undefined ? '' : texto(query.q, 'q');
  if (q.length > 100) throw invalido('q no puede superar 100 caracteres.');
  const filtros = {
    ...paginacion(query), q,
    catalogo: opcion(query.catalogo, 'catalogo', estadosCatalogo, 'activos'),
    situacion: opcion(query.situacion, 'situacion', ['todos', 'agotado', 'stock_bajo', 'disponible', 'sin_minimo'], 'todos'),
  };
  for (const campo of ['id_modelo', 'id_color', 'id_talla']) {
    filtros[campo] = query[campo] === undefined ? null : entero(query[campo], campo);
  }
  return listarExistencias(filtros);
}

export async function consultarCatalogo(query = {}) {
  return obtenerCatalogo(opcion(query.catalogo, 'catalogo', estadosCatalogo, 'activos'));
}

export async function consultarKardex(skuId, query = {}) {
  const id = entero(skuId, 'skuId');
  const filtros = {
    ...paginacion(query),
    desde: fecha(query.desde, 'desde'), hasta: fecha(query.hasta, 'hasta'),
    tipo_movimiento: opcion(query.tipo_movimiento, 'tipo_movimiento',
      ['todos', 'APERTURA', 'ENTRADA_COMPRA', 'SALIDA_VENTA'], 'todos'),
  };
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw invalido('desde no puede ser posterior a hasta.');
  }
  const kardex = await obtenerKardex(id, filtros);
  if (!kardex) throw Object.assign(new Error('El SKU indicado no existe.'), { status: 404, codigo: 'SKU_NO_ENCONTRADO' });
  return kardex;
}
