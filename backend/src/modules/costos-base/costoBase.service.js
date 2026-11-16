/*
AQUI SE APLICAN LAS REGLAS DE NEGOCIO
 * @file costoBase.service.js
 * @description Servicio de aplicación para gestionar costos base.
 
 * Responsabilidad: COORDINA LA OBTENCION de modelos y tallas disponibles.
 * Correspondencia UML:
 * GestionarCostoBase →x obtenerModelosYTallas()
 
 * Este servicio no ejecuta SQL directamente ni maneja
 * peticiones HTTP.
 */

import {
  obtenerModelos,
  obtenerTallas, // Esta es de la primera funcionalidad. Pertenece a la segunda API
  buscarPorModeloYTalla,  // esta es para la segunda regla de negocio o para la segunda API
  crearCostoBase // esta es para la tercera regla de negocio y esta ligado a la tercera API
} 
from './costoBase.repository.js';

/*
 Obtiene los datos necesarios para cargar el formulario de registro de costos base. Objeto con las listas de modelos y tallas. Esta 
 funcionalidad pertenece a la primera API
 */
export async function obtenerModelosYTallas() {
  const [modelos, tallas] = await Promise.all([ // promise.all ejecuta ambas consultas de manera concurrente
    obtenerModelos(),
    obtenerTallas()
  ]);

  return {
    modelos,
    tallas
  };
}

/*
 FUNCION PARA LA SEGUNDA API
 Recibe el modelo y la talla seleccionados. Pide al Repository que busque su costo y devuelve el resultado.
 */
 export async function consultarCostoBase(idModelo, idTalla) {
  // Consultamos si existe un costo para esta combinación.
  const costo = await buscarPorModeloYTalla(idModelo, idTalla);

  // Si no existe, informamos que todavía no tiene costo registrado.
  if (!costo) {
    return {
      existe: false,
      costo_vigente: null
    };
  }

  // Si existe, devolvemos el importe que encontró PostgreSQL.
  return {
    existe: true,
    costo_vigente: costo.costo_vigente
  };
}

/*
 REGLA DE NEGOCIO PARA LA TERCERA API: registrar un costo base para una combinación de modelo y talla que todavía no tiene costo.
Comprueba que el costo sea válido y que aún no exista. Si cumple las condiciones, pide al Repository que lo guarde.
Aquí el Service toma una decisión: si ya existe un costo, no lo sobrescribe.
 */

export async function registrarCostoBase(idModelo, idTalla, importe) {

  // Un costo debe ser un número mayor que cero.
  if (!Number.isFinite(importe) || importe <= 0) {
    const error = new Error('El costo debe ser mayor que cero.');
    error.status = 400;
    throw error;
  }

  // Consultamos si la combinación de modelo y talla ya tiene costo.
  const existente = await buscarPorModeloYTalla(idModelo, idTalla);

  if (existente) {
    const error = new Error('Este modelo y talla ya tienen un costo registrado.');
    error.status = 409;
    throw error;
  }

  // Si no existe, registramos el costo en PostgreSQL.
  return await crearCostoBase(idModelo, idTalla, importe);
}