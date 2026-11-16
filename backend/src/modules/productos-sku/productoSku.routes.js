import { Router } from 'express';
import {
  listarProductosSkuController,
  consultarProductoSkuController,
  opcionesSkuController,
  crearProductoSkuController,
  cambiarEstadoProductoSkuController
} from './productoSku.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// Toda la API administrativa exige sesión y rol Administrador.
router.use(requerirAutenticacion, autorizarRoles('Administrador'));
router.get('/opciones', opcionesSkuController);
router.get('/', listarProductosSkuController);
router.get('/:id', consultarProductoSkuController);
router.post('/', crearProductoSkuController);
router.patch('/:id/estado', cambiarEstadoProductoSkuController);

export default router;
