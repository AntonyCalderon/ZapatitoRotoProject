import { Router } from 'express';
import { requerirAutenticacion,autorizarRoles } from '../../middlewares/autorizarRoles.js';
import { confirmarRecepcionController } from './recepcion.controller.js';
const router=Router();
router.use(requerirAutenticacion,autorizarRoles('Almacen'));
router.post('/:id/confirmacion',confirmarRecepcionController);
export default router;
