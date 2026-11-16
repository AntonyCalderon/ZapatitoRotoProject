
import { obtenerModelos,
          registrarModelo,
          editarModelo,
          actualizarEstadoModelo
 } from './modelo.service.js';

// Recibe la petición GET y devuelve los modelos como JSON.
export async function listarModelosController(req, res) {
  try {
    // El Service obtiene los modelos desde PostgreSQL.
    const modelos = await obtenerModelos();

    // Respondemos con los registros encontrados.
    return res.status(200).json({ modelos });

  } catch (error) {
    console.error('Error al listar modelos:', error);

    return res.status(500).json({
      mensaje: 'No se pudieron obtener los modelos.'
    });
  }
}
/*
- ¿Qué significa res.status(200).json({ modelos })?
Le estamos diciendo a Express:
La consulta se ejecutó correctamente. Devuelve los modelos encontrados en formato JSON.
*/

// Atiende POST /api/modelos y registra un modelo nuevo.
export async function crearModeloController(req, res) {
  try {
    // Obtenemos los datos enviados desde React o Postman.
    const { nombre_modelo, descripcion } = req.body ?? {};

    // El Service valida los datos y solicita el registro.
    const modelo = await registrarModelo(
      nombre_modelo,
      descripcion
    );

    return res.status(201).json({
      mensaje: 'Modelo registrado correctamente.',
      modelo
    });

  } catch (error) {
    // El Service informa cuando los datos son inválidos.
    if (error.status === 400) {
      return res.status(400).json({
        mensaje: error.message
      });
    }

    // PostgreSQL impide registrar nombres repetidos.
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'Ya existe un modelo con ese nombre.'
      });
    }

    console.error('Error al registrar modelo:', error);

    return res.status(500).json({
      mensaje: 'No se pudo registrar el modelo.'
    });
  }
}


/**
 * Atiende PUT /api/modelos/:id.
 * Valida y actualiza un modelo existente.
 */
export async function editarModeloController(req, res) {
  try {
    // Recibimos el ID de la URL y los datos del formulario.
    const { id } = req.params;
    const { nombre_modelo, descripcion } = req.body ?? {};

    // El Service valida los datos y solicita el UPDATE.
    const modelo = await editarModelo(
      id,
      nombre_modelo,
      descripcion
    );

    return res.status(200).json({
      mensaje: 'Modelo actualizado correctamente.',
      modelo
    });

  } catch (error) {
    // Datos inválidos o modelo inexistente.
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        mensaje: error.message
      });
    }

    // PostgreSQL detectó un nombre duplicado.
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'Ya existe otro modelo con ese nombre.'
      });
    }

    console.error('Error al editar modelo:', error);

    return res.status(500).json({
      mensaje: 'No se pudo actualizar el modelo.'
    });
  }
}


// Atiende PATCH /api/modelos/:id/estado.
export async function cambiarEstadoModeloController(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body ?? {};

    const modelo = await actualizarEstadoModelo(id, activo);

    return res.status(200).json({
      mensaje: modelo.activo
        ? 'Modelo activado correctamente.'
        : 'Modelo desactivado correctamente.',
      modelo
    });

  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        mensaje: error.message
      });
    }

    console.error('Error al cambiar estado del modelo:', error);

    return res.status(500).json({
      mensaje: 'No se pudo cambiar el estado del modelo.'
    });
  }
}
