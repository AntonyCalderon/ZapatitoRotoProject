/**
 * Servicio frontend para borradores de órdenes de compra (HU01).
 * Comunica React con /api/ordenes-compra.
 */

export interface OrdenCompra {
  id_orden_compra: number
  estado: 'BORRADOR' | 'EMITIDA' | 'CANCELADO'
  proveedor?: string | null
  codigo?: string | null
  subtotal?: string | null
  total?: string | null
  id_proveedor: number | null
  id_usuario_creador: number
  creador?: string
  fecha_creacion: string
  observacion: string | null
}

export interface DatosBorrador {
  id_proveedor?: number | null
  observacion?: string | null
}

interface Revision {
  proveedor: { razon_social: string } | null
  pares: number
  total: string | null
  igv: string | null
  subtotal: string | null
  version: string
  avisos: string[]
  lineas: { codigo_sku: string; anterior: string | null; costo: string | null }[]
}

async function solicitudCompra<T>(ruta: string, opciones?: RequestInit) {
  return procesarRespuesta<T>(await fetch('/api/ordenes-compra/' + ruta, {
    credentials: 'include', ...opciones
  }))
}
export const obtenerProveedores = () =>
  solicitudCompra<{ id_proveedor: number; razon_social: string }[]>('proveedores')
export interface OrdenEmitida {
  id_orden_compra:number; codigo:string; estado:'EMITIDA'; proveedor:string|null;
  situacion_logistica:'EN_TRANSITO'|'RECIBIDA'; lote_verificado:boolean;
  id_recepcion:number|null; usuario_almacen:string|null; fecha_recepcion:string|null;
  usuario_confirma:string|null; fecha_confirmacion:string|null;
}
export const obtenerEmitidas = () => solicitudCompra<OrdenEmitida[]>('emitidas')
export const confirmarCompraComercialmente = (id:number) =>
  solicitudCompra<{mensaje:string;orden:OrdenEmitida}>(id + '/confirmacion', {method:'POST'})
export const revisarEmision = (id: number) => solicitudCompra<Revision>(id + '/revision')
export interface OrigenCompra { tipo: string; referencia: string }
export const confirmarEmision = (id: number, version: string, origenes: OrigenCompra[]) =>
  solicitudCompra<{ codigo: string }>(id + '/emitir', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, origenes })
  })

// Procesa respuestas y errores enviados por Express.
async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json()

  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  }

  return datos as T
}

// GET: lista los borradores para la bandeja.
export async function obtenerBorradores(): Promise<OrdenCompra[]> {
  const respuesta = await fetch('/api/ordenes-compra?estado=BORRADOR', { credentials: 'include' })
  const datos = await procesarRespuesta<{ borradores: OrdenCompra[] }>(respuesta)
  return datos.borradores
}

// GET: consulta un borrador para abrirlo.
export async function consultarOrdenCompra(idOrden: number) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}`, { credentials: 'include' })
  return procesarRespuesta<{ orden: OrdenCompra }>(respuesta)
}

// POST: crea una solicitud vacía en estado Borrador (CA-01).
export async function crearBorrador() {
  const respuesta = await fetch('/api/ordenes-compra', {
    method: 'POST',
    credentials: 'include'
  })
  return procesarRespuesta<{ mensaje: string; orden: OrdenCompra }>(respuesta)
}

// PATCH: guarda los datos del borrador mediante la ruta del contrato acordado.
export async function guardarBorrador(idOrden: number, datos: DatosBorrador) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; orden: OrdenCompra }>(respuesta)
}
export async function cancelarBorrador(idOrden: number) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/cancelacion`, {
    method: 'POST',
    credentials: 'include'
  })
  return procesarRespuesta<{
    mensaje: string
    orden: { id_orden_compra: number; estado: 'CANCELADO'; id_usuario_cancela: number; fecha_cancelacion: string }
  }>(respuesta)
}
