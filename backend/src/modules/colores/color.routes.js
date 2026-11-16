import { Router } from 'express';
import {
  listarColoresController,
  crearColorController,
  editarColorController,
  cambiarEstadoColorController
} from './color.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// Solo el Administrador autenticado puede gestionar el catálogo de colores.
router.use(requerirAutenticacion, autorizarRoles('Administrador'));
router.get('/', listarColoresController);
router.post('/', crearColorController);
router.put('/:id', editarColorController);
router.patch('/:id/estado', cambiarEstadoColorController);

export default router;
