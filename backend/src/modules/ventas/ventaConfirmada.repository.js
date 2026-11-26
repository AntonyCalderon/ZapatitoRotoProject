import pool from '../../config/database.js';
import {
  codigoDespacho, errorVentaConfirmada, formatearNumero, prepararDocumento,
  SERIE_NOTA_CREDITO, tipoComprobante
} from './comprobante.domain.js';

// Estados de la tabla 12 del informe: Borrador → Pendiente → En Almacén → Despachado.
const PENDIENTE = 'Pendiente';
const EN_ALMACEN = 'En Almacén';
export const ESTADOS_CONFIRMADOS = Object.freeze([PENDIENTE, EN_ALMACEN, 'Despachado']);

const noEncontrada = () => errorVentaConfirmada(404, 'No se encontró la venta confirmada.', 'VENTA_NO_ENCONTRADA');

/*
Contrato con HU13 (PROYEC-24): es lo único que HU14 y HU15 leen de una venta confirmada.
Si la HU13 guarda estos datos con otros nombres, solo cambia esta función y leerLineasVenta.
*/
export async function leerVentaConfirmada(db, idVenta, idVendedor, { bloquear = false } = {}) {
  const { rows: [venta] } = await db.query(`
    SELECT v.id_orden_venta, v.estado, v.fecha_creacion, v.fecha_confirmacion,
           v.tasa_igv::text, v.subtotal::text, v.igv::text, v.total::text,
           v.tipo_documento_cliente, v.numero_documento_cliente,
           c.id_cliente, c.tipo_documento, c.numero_documento, c.razon_social_nombre, c.direccion,
           tc.nombre AS tipo_cliente, tc.segmento
    FROM orden_venta v
    JOIN cliente c ON c.id_cliente = v.id_cliente
    JOIN tipo_cliente tc ON tc.id_tipo_cliente = COALESCE(v.id_tipo_cliente, c.id_tipo_cliente)
    WHERE v.id_orden_venta = $1 AND v.id_usuario_vendedor = $2
    ${bloquear ? 'FOR UPDATE OF v, c' : ''}`, [idVenta, idVendedor]);
  return venta ?? null;
}

export async function leerLineasVenta(db, idVenta) {
  const { rows } = await db.query(`
    SELECT d.id_sku, p.codigo_sku, m.nombre_modelo AS modelo, co.nombre_color AS color,
           t.numero_talla::text AS talla, d.cantidad,
           d.precio_unitario::text, d.importe::text,
           round(d.precio_unitario * (1 + v.tasa_igv), 2)::text AS precio_con_igv
    FROM detalle_orden_venta d
    JOIN orden_venta v ON v.id_orden_venta = d.id_orden_venta
    JOIN producto_sku p ON p.id_sku = d.id_sku
    JOIN modelo m ON m.id_modelo = p.id_modelo
    JOIN color co ON co.id_color = p.id_color
    JOIN talla t ON t.id_talla = p.id_talla
    WHERE d.id_orden_venta = $1
    ORDER BY d.id_detalle_venta`, [idVenta]);
  return rows;
}

// Igual que la emisión de órdenes de compra: el upsert bloquea la fila del correlativo.
export async function siguienteCorrelativo(db, tipoDocumento, serie, { anual = false } = {}) {
  const { rows: [correlativo] } = await db.query(`
    INSERT INTO correlativo_documento (tipo_documento, serie, anio, ultimo_numero)
    VALUES ($1, $2, CASE WHEN $3 THEN EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Lima')::smallint ELSE 0 END, 1)
    ON CONFLICT (tipo_documento, serie, anio) DO UPDATE
    SET ultimo_numero = correlativo_documento.ultimo_numero + 1
    RETURNING anio, ultimo_numero`, [tipoDocumento, serie, anual]);
  return correlativo;
}

export async function listarVentasConfirmadas(idVendedor, db = pool) {
  const { rows } = await db.query(`
    SELECT v.id_orden_venta, v.estado, v.fecha_confirmacion, v.total::text,
           c.razon_social_nombre AS cliente, c.tipo_documento, tc.nombre AS tipo_cliente, tc.segmento,
           (SELECT COALESCE(SUM(d.cantidad), 0)::integer FROM detalle_orden_venta d
             WHERE d.id_orden_venta = v.id_orden_venta) AS pares,
           cp.tipo AS tipo_comprobante, cp.serie AS serie_comprobante, cp.numero AS numero_comprobante,
           od.codigo AS codigo_despacho
    FROM orden_venta v
    JOIN cliente c ON c.id_cliente = v.id_cliente
    JOIN tipo_cliente tc ON tc.id_tipo_cliente = COALESCE(v.id_tipo_cliente, c.id_tipo_cliente)
    LEFT JOIN comprobante_pago cp ON cp.id_orden_venta = v.id_orden_venta AND cp.estado = 'Emitido'
    LEFT JOIN orden_despacho od ON od.id_orden_venta = v.id_orden_venta
    WHERE v.id_usuario_vendedor = $1 AND v.estado = ANY($2::text[])
    ORDER BY array_position($2::text[], v.estado::text),
             COALESCE(v.fecha_confirmacion, v.fecha_creacion), v.id_orden_venta`,
  [idVendedor, ESTADOS_CONFIRMADOS]);
  return rows;
}

function propuestaComprobante(venta) {
  try {
    const { tipo, serie } = tipoComprobante(venta);
    return { tipo, serie, motivo: null };
  } catch (error) {
    if (!error.publico) throw error;
    return { tipo: null, serie: null, motivo: error.message };
  }
}

export async function detalleVentaConfirmada(idVenta, idVendedor, db = pool) {
  const venta = await leerVentaConfirmada(db, idVenta, idVendedor);
  if (!venta || !ESTADOS_CONFIRMADOS.includes(venta.estado)) throw noEncontrada();
  const [lineas, { rows: comprobantes }, { rows: notas }, { rows: [despacho] }] = await Promise.all([
    leerLineasVenta(db, idVenta),
    db.query(`
      SELECT id_comprobante, tipo, serie, numero, estado, fecha_emision, total::text
      FROM comprobante_pago WHERE id_orden_venta = $1
      ORDER BY fecha_emision, id_comprobante`, [idVenta]),
    db.query(`
      SELECT n.id_nota_credito, n.id_comprobante, n.serie, n.numero, n.motivo, n.sustento,
             n.fecha_emision, n.total::text
      FROM nota_credito n JOIN comprobante_pago cp ON cp.id_comprobante = n.id_comprobante
      WHERE cp.id_orden_venta = $1
      ORDER BY n.fecha_emision, n.id_nota_credito`, [idVenta]),
    db.query(`
      SELECT id_orden_despacho, codigo, estado, fecha_emision
      FROM orden_despacho WHERE id_orden_venta = $1`, [idVenta])
  ]);
  const { id_cliente: _cliente, ...datos } = venta;
  return {
    venta: datos,
    lineas: lineas.map(({ precio_unitario: _sinIgv, ...linea }) => linea),
    comprobantes,
    notas_credito: notas,
    despacho: despacho ?? null,
    comprobante_propuesto: propuestaComprobante(venta)
  };
}

async function enTransaccion(trabajo) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const resultado = await trabajo(db);
    await db.query('COMMIT');
    return resultado;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function bloquearVentaPendiente(db, idVenta, idVendedor, mensaje) {
  const venta = await leerVentaConfirmada(db, idVenta, idVendedor, { bloquear: true });
  if (!venta || !ESTADOS_CONFIRMADOS.includes(venta.estado)) throw noEncontrada();
  if (venta.estado !== PENDIENTE) throw errorVentaConfirmada(409, mensaje, 'VENTA_NO_PENDIENTE');
  return venta;
}

const comprobanteVigente = async (db, idVenta) => (await db.query(`
  SELECT id_comprobante, tipo, serie, numero, subtotal::text, igv::text, total::text
  FROM comprobante_pago WHERE id_orden_venta = $1 AND estado = 'Emitido'
  FOR UPDATE`, [idVenta])).rows[0] ?? null;

// HU14: emite factura o boleta. No toca stock_sku ni kardex_movimiento (RN-09, CA-04).
export async function emitirComprobante({ idVenta, idUsuario, direccion }) {
  try {
    return await enTransaccion(async db => {
      const venta = await bloquearVentaPendiente(db, idVenta, idUsuario,
        'Solo se emite comprobante para ventas en estado Pendiente.');
      if (await comprobanteVigente(db, idVenta)) {
        throw errorVentaConfirmada(409, 'Esta venta ya tiene un comprobante emitido.', 'COMPROBANTE_YA_EMITIDO');
      }
      const tipo = tipoComprobante(venta);
      const direccionFinal = direccion ?? (venta.direccion?.trim() || null);
      const documento = prepararDocumento(venta, await leerLineasVenta(db, idVenta), direccionFinal);
      if (direccionFinal !== venta.direccion) {
        await db.query('UPDATE cliente SET direccion = $2 WHERE id_cliente = $1', [venta.id_cliente, direccionFinal]);
      }
      const { ultimo_numero: numero } = await siguienteCorrelativo(db, tipo.correlativo, tipo.serie);
      const { rows: [comprobante] } = await db.query(`
        INSERT INTO comprobante_pago
          (id_orden_venta, tipo, serie, numero, subtotal, igv, total, id_usuario, documento_emitido)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id_comprobante, tipo, serie, numero, estado, fecha_emision, total::text`,
      [idVenta, tipo.tipo, tipo.serie, formatearNumero(numero), venta.subtotal, venta.igv, venta.total,
        idUsuario, JSON.stringify(documento)]);
      return { comprobante };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw errorVentaConfirmada(409, 'Esta venta ya tiene un comprobante emitido.', 'COMPROBANTE_YA_EMITIDO');
    }
    throw error;
  }
}

// Corrección: anula el comprobante vigente con una nota de crédito, solo antes de enviar a Almacén.
export async function anularComprobante({ idVenta, idUsuario, motivo, sustento }) {
  return enTransaccion(async db => {
    await bloquearVentaPendiente(db, idVenta, idUsuario,
      'Solo se puede anular el comprobante mientras la venta no se haya enviado a Almacén.');
    const comprobante = await comprobanteVigente(db, idVenta);
    if (!comprobante) throw errorVentaConfirmada(409, 'La venta no tiene un comprobante vigente.', 'SIN_COMPROBANTE');
    const serie = SERIE_NOTA_CREDITO[comprobante.tipo];
    const { ultimo_numero: numero } = await siguienteCorrelativo(db, 'NOTA_CREDITO', serie);
    await db.query(`UPDATE comprobante_pago SET estado = 'Anulado' WHERE id_comprobante = $1`, [comprobante.id_comprobante]);
    const { rows: [nota] } = await db.query(`
      INSERT INTO nota_credito
        (id_comprobante, serie, numero, motivo, sustento, subtotal, igv, total, id_usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id_nota_credito, id_comprobante, serie, numero, motivo, fecha_emision, total::text`,
    [comprobante.id_comprobante, serie, formatearNumero(numero), motivo, sustento,
      comprobante.subtotal, comprobante.igv, comprobante.total, idUsuario]);
    return {
      nota_credito: nota,
      comprobante_anulado: { ...comprobante, estado: 'Anulado' }
    };
  });
}

// HU15: crea la orden de despacho y pasa la venta a «En Almacén». No toca stock (RN-08).
export async function enviarADespacho({ idVenta, idUsuario }) {
  try {
    return await enTransaccion(async db => {
      const venta = await leerVentaConfirmada(db, idVenta, idUsuario, { bloquear: true });
      if (!venta || !ESTADOS_CONFIRMADOS.includes(venta.estado)) throw noEncontrada();
      const { rows: [previo] } = await db.query(
        'SELECT codigo FROM orden_despacho WHERE id_orden_venta = $1', [idVenta]);
      if (previo) {
        throw errorVentaConfirmada(409, `La venta ya se envió a Almacén con la orden ${previo.codigo}.`, 'DESPACHO_YA_ENVIADO');
      }
      if (venta.estado !== PENDIENTE) {
        throw errorVentaConfirmada(409, 'Solo se envían a despacho las ventas en estado Pendiente.', 'VENTA_NO_PENDIENTE');
      }
      if (!await comprobanteVigente(db, idVenta)) {
        throw errorVentaConfirmada(409, 'Emite el comprobante antes de enviar la venta a Almacén.', 'SIN_COMPROBANTE');
      }
      const { anio, ultimo_numero: numero } = await siguienteCorrelativo(db, 'OD', '', { anual: true });
      const { rows: [despacho] } = await db.query(`
        INSERT INTO orden_despacho (codigo, id_orden_venta)
        VALUES ($1, $2)
        RETURNING id_orden_despacho, codigo, estado, fecha_emision`, [codigoDespacho(anio, numero), idVenta]);
      await db.query('UPDATE orden_venta SET estado = $2 WHERE id_orden_venta = $1', [idVenta, EN_ALMACEN]);
      return { despacho, estado_venta: EN_ALMACEN };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw errorVentaConfirmada(409, 'La venta ya tiene una orden de despacho.', 'DESPACHO_YA_ENVIADO');
    }
    throw error;
  }
}

// Datos para reimprimir: siempre desde la copia guardada al emitir.
export async function documentoParaPdf(idVenta, idVendedor, tipo, idDocumento, db = pool) {
  const venta = await leerVentaConfirmada(db, idVenta, idVendedor);
  if (!venta) throw noEncontrada();
  const consulta = tipo === 'comprobante'
    ? `SELECT cp.tipo, cp.serie, cp.numero, cp.estado, cp.documento_emitido,
              to_char(cp.fecha_emision AT TIME ZONE 'America/Lima', 'DD/MM/YYYY') AS fecha,
              NULL::text AS referencia, NULL::text AS motivo, NULL::text AS sustento
       FROM comprobante_pago cp
       WHERE cp.id_comprobante = $1 AND cp.id_orden_venta = $2 AND cp.documento_emitido IS NOT NULL`
    : `SELECT 'Nota de crédito' AS tipo, n.serie, n.numero, 'Emitido' AS estado, cp.documento_emitido,
              to_char(n.fecha_emision AT TIME ZONE 'America/Lima', 'DD/MM/YYYY') AS fecha,
              cp.tipo || ' ' || cp.serie || '-' || cp.numero AS referencia, n.motivo, n.sustento
       FROM nota_credito n JOIN comprobante_pago cp ON cp.id_comprobante = n.id_comprobante
       WHERE n.id_nota_credito = $1 AND cp.id_orden_venta = $2 AND cp.documento_emitido IS NOT NULL`;
  const { rows: [documento] } = await db.query(consulta, [idDocumento, idVenta]);
  if (!documento) throw errorVentaConfirmada(404, 'Documento no disponible.', 'DOCUMENTO_NO_ENCONTRADO');
  return documento;
}
