import { Router } from 'express';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';
import { listarExistenciasController, consultarCatalogoController, consultarKardexController } from './inventario.controller.js';

const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Almacen'));
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/existencias', listarExistenciasController);
router.get('/catalogo', consultarCatalogoController);
router.get('/kardex/:skuId', consultarKardexController);

export default router;
