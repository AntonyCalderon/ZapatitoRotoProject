/*
Comunica la pantalla de márgenes con /api/margenes.
*/

export interface MargenTipoCliente {
  id_tipo_cliente: number
  nombre: string
  segmento: 'B2G' | 'B2B' | 'B2C'
  porcentaje: string | null
  fecha_actualizacion: string | null
}

interface MargenGuardado {
  segmento: string
  porcentaje: string
  fecha_actualizacion: string
}

const API_URL = '/api/margenes'

async function procesarRespuesta<T>(respuesta: Response): Promise<T> {
  const datos = await respuesta.json().catch(() => ({}))

  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error al procesar la solicitud.')
  }

  return datos as T
}

// GET: lista los tipos de cliente con su margen actual.
export async function obtenerMargenes(): Promise<MargenTipoCliente[]> {
  const respuesta = await fetch(API_URL, { credentials: 'include' })
  const datos = await procesarRespuesta<{ margenes: MargenTipoCliente[] }>(respuesta)
  return datos.margenes
}

// PUT: guarda el porcentaje de un segmento.
export async function guardarMargen(segmento: string, porcentaje: number) {
  const respuesta = await fetch(`${API_URL}/${segmento}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ porcentaje })
  })

  return procesarRespuesta<{ mensaje: string; margen: MargenGuardado }>(respuesta)
}