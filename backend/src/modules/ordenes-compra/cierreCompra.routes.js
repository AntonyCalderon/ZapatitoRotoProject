import { Router } from 'express';
import { consultarHistoricoCompras, consultarCompraCerrada, cerrarCompra } from './cierreCompra.service.js';

// El router padre exige sesión activa y rol Compras.
const router = Router();
router.get('/historico', async (_req, res) => {
  res.set('Cache-Control', 'private, no-store').json(await consultarHistoricoCompras());
});
router.get('/historico/:id', async (req, res) => {
  res.set('Cache-Control', 'private, no-store').json({ orden: await consultarCompraCerrada(req.params.id) });
});
router.post('/:id/cierre', async (req, res) => {
  res.json({ mensaje: 'Orden cerrada y archivada.', ...await cerrarCompra(req.params.id, req.usuario.id_usuario) });
});
router.use((error, _req, res, _next) => {
  if (!error.status) console.error('Error en cierre de compra:', error);
  res.status(error.status || 500).json({ mensaje: error.status ? error.message : 'No se pudo procesar el cierre de compra.' });
});
export default router;
