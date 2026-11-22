import { Router } from 'express';
import { autorizarRoles, requerirAutenticacion } from '../../middlewares/autorizarRoles.js';
import { buscarPendienteDespacho, listarPendientesDespacho } from './despacho.repository.js';

const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Almacen', 'Administrador'));

router.get('/', async (_req, res) => {
  const despachos = await listarPendientesDespacho();
  return res.set('Cache-Control', 'private, no-store').json({ despachos });
});

router.get('/:idDespacho', async (req, res) => {
  const { idDespacho } = req.params;
  const id = Number(idDespacho);
  if (!/^\d+$/.test(idDespacho) || id < 1 || id > 2_147_483_647) {
    return res.status(400).json({ mensaje: 'El despacho indicado no es válido.' });
  }

  const despacho = await buscarPendienteDespacho(id);
  if (!despacho) {
    return res.status(404).json({ mensaje: 'El despacho solicitado ya no figura en la bandeja de pendientes.' });
  }
  return res.set('Cache-Control', 'private, no-store').json({ despacho });
});

export default router;
