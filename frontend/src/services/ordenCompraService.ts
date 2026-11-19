/**
 * Servicio frontend para borradores de órdenes de compra (HU01).
 * Comunica React con /api/ordenes-compra.
 */

export interface OrdenCompra {
  id_orden_compra: number
  estado: string
  id_proveedor: number | null
  id_usuario_creador: number
  creador?: string
  fecha_creacion: string
  observacion: string | null
}

export interface DatosBorrador {
  id_proveedor: number | null
  observacion: string
}

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
  const respuesta = await fetch('/api/ordenes-compra', { credentials: 'include' })
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

// PUT: guarda manualmente el borrador (CA-02).
export async function guardarBorrador(idOrden: number, datos: DatosBorrador) {
  const respuesta = await fetch(`/api/ordenes-compra/${idOrden}/borrador`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; orden: OrdenCompra }>(respuesta)
}