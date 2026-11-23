import { Router } from 'express';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';
import { registrarSalidaController } from './salida.controller.js';

const router = Router();

// RN-01: solo el Encargado de Almacén registra la salida.
router.use(requerirAutenticacion, autorizarRoles('Almacen'));
router.post('/:id/salida', registrarSalidaController);

export default router;