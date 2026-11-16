import { Router } from 'express';
import {
  listarTallasController,
  crearTallaController,
  editarTallaController,
  cambiarEstadoTallaController
} from './talla.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// Todas las rutas de Tallas requieren sesión y rol Administrador.
router.use(requerirAutenticacion, autorizarRoles('Administrador'));
router.get('/', listarTallasController);
router.post('/', crearTallaController);
router.put('/:id', editarTallaController);
router.patch('/:id/estado', cambiarEstadoTallaController);

export default router;
