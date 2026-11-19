/*
@file lineaCompra.routes.js
@description Rutas HTTP de HU02: selección de modelos, colores y tallas dentro de un borrador de compra.
*/

import { Router } from 'express';
import {
  listarModelosController,
  listarColoresController,
  listarTallasController,
  consultarLineasController,
  guardarLineasController
} from './lineaCompra.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// Solo el Encargado de Compras arma solicitudes de compra.
router.use(requerirAutenticacion, autorizarRoles('Compras'));

router.get('/modelos', listarModelosController);
router.get('/modelos/:idModelo/colores', listarColoresController);
router.get('/modelos/:idModelo/colores/:idColor/tallas', listarTallasController);

router.get('/ordenes/:idOrden/lineas', consultarLineasController);
router.put('/ordenes/:idOrden/lineas', guardarLineasController);

export default router;
