import { Router } from 'express';
import {
  crearBorradorController,
  listarBorradoresController,
  consultarOrdenCompraController,
  guardarBorradorController
} from './ordenCompra.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

import { agregarDetallesController, consultarDetallesController } from '../lineas-compra/lineaCompra.controller.js';

const router = Router();

// RN-02: solo el Encargado de Compras crea, consulta y guarda borradores.
router.use(requerirAutenticacion, autorizarRoles('Compras'));
router.post('/', crearBorradorController);
router.post('/:id/detalles', agregarDetallesController);
router.get('/:id/detalles', consultarDetallesController);
router.get('/', listarBorradoresController);
router.get('/:id', consultarOrdenCompraController);
// Se alinea el guardado ya existente; no habilita cancelar ni cambiar estados.
router.patch('/:id', guardarBorradorController);

export default router;