export interface ProductoParaVenta {
  id_sku: number
  codigo_sku: string
  id_modelo: number
  modelo: string
  id_color: number
  color: string
  id_talla: number
  talla: string
  disponible: number
}

export interface VentaEnBandeja {
  id_orden_venta: number
  cliente: string
  segmento: string
  fecha_creacion: string
}

interface LineaVenta extends Pick<ProductoParaVenta, 'id_sku' | 'codigo_sku' | 'modelo' | 'color' | 'talla'> {
  cantidad: number
  motivo: string | null
  precio_con_igv: string | null
  importe: string | null
}

export interface PreciosBorrador extends Omit<VentaEnBandeja, 'fecha_creacion'> {
  lineas: LineaVenta[]
  subtotal: string | null
  igv: string | null
  total: string | null
}

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch('/api/ventas/precios' + ruta, { credentials: 'include', ...opciones })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos) throw new Error(datos?.mensaje || 'No se pudo procesar la operación de Ventas.')
  return datos as T
}

const rutaBorrador = (idOrden: string) => '/borradores/' + encodeURIComponent(idOrden)

export async function listarBorradoresVenta(signal: AbortSignal) {
  return (await solicitar<{ borradores: VentaEnBandeja[] }>('/borradores', { signal })).borradores
}

export async function listarProductosVenta(signal: AbortSignal) {
  return (await solicitar<{ productos: ProductoParaVenta[] }>('/productos', { signal })).productos
}

export async function consultarPreciosBorrador(idOrden: string, signal: AbortSignal) {
  return (await solicitar<{ borrador: PreciosBorrador }>(rutaBorrador(idOrden), { signal })).borrador
}

export async function agregarLineaVenta(idOrden: string, idSku: number, cantidad: number) {
  return (await solicitar<{ borrador: PreciosBorrador }>(rutaBorrador(idOrden) + '/lineas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_sku: idSku, cantidad }),
  })).borrador
}

export async function quitarLineaVenta(idOrden: string, idSku: number) {
  return (await solicitar<{ borrador: PreciosBorrador }>(rutaBorrador(idOrden) + '/lineas/' + idSku, {
    method: 'DELETE',
  })).borrador
}
