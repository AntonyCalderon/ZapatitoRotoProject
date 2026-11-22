import { Router } from 'express';
import pool from '../../config/database.js';
import { listarEmitidasConRecepcion, confirmarCompraComercialmente } from './confirmacionCompra.repository.js';
import { procesarEmision } from '../../casos-uso/emitirOrden.js';
import { pdfOrden } from './ordenPdf.js';

const router = Router();
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

router.get('/proveedores', async (_req, res) => {
  const { rows } = await pool.query('SELECT id_proveedor, razon_social FROM proveedor ORDER BY razon_social');
  res.json(rows);
});
router.get('/emitidas', async (_req,res) => {
  res.set('Cache-Control','private, no-store').json(await listarEmitidasConRecepcion());
});
router.post('/:id/confirmacion', async (req,res) => {
  const orden = await confirmarCompraComercialmente(req.params.id,req.usuario.id_usuario);
  res.json({ mensaje:'Confirmación comercial registrada.',orden });
});
router.get('/:id/revision', async (req,res) => res.json(await procesarEmision(req.params.id, req.session.idUsuario, null)));
router.post('/:id/emitir', async (req,res) => res.json(await procesarEmision(req.params.id, req.session.idUsuario, req.body ?? {})));
router.get('/:id/pdf', async (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw fallo(400, 'Identificador inválido.');
  const { rows: [orden] } = await pool.query(`SELECT codigo,total,documento_emitido,
    to_char(fecha_emision AT TIME ZONE 'America/Lima','DD/MM/YYYY') AS fecha
    FROM orden_compra WHERE id_orden_compra=$1 AND documento_emitido IS NOT NULL`, [id]);
  if (!orden) throw fallo(404, 'Documento no disponible.');
  res.attachment(orden.codigo + '.pdf').send(pdfOrden(orden));
});
router.use((error, _req, res, _next) => {
  if (!error.status) console.error('Error en emisión de compra', error);
  res.status(error.status || 500).json({ mensaje: error.status ? error.message : 'No se pudo procesar la orden.' });
});
export default router;
