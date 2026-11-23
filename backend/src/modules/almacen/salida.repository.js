import pool from '../../config/database.js';
import { errorSalida, calcularFaltantes, mensajeFaltantes } from './salida.domain.js';

const PENDIENTE = 'Pendiente de Despacho';

/*
HU19: todo ocurre en una sola transacción.
El trigger de kardex_movimiento descuenta el stock: NO se actualiza stock_sku desde aquí.
*/
export async function registrarSalidaDespacho({ idDespacho, idUsuario }) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    // Bloquear el despacho evita que un doble clic lo procese dos veces.
    const { rows: [despacho] } = await c.query(
      `SELECT id_orden_despacho, codigo, estado, id_orden_venta
       FROM orden_despacho WHERE id_orden_despacho = $1 FOR UPDATE`,
      [idDespacho]
    );
    if (!despacho) throw errorSalida(404, 'El despacho no existe.', 'DESPACHO_NO_ENCONTRADO');
    if (despacho.estado !== PENDIENTE) {
      throw errorSalida(409, 'Este despacho ya no está pendiente: la salida ya fue registrada.', 'DESPACHO_NO_PENDIENTE');
    }

    const { rows: lineas } = await c.query(
      `SELECT dv.id_sku, dv.cantidad, p.codigo_sku
       FROM detalle_orden_venta dv
       JOIN producto_sku p ON p.id_sku = dv.id_sku
       WHERE dv.id_orden_venta = $1
       ORDER BY dv.id_sku`,
      [despacho.id_orden_venta]
    );
    if (!lineas.length) {
      throw errorSalida(409, 'El pedido no tiene productos para despachar.', 'DESPACHO_SIN_PRODUCTOS');
    }

    // Bloquea los saldos en orden ascendente de id_sku, igual que recepción.
    const { rows: stock } = await c.query(
      `SELECT id_sku, cantidad_actual FROM stock_sku
       WHERE id_sku = ANY($1::int[]) ORDER BY id_sku FOR UPDATE`,
      [lineas.map(l => l.id_sku)]
    );
    const saldos = new Map(stock.map(s => [s.id_sku, s.cantidad_actual]));
    const faltantes = calcularFaltantes(lineas, saldos);
    if (faltantes.length) {
      throw errorSalida(409, mensajeFaltantes(faltantes), 'STOCK_INSUFICIENTE', { faltantes });
    }

    const movimientos = [];
    for (const linea of lineas) {
      const { rows: [movimiento] } = await c.query(
        `INSERT INTO kardex_movimiento
           (id_sku, tipo_movimiento, cantidad, id_usuario, id_orden_despacho)
         VALUES ($1, 'SALIDA_VENTA', $2, $3, $4)
         RETURNING id_movimiento::text, id_sku, cantidad, saldo_posterior`,
        [linea.id_sku, linea.cantidad, idUsuario, idDespacho]
      );
      movimientos.push(movimiento);
    }

    const { rows: [salida] } = await c.query(
      `UPDATE orden_despacho
       SET estado = 'Despachada', id_usuario_salida = $2, fecha_salida = now()
       WHERE id_orden_despacho = $1
       RETURNING id_orden_despacho, codigo, estado, fecha_salida`,
      [idDespacho, idUsuario]
    );
    await c.query(
      `UPDATE orden_venta SET estado = 'Despachado' WHERE id_orden_venta = $1`,
      [despacho.id_orden_venta]
    );

    await c.query('COMMIT');
    return { despacho: salida, movimientos };
  } catch (error) {
    await c.query('ROLLBACK');
    if (error.code === '23505') {
      throw errorSalida(409, 'La salida de este despacho ya fue registrada.', 'SALIDA_YA_REGISTRADA');
    }
    if (error.code === '23514') {
      throw errorSalida(409, error.message, 'SALIDA_RECHAZADA');
    }
    throw error;
  } finally {
    c.release();
  }
}