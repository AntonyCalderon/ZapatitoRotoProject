/*
Service: aplica las reglas de negocio.
Cuando alguien llame a obtenerModelos():
    1. El Service ejecutará listarModelos().
    2. El Repository consultará la tabla modelo.
    3. PostgreSQL devolverá los registros.
    4. El Service entregará esos datos al Controller.

*/

import {
    listarModelos,
    crearModelo,
    actualizarModelo,
    cambiarEstadoModelo
  } from './modelo.repository.js';
  
  // Obtiene los modelos registrados para mostrarlos en la tabla.
  export async function obtenerModelos() {
    return await listarModelos();
  }
  

  // Valida los datos y registra un nuevo modelo.
  export async function registrarModelo(nombre, descripcion) {
  
    // El nombre debe ser texto y no estar vacío.
    if (typeof nombre !== 'string' || !nombre.trim()) {
      const error = new Error('El nombre del modelo es obligatorio.');
      error.status = 400;
      throw error;
    }
  
    // Quitamos espacios innecesarios.
    const nombreLimpio = nombre.trim();
  
    // Respetamos el límite de la columna nombre_modelo.
    if (nombreLimpio.length > 100) {
      const error = new Error('El nombre no puede superar 100 caracteres.');
      error.status = 400;
      throw error;
    }
  
    // La descripción es opcional, pero debe ser texto.
    if (
      descripcion !== undefined &&
      descripcion !== null &&
      typeof descripcion !== 'string'
    ) {
      const error = new Error('La descripción debe ser texto.');
      error.status = 400;
      throw error;
    }
  
    const descripcionLimpia =
      typeof descripcion === 'string'
        ? descripcion.trim() || null
        : null;
  
    // El Repository realiza el INSERT en PostgreSQL.
    return await crearModelo(nombreLimpio, descripcionLimpia);
  }


/**
 * Valida los datos y actualiza un modelo existente.
 */
export async function editarModelo(idModelo, nombre, descripcion) {

    // Comprobamos que el identificador sea un entero positivo.
    const id = Number(idModelo);
  
    if (!Number.isSafeInteger(id) || id <= 0) {
      const error = new Error('El ID del modelo no es válido.');
      error.status = 400;
      throw error;
    }
  
    // El nombre es obligatorio y debe contener texto.
    if (typeof nombre !== 'string' || !nombre.trim()) {
      const error = new Error('El nombre del modelo es obligatorio.');
      error.status = 400;
      throw error;
    }
  
    const nombreLimpio = nombre.trim();
  
    if (nombreLimpio.length > 100) {
      const error = new Error('El nombre no puede superar 100 caracteres.');
      error.status = 400;
      throw error;
    }
  
    // La descripción puede estar vacía, pero debe ser texto.
    if (
      descripcion !== undefined &&
      descripcion !== null &&
      typeof descripcion !== 'string'
    ) {
      const error = new Error('La descripción debe ser texto.');
      error.status = 400;
      throw error;
    }
  
    const descripcionLimpia =
      typeof descripcion === 'string'
        ? descripcion.trim() || null
        : null;
  
    if (descripcionLimpia && descripcionLimpia.length > 255) {
      const error = new Error('La descripción no puede superar 255 caracteres.');
      error.status = 400;
      throw error;
    }
  
    // Solicitamos al Repository actualizar el registro.
    const modelo = await actualizarModelo(
      id,
      nombreLimpio,
      descripcionLimpia
    );
  
    // Si no encontramos ese ID, informamos que no existe.
    if (!modelo) {
      const error = new Error('El modelo no existe.');
      error.status = 404;
      throw error;
    }
  
    return modelo;
  }
  


// Valida el identificador y el nuevo estado del modelo.
export async function actualizarEstadoModelo(idModelo, activo) {
    const id = Number(idModelo);
  
    if (!Number.isSafeInteger(id) || id <= 0) {
      const error = new Error('El ID del modelo no es válido.');
      error.status = 400;
      throw error;
    }
  
    // Solo aceptamos valores booleanos reales.
    if (typeof activo !== 'boolean') {
      const error = new Error('El estado debe ser true o false.');
      error.status = 400;
      throw error;
    }
  
    // Actualizamos únicamente la columna activo.
    const modelo = await cambiarEstadoModelo(id, activo);
  
    if (!modelo) {
      const error = new Error('El modelo no existe.');
      error.status = 404;
      throw error;
    }
  
    return modelo;
  }
  