
import { Router } from 'express';

import { listarModelosController,
        crearModeloController,
        editarModeloController,
        cambiarEstadoModeloController
 } from './modelo.controller.js';

import {
  requerirAutenticacion,
  autorizarRoles
} from '../../middlewares/autorizarRoles.js';

const router = Router();

// Solo el Administrador puede gestionar el catálogo de modelos.
router.use(
  requerirAutenticacion,
  autorizarRoles('Administrador')
);

// GET /api/modelos: devuelve los modelos registrados.
router.get('/', listarModelosController);

// Registra un nuevo modelo.
router.post('/', crearModeloController);

// Actualiza un modelo existente mediante su identificador.
router.put('/:id', editarModeloController);

// Activa o desactiva un modelo existente.
router.patch('/:id/estado', cambiarEstadoModeloController);

export default router;
