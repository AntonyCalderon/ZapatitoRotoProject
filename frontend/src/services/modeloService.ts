
/**
 * Servicio frontend para administrar modelos.
 * Comunica React con las API de Express.
 */

// Representa un registro de la tabla modelo.
export interface Modelo {
    id_modelo: number
    nombre_modelo: string
    descripcion: string | null
    activo: boolean
  }
  
  // Datos que el Administrador escribe en el formulario.
  export interface DatosModelo {
    nombre_modelo: string
    descripcion: string
  }
  
  // Procesa respuestas y errores enviados por Express.
  async function procesarRespuesta<T>(
    respuesta: Response
  ): Promise<T> {
    const datos = await respuesta.json()
  
    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje || 'Ocurrió un error al procesar la solicitud.'
      )
    }
  
    return datos as T
  }
  
  // GET: recupera los modelos activos e inactivos.
  export async function obtenerModelos(): Promise<Modelo[]> {
    const respuesta = await fetch('/api/modelos', {
      credentials: 'include'
    })
  
    const datos = await procesarRespuesta<{ modelos: Modelo[] }>(
      respuesta
    )
  
    return datos.modelos
  }
  
  // POST: registra un modelo nuevo.
  export async function registrarModelo(datos: DatosModelo) {
    const respuesta = await fetch('/api/modelos', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    })
  
    return procesarRespuesta<{
      mensaje: string
      modelo: Modelo
    }>(respuesta)
  }
  
  // PUT: modifica el nombre y la descripción.
  export async function editarModelo(
    idModelo: number,
    datos: DatosModelo
  ) {
    const respuesta = await fetch(`/api/modelos/${idModelo}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    })
  
    return procesarRespuesta<{
      mensaje: string
      modelo: Modelo
    }>(respuesta)
  }
  
  // PATCH: activa o desactiva un modelo existente.
  export async function cambiarEstadoModelo(
    idModelo: number,
    activo: boolean
  ) {
    const respuesta = await fetch(
      `/api/modelos/${idModelo}/estado`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activo })
      }
    )
  
    return procesarRespuesta<{
      mensaje: string
      modelo: Modelo
    }>(respuesta)
  }
  