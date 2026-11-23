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

// NUEVO: respuesta de la API cuando la salida se registra correctamente (HU19).
export interface SalidaRegistrada {
  mensaje: string
  despacho: {
    id_orden_despacho: number
    codigo: string
    estado: string
    fecha_salida: string
  }
  movimientos: {
    id_movimiento: string
    id_sku: number
    cantidad: number
    saldo_posterior: number
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

// NUEVO: HU19. Registra la salida física de un despacho pendiente.
// El usuario no se envía: el backend lo toma de la sesión.
// Si falta stock, el backend responde 409 y su mensaje indica cuánto falta de cada SKU.
export async function registrarSalida(id: number): Promise<SalidaRegistrada> {
  const respuesta = await fetch(`/api/almacen/despachos/${id}/salida`, {
    method: 'POST',
    credentials: 'include',
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo registrar la salida.')
  return datos as SalidaRegistrada
}