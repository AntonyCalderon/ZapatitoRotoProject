/*
costoBase.controller.js
Controlador HTTP de la HU23.

Responsabilidad: Recibir las peticiones HTTP, llamar al servicio y devolver una respuesta JSON.
No ejecuta consultas SQL ni reglas de negocio.
*/

import {  obtenerModelosYTallas, // esto pertenece a la primera API
          consultarCostoBase, // esto pertenece a la segunda API
          registrarCostoBase // esto pertence a la tercera API, post
} from './costoBase.service.js';

/*
ESTO ES LA FUNCION PARA LA PRIMERA API
Atiende la solicitud de datos iniciales del formulario.

Endpoint: GET /api/costos-base/opciones
@param {import('express').Request} req - Petición HTTP.
@param {import('express').Response} res - Respuesta HTTP.
@returns {Promise<void>}

*/
export async function obtenerOpciones(req, res) {
  try {
    // Solicita los datos a la capa Service.
    const datos = await obtenerModelosYTallas();

    // HTTP 200: consulta realizada correctamente.
    res.status(200).json(datos);

  } catch (error) {
    console.error('Error al obtener opciones:', error.message);

    // HTTP 500: error interno del servidor.
    res.status(500).json({
      mensaje: 'No se pudieron obtener modelos y tallas.'
    });
  }
}

/*
ESTO ES LA FUNCION PARA LA SEGUNDA API:
Recibe el modelo y la talla desde la URL. Los envía al Service y responde con el costo encontrado.
*/

export async function obtenerCostoBase(req, res) {
  try {
    // Leemos los identificadores enviados en la URL.
    const idModelo = Number(req.query.modelo);
    const idTalla = Number(req.query.talla);

    // Comprobamos que ambos identificadores sean enteros positivos.
    if (
      !Number.isSafeInteger(idModelo) ||
      !Number.isSafeInteger(idTalla) ||
      idModelo <= 0 ||
      idTalla <= 0
    ) {
      return res.status(400).json({
        mensaje: 'Debes seleccionar un modelo y una talla válidos.'
      });
    }

    // Pedimos al Service que consulte el costo.
    const resultado = await consultarCostoBase(idModelo, idTalla);

    // Enviamos el resultado al cliente mediante JSON.
    return res.status(200).json(resultado);

  } catch (error) {
    console.error('Error al consultar costo base:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudo consultar el costo base.'
    });
  }
}

/*
Recibe los datos enviados por el formulario. Los valida y solicita al Service registrar el costo.
 */
export async function guardarCostoBase(req, res) {
  try {
    // Recibimos los datos del JSON enviado por el cliente.
    const { id_modelo, id_talla, costo_vigente } = req.body ?? {}; //req.body: contiene los datos JSON enviados por el cliente.

    // Comprobamos que modelo y talla sean identificadores válidos.
    if (
      !Number.isSafeInteger(id_modelo) || id_modelo <= 0 ||
      !Number.isSafeInteger(id_talla) || id_talla <= 0
    ) {
      return res.status(400).json({
        mensaje: 'Debes seleccionar un modelo y una talla válidos.'
      });
    }

    // Convertimos el importe recibido a un número.
    const importe = Number(costo_vigente);

    if (
      costo_vigente === null ||
      costo_vigente === undefined ||
      typeof costo_vigente === 'boolean' ||
      (typeof costo_vigente === 'string' && costo_vigente.trim() === '') ||
      !Number.isFinite(importe) ||
      importe <= 0 ||
      !Number.isInteger(importe * 100)
    ) {
      return res.status(400).json({
        mensaje: 'El costo debe ser mayor que cero y tener máximo dos decimales.'
      });
    }

    // Pedimos al Service que aplique las reglas y guarde el costo.
    const costo = await registrarCostoBase(id_modelo, id_talla, importe);

    return res.status(201).json({ // res.status(201) indica que se creó correctamente un recurso.
      mensaje: 'Costo base registrado correctamente',
      costo
    });

  } catch (error) {
    // PostgreSQL detectó otra inserción de la misma combinación.
    if (error.code === '23505') {
      return res.status(409).json({ // 409 indica que existe un conflicto, como intentar duplicar un costo.
        mensaje: 'Este modelo y talla ya tienen un costo registrado.'
      });
    }

    // PostgreSQL detectó que el modelo o la talla no existen.
    if (error.code === '23503') {
      return res.status(400).json({ // 400 indica que los datos de la solicitud son inválidos.
        mensaje: 'El modelo o la talla seleccionados no existen.'
      });
    }

    if (error.status) {
      return res.status(error.status).json({
        mensaje: error.message
      });
    }

    console.error('Error al registrar costo base:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudo registrar el costo base.'
    });
  }
}