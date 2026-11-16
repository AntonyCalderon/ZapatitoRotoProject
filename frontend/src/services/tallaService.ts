// PostgreSQL devuelve NUMERIC(4,1) como texto para conservar su precisión.
export interface Talla {
  id_talla: number
  numero_talla: string
  activo: boolean
}

export interface DatosTalla {
  numero_talla: string
}

async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json()
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  }
  return datos as T
}

export async function obtenerTallas(): Promise<Talla[]> {
  const respuesta = await fetch('/api/tallas', { credentials: 'include' })
  const datos = await procesarRespuesta<{ tallas: Talla[] }>(respuesta)
  return datos.tallas
}

export async function registrarTalla(datos: DatosTalla) {
  const respuesta = await fetch('/api/tallas', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; talla: Talla }>(respuesta)
}

export async function editarTalla(idTalla: number, datos: DatosTalla) {
  const respuesta = await fetch(`/api/tallas/${idTalla}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; talla: Talla }>(respuesta)
}

export async function cambiarEstadoTalla(idTalla: number, activo: boolean) {
  const respuesta = await fetch(`/api/tallas/${idTalla}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  })
  return procesarRespuesta<{ mensaje: string; talla: Talla }>(respuesta)
}
