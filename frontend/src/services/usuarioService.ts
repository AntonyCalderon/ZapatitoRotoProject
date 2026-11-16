export interface Usuario {
  id_usuario: number
  nombre: string
  correo: string
  roles: string[]
  activo: boolean
  debe_cambiar_password: boolean
}
export interface Rol { id_rol: number; nombre_rol: string }
export interface DatosUsuario { nombre: string; correo: string; roles: number[] }

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`/api/usuarios${ruta}`, { ...opciones, credentials: 'include', headers: { 'Content-Type': 'application/json', ...opciones.headers } })
  let datos: { mensaje?: string } & T
  try {
    datos = await respuesta.json() as { mensaje?: string } & T
  } catch {
    throw new Error(`El servidor devolvió una respuesta inesperada (HTTP ${respuesta.status}). Verifica que el backend esté actualizado y en ejecución.`)
  }
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo completar la operación.')
  return datos as T
}
export async function obtenerUsuarios() { return (await solicitar<{ usuarios: Usuario[] }>('')).usuarios }
export async function obtenerRoles() { return (await solicitar<{ roles: Rol[] }>('/roles')).roles }
export async function crearUsuario(datos: DatosUsuario) {
  return solicitar<{ usuario: Usuario; passwordTemporal: string }>('', { method: 'POST', body: JSON.stringify(datos) })
}
export async function cambiarEstadoUsuario(id: number, activo: boolean) {
  return solicitar<{ usuario: Omit<Usuario, 'roles'> }>(`/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ activo }) })
}
