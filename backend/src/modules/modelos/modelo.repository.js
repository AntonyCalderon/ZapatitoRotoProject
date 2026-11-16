/*
¿Qué hará este Repository?
Será el encargado de comunicarse directamente con PostgreSQL para consultar los modelos registrados.

Por ahora implementaremos solo el SELECT, para comprobar la conexión. Después agregaremos el INSERT, UPDATE y desactivación.
*/

import pool from '../../config/database.js';

// Obtiene todos los modelos registrados, activos e inactivos.
export async function listarModelos() {
  const resultado = await pool.query(
    `SELECT
       id_modelo,
       nombre_modelo,
       descripcion,
       activo
     FROM modelo
     ORDER BY id_modelo ASC`
  );

  return resultado.rows;
}

/*
import pool: reutilizamos nuestra conexión PostgreSQL.
pool.query(): ejecuta una consulta SQL.
SELECT: recupera los cuatro campos de la tabla modelo.
ORDER BY id_modelo ASC: presenta los registros en orden de identificador.
resultado.rows: devuelve los modelos como un arreglo de objetos JavaScript.
*/


// Registra un nuevo modelo de zapatilla en PostgreSQL.
export async function crearModelo(nombre, descripcion) {
  const resultado = await pool.query(
    `INSERT INTO modelo (nombre_modelo, descripcion)
     VALUES ($1, $2)
     RETURNING id_modelo, nombre_modelo, descripcion, activo`,
    [nombre, descripcion]
  );

  return resultado.rows[0];
}
/*
PostgreSQL guardará el modelo y devolverá su identificador, nombre, descripción y estado.
Todavía no estamos creando la API POST: solo implementamos la operación de base de datos en el Repository.
*/


// Actualiza el nombre y la descripción de un modelo existente.
export async function actualizarModelo(idModelo, nombre, descripcion) {
  const resultado = await pool.query(
    `UPDATE modelo
     SET nombre_modelo = $1,
         descripcion = $2
     WHERE id_modelo = $3
     RETURNING id_modelo, nombre_modelo, descripcion, activo`,
    [nombre, descripcion, idModelo]
  );

  // Si el ID no existe, PostgreSQL no devuelve ninguna fila.
  return resultado.rows[0] ?? null;
}


/**
 * Cambia el estado de un modelo sin eliminarlo.
 * Devuelve el registro actualizado o null si no existe.
 */
export async function cambiarEstadoModelo(idModelo, activo) {
  const resultado = await pool.query(
    `UPDATE modelo
     SET activo = $1
     WHERE id_modelo = $2
     RETURNING id_modelo, nombre_modelo, descripcion, activo`,
    [activo, idModelo]
  );

  return resultado.rows[0] ?? null;
}
