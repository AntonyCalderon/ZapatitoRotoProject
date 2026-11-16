export interface ProductoSku {
  id_sku: number
  codigo_sku: string
  id_modelo: number
  id_talla: number
  id_color: number
  nombre_modelo: string
  numero_talla: string
  nombre_color: string
  activo: boolean
  modelo_activo: boolean
  talla_activa: boolean
  color_activo: boolean
}

export interface OpcionesSku {
  modelos: { id_modelo: number; nombre_modelo: string }[]
  tallas: { id_talla: number; numero_talla: string }[]
  colores: { id_color: number; nombre_color: string }[]
}

export interface DatosProductoSku {
  id_modelo: number
  id_talla: number
  id_color: number
}

type ProductoSkuGuardado = Pick<ProductoSku,
  'id_sku' | 'codigo_sku' | 'id_modelo' | 'id_talla' | 'id_color' | 'activo'>

async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  return datos as T
}

export async function obtenerOpcionesSku(): Promise<OpcionesSku> {
  const respuesta = await fetch('/api/productos-sku/opciones', { credentials: 'include' })
  return procesarRespuesta<OpcionesSku>(respuesta)
}

export async function obtenerProductosSku(q = '', estado = 'todos'): Promise<ProductoSku[]> {
  const parametros = new URLSearchParams({ q, estado })
  const respuesta = await fetch(`/api/productos-sku?${parametros}`, { credentials: 'include' })
  const datos = await procesarRespuesta<{ productos: ProductoSku[] }>(respuesta)
  return datos.productos
}

export async function consultarProductoSku(idSku: number): Promise<ProductoSku> {
  const respuesta = await fetch(`/api/productos-sku/${idSku}`, { credentials: 'include' })
  const datos = await procesarRespuesta<{ producto: ProductoSku }>(respuesta)
  return datos.producto
}

export async function registrarProductoSku(datos: DatosProductoSku) {
  const respuesta = await fetch('/api/productos-sku', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; producto: ProductoSkuGuardado }>(respuesta)
}

export async function cambiarEstadoProductoSku(idSku: number, activo: boolean) {
  const respuesta = await fetch(`/api/productos-sku/${idSku}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  })
  return procesarRespuesta<{ mensaje: string; producto: ProductoSkuGuardado }>(respuesta)
}
