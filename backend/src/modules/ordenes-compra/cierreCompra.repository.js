import pool from '../../config/database.js';
import { consultaSeguimientoCompras } from './confirmacionCompra.repository.js';

export async function listarComprasCerradas() {
  const { rows } = await pool.query(`${consultaSeguimientoCompras}
    WHERE oc.estado = 'CERRADO' ORDER BY oc.fecha_cierre DESC, oc.id_orden_compra DESC`);
  return rows;
}

export async function buscarCompraCerrada(id) {
  const { rows: [orden] } = await pool.query(`${consultaSeguimientoCompras}
    WHERE oc.id_orden_compra = $1 AND oc.estado = 'CERRADO'`, [id]);
  if (!orden) return null;
  const { rows: [documento] } = await pool.query(`SELECT documento_emitido, total, fecha_emision
    FROM orden_compra WHERE id_orden_compra = $1`, [id]);
  return { ...orden, ...documento };
}

// El bloqueo serializa cierres repetidos y mantiene el primer usuario y fecha.
export async function registrarCierreCompra(id, usuario) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT id_orden_compra FROM orden_compra WHERE id_orden_compra = $1 FOR UPDATE', [id]);
    const { rows: [actual] } = await cliente.query(`${consultaSeguimientoCompras} WHERE oc.id_orden_compra = $1`, [id]);
    if (!actual) return await terminar({ problema: 'inexistente' });
    if (actual.estado === 'CERRADO') return await terminar({ orden: actual, repetida: true });
    if (actual.estado !== 'EMITIDA' || !actual.lote_verificado || !actual.fecha_confirmacion)
      return await terminar({ problema: 'no_completada' });
    await cliente.query(`UPDATE orden_compra SET estado = 'CERRADO', id_usuario_cierre = $2,
      fecha_cierre = clock_timestamp() WHERE id_orden_compra = $1`, [id, usuario]);
    const { rows: [orden] } = await cliente.query(`${consultaSeguimientoCompras} WHERE oc.id_orden_compra = $1`, [id]);
    return await terminar({ orden, repetida: false });

    async function terminar(resultado) {
      await cliente.query('COMMIT');
      return resultado;
    }
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
