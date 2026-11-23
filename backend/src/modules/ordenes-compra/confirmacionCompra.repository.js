import pool from '../../config/database.js';
import { resumenRecepcionSQL } from '../almacen/recepcion.repository.js';
import { errorRecepcion,idRecepcion } from '../almacen/recepcion.domain.js';

export const consultaSeguimientoCompras = `SELECT oc.id_orden_compra,oc.codigo,oc.estado,pr.razon_social AS proveedor,
  COALESCE(r.lote_verificado,false) AS lote_verificado,
  CASE WHEN r.lote_verificado THEN 'RECIBIDA' ELSE 'EN_TRANSITO' END AS situacion_logistica,
  r.id_recepcion,r.usuario_almacen,r.fecha_recepcion,
  uc.nombre AS usuario_confirma,oc.fecha_confirmacion,
  uci.nombre AS usuario_cierre,oc.fecha_cierre
  FROM orden_compra oc LEFT JOIN proveedor pr ON pr.id_proveedor=oc.id_proveedor
  LEFT JOIN LATERAL (${resumenRecepcionSQL}) r ON true
  LEFT JOIN usuario uc ON uc.id_usuario=oc.id_usuario_confirma
  LEFT JOIN usuario uci ON uci.id_usuario=oc.id_usuario_cierre`;

export async function listarEmitidasConRecepcion() {
  const {rows}=await pool.query(`${consultaSeguimientoCompras} WHERE oc.estado='EMITIDA' AND oc.documento_emitido IS NOT NULL
    ORDER BY oc.fecha_emision DESC,oc.id_orden_compra DESC`);
  return rows;
}
export async function confirmarCompraComercialmente(idOrden,usuario) {
  const id=idRecepcion(idOrden),c=await pool.connect();
  try {
    await c.query('BEGIN');
    const {rows:[actual]}=await c.query('SELECT estado FROM orden_compra WHERE id_orden_compra=$1 FOR UPDATE',[id]);
    if(!actual)throw errorRecepcion(404,'La compra no existe.');
    if(actual.estado!=='EMITIDA')throw errorRecepcion(409,'Solo se confirma comercialmente una orden emitida.');
    const {rows:[orden]}=await c.query(`${consultaSeguimientoCompras} WHERE oc.id_orden_compra=$1`,[id]);
    if(!orden.lote_verificado)throw errorRecepcion(409,'Almacén debe verificar y recibir el lote completo antes de la confirmación comercial.','LOTE_NO_VERIFICADO');
    if(!orden.fecha_confirmacion)await c.query(`UPDATE orden_compra SET id_usuario_confirma=$2,fecha_confirmacion=clock_timestamp()
      WHERE id_orden_compra=$1`,[id,usuario]);
    const {rows:[confirmada]}=await c.query(`${consultaSeguimientoCompras} WHERE oc.id_orden_compra=$1`,[id]);
    await c.query('COMMIT');return confirmada;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
