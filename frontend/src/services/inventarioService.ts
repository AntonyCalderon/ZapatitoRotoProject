export type SituacionStock = 'disponible' | 'stock_bajo' | 'agotado' | 'sin_minimo'
export type CatalogoInventario = 'activos' | 'inactivos' | 'todos'
export type TipoMovimiento = 'APERTURA' | 'ENTRADA_COMPRA' | 'SALIDA_VENTA'

export interface ProductoInventario {
  id_sku: number
  codigo_sku: string
  modelo: string
  color: string
  talla: string
  cantidad_actual: number
  stock_minimo: number | null
  situacion: SituacionStock
  catalogo_activo: boolean
}
export interface PaginaInventario<T> {
  items: T[]
  pagina: number
  tamano: number
  total: number
}
export interface CatalogoFiltrosInventario {
  modelos: { id_modelo: number; nombre_modelo: string }[]
  colores: { id_color: number; nombre_color: string }[]
  tallas: { id_talla: number; numero_talla: string }[]
}
export interface MovimientoInventario {
  id_movimiento: string
  fecha: string
  tipo_movimiento: TipoMovimiento
  entrada: number
  salida: number
  saldo_posterior: number
  responsable: string
  documento_origen: { tipo: 'RECEPCION' | 'DESPACHO' | 'APERTURA'; id: number | null; codigo: string | null }
}
export interface KardexInventario extends PaginaInventario<MovimientoInventario> {
  producto: Omit<ProductoInventario, 'cantidad_actual'>
  cantidad_actual: number
}
export interface FiltrosExistencias {
  q: string
  id_modelo: string
  id_color: string
  id_talla: string
  catalogo: CatalogoInventario
  situacion: SituacionStock | 'todos'
  pagina: number
  tamano: number
}
export interface FiltrosKardex {
  desde: string
  hasta: string
  tipo_movimiento: TipoMovimiento | 'todos'
  pagina: number
  tamano: number
}

async function consultar<T>(ruta: string, filtros: object, signal: AbortSignal): Promise<T> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filtros)) {
    if (value !== '' && value !== undefined) params.set(key, String(value))
  }
  const respuesta = await fetch('/api/almacen' + ruta + '?' + params.toString(), { credentials: 'include', signal })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new Error(datos?.mensaje || 'No se pudo consultar el inventario. Inténtalo nuevamente.')
  if (!datos) throw new Error('El servidor devolvió una respuesta inválida.')
  return datos as T
}

export function listarExistencias(filtros: FiltrosExistencias, signal: AbortSignal) {
  return consultar<PaginaInventario<ProductoInventario>>('/existencias', filtros, signal)
}
export function obtenerCatalogoInventario(signal: AbortSignal) {
  return consultar<CatalogoFiltrosInventario>('/catalogo', { catalogo: 'todos' }, signal)
}
export function obtenerKardexInventario(skuId: string, filtros: FiltrosKardex, signal: AbortSignal) {
  return consultar<KardexInventario>('/kardex/' + encodeURIComponent(skuId), filtros, signal)
}
