import { Router } from 'express';
import pool from '../../config/database.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Almacen', 'Administrador'));

const pendiente = `o.estado = 'EMITIDA' AND NOT EXISTS (
  SELECT 1 FROM recepcion_compra r WHERE r.id_orden_compra = o.id_orden_compra
)`;

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT o.id_orden_compra, o.codigo, p.razon_social AS proveedor,
           COALESCE(SUM(d.cantidad), 0)::text AS pares
    FROM orden_compra o JOIN proveedor p USING (id_proveedor)
    LEFT JOIN detalle_orden_compra d USING (id_orden_compra)
    WHERE ${pendiente}
    GROUP BY o.id_orden_compra, p.razon_social
    ORDER BY o.fecha_emision, o.id_orden_compra`);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647)
    return res.status(400).json({ mensaje: 'Número de orden inválido.' });
  const { rows } = await pool.query(`
    SELECT o.codigo, p.razon_social AS proveedor, m.nombre_modelo AS modelo,
           c.nombre_color AS color, t.numero_talla AS talla, d.cantidad
    FROM orden_compra o JOIN proveedor p USING (id_proveedor)
    LEFT JOIN detalle_orden_compra d USING (id_orden_compra)
    LEFT JOIN producto_sku s USING (id_sku)
    LEFT JOIN modelo m USING (id_modelo)
    LEFT JOIN color c USING (id_color)
    LEFT JOIN talla t USING (id_talla)
    WHERE o.id_orden_compra = $1 AND ${pendiente}
    ORDER BY m.nombre_modelo, c.nombre_color, t.numero_talla`, [id]);
  if (!rows.length) return res.status(404).json({ mensaje: 'La orden no está pendiente de recepción.' });
  const { codigo, proveedor } = rows[0];
  const lineas = rows.filter(r => r.cantidad != null).map(({ modelo, color, talla, cantidad }) =>
    ({ modelo, color, talla, cantidad }));
  res.json({ codigo, proveedor, lineas });
});

export default router;
