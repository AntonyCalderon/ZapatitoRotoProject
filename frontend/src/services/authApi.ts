export interface UsuarioAutenticado {
    id_usuario: number;
    nombre: string;
    correo: string;
    roles: string[];
    debe_cambiar_password: boolean;
  }
  
  interface RespuestaLogin {
    mensaje: string;
    usuario: UsuarioAutenticado;
  }
  
  // Centralizamos las peticiones de autenticación.
  async function solicitar<T>(
    ruta: string,
    opciones: RequestInit = {}
  ): Promise<T> {
    const respuesta = await fetch(`/api/auth${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...opciones.headers
      }
    });
  
    const datos = await respuesta.json();
  
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Error al comunicarse con el servidor.');
    }
  
    return datos as T;
  }
  
  // Envía el correo y la contraseña a Express.
  export async function iniciarSesion(correo: string, password: string) {
    return solicitar<RespuestaLogin>('/login', {
      method: 'POST',
      body: JSON.stringify({ correo, password })
    });
  }
  
  // Recupera la identidad del trabajador que tiene sesión activa.
  export async function obtenerSesion() {
    return solicitar<{ usuario: UsuarioAutenticado }>('/me');
  }

  export async function cambiarPassword(passwordActual: string, passwordNueva: string) {
    return solicitar<{ mensaje: string; usuario: UsuarioAutenticado }>('/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({ passwordActual, passwordNueva })
    });
  }
  
  // Cierra la sesión almacenada en PostgreSQL.
  export async function cerrarSesion() {
    return solicitar<{ mensaje: string }>('/logout', {
      method: 'POST'
    });
  }
  
