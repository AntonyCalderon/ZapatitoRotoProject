import { Router } from 'express';
import emisionRoutes from './emision.routes.js';
import {
  crearBorradorController,
  listarBorradoresController,
  consultarOrdenCompraController,
  guardarBorradorController
} from './ordenCompra.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// RN-02: solo el Encargado de Compras crea, consulta y guarda borradores.
router.use(requerirAutenticacion, autorizarRoles('Compras'));
router.use(emisionRoutes);
router.post('/', crearBorradorController);
router.get('/', listarBorradoresController);
router.get('/:id', consultarOrdenCompraController);
router.put('/:id/borrador', guardarBorradorController);

export default router;
