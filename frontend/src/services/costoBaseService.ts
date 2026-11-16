
/*
La pantalla utiliza estas funciones para comunicarse con las API de costos base que ya construimos.
*/

// Los tipos indican qué datos esperamos recibir del backend.

export interface Modelo {
    id_modelo: number;
    nombre_modelo: string;
  }
  
  export interface Talla {
    id_talla: number;
    numero_talla: string;
  }
  
  export interface OpcionesCostoBase {
    modelos: Modelo[];
    tallas: Talla[];
  }
  
  export interface ConsultaCostoBase {
    existe: boolean;
    costo_vigente: string | null;
  }
  
  export interface NuevoCostoBase {
    id_modelo: number;
    id_talla: number;
    costo_vigente: number;
  }
  
// Utilizaremos las rutas del backend a través de Vite.
const API_URL = '/api/costos-base';
  
/*
Al abrir el formulario, pide los modelos y tallas.
*/
  export async function obtenerOpciones(): Promise<OpcionesCostoBase> {
    const respuesta = await fetch(`${API_URL}/opciones`);
  
    if (!respuesta.ok) {
      throw new Error('No se pudieron cargar los modelos y tallas.');
    }
  
    return respuesta.json();
  }
  
/*
Cuando el usuario selecciona modelo y talla, consulta si ya existe un costo para esa combinación.
*/
  export async function consultarCosto(
    idModelo: number,
    idTalla: number
  ): Promise<ConsultaCostoBase> {
    const respuesta = await fetch(
      `${API_URL}?modelo=${idModelo}&talla=${idTalla}`
    );
  
    if (!respuesta.ok) {
      throw new Error('No se pudo consultar el costo registrado.');
    }
  
    return respuesta.json();
  }
  
/*
Cuando el usuario presiona Guardar costo, envía el nuevo registro al backend.
*/
  export async function registrarCosto(datos: NuevoCostoBase) {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });
  
    const resultado = await respuesta.json();
  
    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || 'No se pudo registrar el costo.'
      );
    }
  
    return resultado;
  }
  