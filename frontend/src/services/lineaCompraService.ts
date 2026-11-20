/*
Comunicación con las API de líneas de compra y del resumen de costos del borrador.
*/

import type { DatosResumenCostoAdquisicion } from '../components/ResumenCostoAdquisicion'
import type { LineaSolicitud, ParesPorModelo } from '../utils/lineasCompra'

export interface ModeloCompra {
  id_modelo: number
  nombre_modelo: string
}

export interface ColorCompra {
  id_color: number
  nombre_color: string
}

export interface TallaCompra {
  id_sku: number
  id_talla: number
  numero_talla: string
}

export interface LineaPedida {
  id_sku: number
  cantidad: number
}

export interface LineasBorrador {
  estado?: string
  lineas: LineaSolicitud[]
  total_pares: number
  pares_por_modelo: ParesPorModelo[]
}

const API_URL = '/api/lineas-compra'

async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  return datos as T
}

export async function obtenerModelosCompra(): Promise<ModeloCompra[]> {
  const respuesta = await fetch(`${API_URL}/modelos`, { credentials: 'include' })
  return (await procesarRespuesta<{ modelos: ModeloCompra[] }>(respuesta)).modelos
}

export async function obtenerColoresCompra(idModelo: number): Promise<ColorCompra[]> {
  const respuesta = await fetch(`${API_URL}/modelos/${idModelo}/colores`, { credentials: 'include' })
  return (await procesarRespuesta<{ colores: ColorCompra[] }>(respuesta)).colores
}

export async function obtenerTallasCompra(idModelo: number, idColor: number): Promise<TallaCompra[]> {
  const respuesta = await fetch(`${API_URL}/modelos/${idModelo}/colores/${idColor}/tallas`, { credentials: 'include' })
  return (await procesarRespuesta<{ tallas: TallaCompra[] }>(respuesta)).tallas
}

// Líneas ya guardadas en el borrador.
export async function obtenerLineasBorrador(idOrden: number): Promise<LineasBorrador> {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/detalles`, { credentials: 'include' })
  return procesarRespuesta<LineasBorrador>(respuesta)
}

// Agrega solo las líneas nuevas, en una única transacción.
export async function guardarLineasBorrador(idOrden: number, lineas: LineaPedida[]) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/detalles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineas })
  })
  return procesarRespuesta<LineasBorrador & { mensaje: string }>(respuesta)
}

export interface VarianteCompra {
  id_sku: number
  codigo_sku: string
  id_modelo: number
  nombre_modelo: string
  id_color: number
  nombre_color: string
  id_talla: number
  numero_talla: string
  costo_base_vigente: string | null
}
export interface CatalogoCompra {
  modelos: ModeloCompra[]
  colores: ColorCompra[]
  tallas: {id_talla: number; numero_talla: string}[]
  variantes: VarianteCompra[]
}
export async function obtenerCatalogoCompra(): Promise<CatalogoCompra> {
  const respuesta = await fetch(API_URL + '/catalogo', {credentials:'include'})
  return procesarRespuesta<CatalogoCompra>(respuesta)
}

export async function calcularResumenCostos(idOrden: number, lineas: LineaPedida[], signal: AbortSignal) {
  const respuesta = await fetch(`/api/compras/ordenes/${idOrden}/resumen-costos`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineas }),
    signal
  })
  return procesarRespuesta<DatosResumenCostoAdquisicion>(respuesta)
}


export async function modificarCantidadDetalle(idOrden: number, idDetalle: number, cantidad: number, cantidadAnterior: number) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/detalles/${idDetalle}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantidad, cantidad_anterior: cantidadAnterior })
  })
  return procesarRespuesta<LineasBorrador>(respuesta)
}

export async function quitarDetalle(idOrden: number, idDetalle: number) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/detalles/${idDetalle}`, {
    method: 'DELETE', credentials: 'include'
  })
  return procesarRespuesta<LineasBorrador>(respuesta)
}

// Cada confirmación actualiza la base del siguiente intento. Si una operación
// posterior falla, no se repiten las altas o cambios ya confirmados por la API.
export async function guardarCambiosLineas(
  idOrden: number, deseadas: LineaSolicitud[], guardadas: LineaSolicitud[],
  confirmar: (lineas: LineaSolicitud[]) => void
) {
  const eliminadas = guardadas.filter(g => !deseadas.some(d => d.id_sku === g.id_sku))
  const modificadas = deseadas.filter(d => guardadas.some(g => g.id_sku === d.id_sku && g.cantidad !== d.cantidad))
  const nuevas = deseadas.filter(d => !guardadas.some(g => g.id_sku === d.id_sku))
  const persistidas = [...eliminadas, ...modificadas.map(d => guardadas.find(g => g.id_sku === d.id_sku)!)]
  if (persistidas.some(l => !Number.isInteger(l.id_detalle_compra) || l.id_detalle_compra! <= 0)) {
    throw new Error('Falta el identificador de una línea guardada. Vuelve a abrir el borrador.')
  }
  let resultado = guardadas
  const confirmarResultado = (datos: LineasBorrador) => { resultado = datos.lineas; confirmar(resultado) }
  for (const linea of eliminadas) confirmarResultado(await quitarDetalle(idOrden, linea.id_detalle_compra!))
  for (const linea of modificadas) {
    const anterior = guardadas.find(g => g.id_sku === linea.id_sku)!
    confirmarResultado(await modificarCantidadDetalle(idOrden, anterior.id_detalle_compra!, linea.cantidad, anterior.cantidad))
  }
  if (nuevas.length) confirmarResultado(await guardarLineasBorrador(idOrden, nuevas.map(({id_sku,cantidad}) => ({id_sku,cantidad}))))
  return resultado
}
