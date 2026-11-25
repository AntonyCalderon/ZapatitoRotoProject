import { Router } from 'express';
import pool from '../../config/database.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';
import { recalcularPreciosVenta } from './precioVenta.repository.js';

const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Ventas'));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const campos = 'c.numero_documento AS documento, c.razon_social_nombre AS nombre, t.nombre AS tipo';
router.get('/clientes/:documento', async (req, res) => {
  const { documento } = req.params;
  if (!/^(?:\d{8}|\d{11})$/.test(documento)) return res.status(400).json({ mensaje: 'Documento inválido.' });
  const { rows } = await pool.query(`SELECT ${campos} FROM cliente c JOIN tipo_cliente t USING(id_tipo_cliente)
    WHERE c.numero_documento = $1`, [documento]);
  res.json({ cliente: rows[0] ?? null });
});

router.get('/borradores/:id/cliente', async (req, res) => {
  if (!idValido(req.params.id)) return res.status(400).json({ mensaje: 'Venta inválida.' });
  const { rows } = await pool.query(`SELECT ${campos} FROM orden_venta v JOIN cliente c USING(id_cliente)
    JOIN tipo_cliente t ON t.id_tipo_cliente = COALESCE(v.id_tipo_cliente,c.id_tipo_cliente)
    WHERE v.id_orden_venta=$1 AND v.id_usuario_vendedor=$2 AND v.estado='Borrador'`,
    [req.params.id, req.usuario.id_usuario]);
  if (!rows.length) return res.status(404).json({ mensaje: 'Borrador no disponible.' });
  res.json(rows[0]);
});

function idValido(id) {
  return /^\d+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647;
}

export function validarCliente({ tipo, documento, nombre }) {
  if (!['Gobierno Regional','Municipio','Privado','Particular'].includes(tipo)) return 'Selecciona el tipo de cliente.';
  const particular = tipo === 'Particular';
  if (typeof documento !== 'string' || !(particular ? /^\d{8}$/ : /^\d{11}$/).test(documento))
    return particular ? 'Ingresa un DNI de 8 dígitos.' : 'Ingresa un RUC de 11 dígitos.';
  if (typeof nombre !== 'string' || !nombre.trim())
    return particular ? 'Ingresa el nombre.' : tipo === 'Privado' ? 'Ingresa la razón social.' : 'Ingresa la entidad estatal.';
  if (nombre.trim().length > 180) return 'El nombre admite hasta 180 caracteres.';
}

async function guardar(req, res) {
  const { id } = req.params;
  const { tipo, documento, nombre } = req.body ?? {};
  const error = validarCliente({ tipo, documento, nombre });
  if (error || (id && !idValido(id))) return res.status(400).json({ mensaje: error || 'Venta inválida.' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if (id) {
      const { rows } = await db.query('SELECT estado FROM orden_venta WHERE id_orden_venta=$1 AND id_usuario_vendedor=$2 FOR UPDATE',
        [id, req.usuario.id_usuario]);
      if (!rows.length || rows[0].estado !== 'Borrador') {
        await db.query('ROLLBACK');
        return res.status(rows.length ? 409 : 404).json({ mensaje: 'Solo puedes editar tus ventas en borrador.' });
      }
    }
    const { rows: [clasificacion] } = await db.query(
      'SELECT id_tipo_cliente FROM tipo_cliente WHERE nombre = $1', [tipo]
    );
    if (!clasificacion) {
      await db.query('ROLLBACK');
      return res.status(409).json({ mensaje: 'El tipo de cliente no está disponible en el catálogo.' });
    }
    const tipoId = clasificacion.id_tipo_cliente;
    await db.query(`INSERT INTO cliente(id_tipo_cliente,tipo_documento,numero_documento,razon_social_nombre)
      VALUES($1,$2,$3,$4) ON CONFLICT(numero_documento) DO NOTHING`,
      [tipoId,tipo === 'Particular' ? 'DNI' : 'RUC',documento,nombre.trim()]);
    const { rows:[cliente] } = await db.query('SELECT id_cliente,razon_social_nombre FROM cliente WHERE numero_documento=$1',[documento]);
    if (cliente.razon_social_nombre !== nombre.trim()) {
      await db.query('ROLLBACK');
      return res.status(409).json({mensaje:'El documento ya existe con otro nombre. Vuelve a buscarlo.'});
    }
    let venta = Number(id);
    if (id) {
      await db.query('UPDATE orden_venta SET id_cliente=$2,id_tipo_cliente=$3 WHERE id_orden_venta=$1',[id,cliente.id_cliente,tipoId]);
      await recalcularPreciosVenta(db,venta);
    } else {
      const { rows:[orden] } = await db.query(`INSERT INTO orden_venta(id_cliente,id_usuario_vendedor,id_tipo_cliente)
        VALUES($1,$2,$3) RETURNING id_orden_venta`,[cliente.id_cliente,req.usuario.id_usuario,tipoId]);
      venta = orden.id_orden_venta;
    }
    await db.query('COMMIT');
    return res.status(id ? 200 : 201).json({ id_orden_venta: venta });
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally { db.release(); }
}
router.post('/borradores', guardar);
router.put('/borradores/:id/cliente', guardar);
export default router;
