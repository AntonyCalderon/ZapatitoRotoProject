// Representa los campos reales de la tabla color.
export interface Color {
  id_color: number
  nombre_color: string
  activo: boolean
}

export interface DatosColor {
  nombre_color: string
}

async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json()
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  }
  return datos as T
}

export async function obtenerColores(): Promise<Color[]> {
  const respuesta = await fetch('/api/colores', { credentials: 'include' })
  const datos = await procesarRespuesta<{ colores: Color[] }>(respuesta)
  return datos.colores
}

export async function registrarColor(datos: DatosColor) {
  const respuesta = await fetch('/api/colores', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; color: Color }>(respuesta)
}

export async function editarColor(idColor: number, datos: DatosColor) {
  const respuesta = await fetch(`/api/colores/${idColor}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
  return procesarRespuesta<{ mensaje: string; color: Color }>(respuesta)
}

export async function cambiarEstadoColor(idColor: number, activo: boolean) {
  const respuesta = await fetch(`/api/colores/${idColor}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  })
  return procesarRespuesta<{ mensaje: string; color: Color }>(respuesta)
}
