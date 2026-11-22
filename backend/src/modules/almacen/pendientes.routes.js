import { Router } from 'express';
import { requerirAutenticacion,autorizarRoles } from '../../middlewares/autorizarRoles.js';
import { listarPendientesController,detalleRecepcionController } from './recepcion.controller.js';
const router=Router();
router.use(requerirAutenticacion,autorizarRoles('Almacen'));
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/',listarPendientesController);
router.get('/:id',detalleRecepcionController);
export default router;
