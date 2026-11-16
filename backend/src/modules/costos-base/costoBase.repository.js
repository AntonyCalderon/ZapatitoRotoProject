// entonces lo que hacemos aqui es crear una funcion que se encargara de obtener los modelos y tallas disponibles en la base de datos.
// para ello lo primero que hacemos es importar la conexion de la BD
/*
Responsabilidad:
CONSULTAR los modelos y tallas disponibles en PostgreSQL.
Este módulo no recibe peticiones HTTP ni contiene
componentes de interfaz.
*/

import pool from '../../config/database.js'; // Importa la conexión a la base de datos. Esta es la conexion de la BD que configuramos y probamos
// En este caso, pool es el objeto que contiene la conexión a la base de datos.

/*
Obtiene los modelos activos del catálogo.
Lista de modelos con sus identificadores y nombres.
*/
export async function obtenerModelos() {
  const resultado = await pool.query(`
    SELECT id_modelo, nombre_modelo
    FROM modelo
    WHERE activo = TRUE
    ORDER BY nombre_modelo
  `);

  return resultado.rows;
}

/*
Obtiene las tallas activas del catálogo.
Listar las tallas con sus identificadores y números.
*/
export async function obtenerTallas() {
  const resultado = await pool.query(` 
    SELECT id_talla, numero_talla
    FROM talla
    WHERE activo = TRUE
    ORDER BY numero_talla
  `);

  return resultado.rows; // Devuelve el resultado de la consulta. En este caso, el resultado es un array de objetos.
}



/**
 * Esto es para la segunda API
 * BUSCA el costo vigente de un modelo y una talla.
 * Si existe, devuelve su registro; si no, devuelve null.
 */
export async function buscarPorModeloYTalla(idModelo, idTalla) {
  // Buscamos el costo correspondiente a la combinación seleccionada.
  const resultado = await pool.query(
    `SELECT id_costo_base, costo_vigente
     FROM costo_base
     WHERE id_modelo = $1 AND id_talla = $2`,
     //Pero en JavaScript utilizamos $1 y $2 para enviar los valores
     //como parámetros, evitando construir el SQL concatenando entradas del usuario.
    [idModelo, idTalla]
  );

  // Entregamos el registro encontrado o null si todavía no tiene costo.
  return resultado.rows[0] ?? null;
}

/*
Guardar el costo en PostgreSQL. Este codigo pertenecera a la tercera API: registrar información en PostgreSQL mediante un POST.
Recibe un modelo, una talla y un importe. Guarda el nuevo costo en PostgreSQL y devuelve el registro creado.
*/
export async function crearCostoBase(idModelo, idTalla, importe) {
  // Enviamos los datos a PostgreSQL para registrar el costo.
  const resultado = await pool.query(
    `INSERT INTO costo_base (id_modelo, id_talla, costo_vigente)
     VALUES ($1, $2, $3)
     RETURNING id_costo_base, id_modelo, id_talla, costo_vigente`,
     // PostgreSQL guarda el costo y devuelve los datos del registro recién creado. Así obtenemos también su identificador generado automáticamente.
    [idModelo, idTalla, importe]
  );

  // Entregamos al Service el registro que acaba de guardarse.
  return resultado.rows[0];
}