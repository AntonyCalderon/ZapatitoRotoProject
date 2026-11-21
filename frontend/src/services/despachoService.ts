export interface DespachoPendiente {
  id_orden_despacho: number
  codigo: string
  fecha_emision: string
  cliente: string
  direccion: string | null
  tipo_comprobante: string | null
  serie_comprobante: string | null
  numero_comprobante: string | null
}

export interface DetalleDespacho extends DespachoPendiente {
  productos: {
    id_sku: number
    modelo: string
    color: string
    talla: string
    cantidad: number
  }[]
}

async function solicitar<T>(ruta: string, signal: AbortSignal): Promise<T> {
  const respuesta = await fetch('/api/almacen/pendientes-despacho' + ruta, {
    credentials: 'include', signal,
  })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo consultar el despacho.')
  return datos as T
}

export function listarDespachos(signal: AbortSignal) {
  return solicitar<{ despachos: DespachoPendiente[] }>('', signal)
}

export function consultarDespacho(id: string, signal: AbortSignal) {
  return solicitar<{ despacho: DetalleDespacho }>('/' + encodeURIComponent(id), signal)
}
