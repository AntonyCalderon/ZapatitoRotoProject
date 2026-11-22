// Simulación explícita sobre una compra de proveedor ficticio. No es una API.
import assert from 'node:assert/strict';
import pool from '../src/config/database.js';
const opciones=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const id=Number(opciones.orden),usuario=Number(opciones.usuario);
assert.ok(opciones['confirmar-simulacion']==='si'&&Number.isInteger(id)&&id>0&&Number.isInteger(usuario)&&usuario>0,
  'Uso: node scripts/simularRecepcionCompra.mjs --orden=ID --usuario=ID --confirmar-simulacion=si');
const c=await pool.connect();
try {
 await c.query('BEGIN');
 const {rows:[actor]}=await c.query(`SELECT u.id_usuario,u.nombre FROM usuario u JOIN usuario_rol ur USING(id_usuario) JOIN rol r USING(id_rol)
  WHERE u.id_usuario=$1 AND u.activo AND r.activo AND r.nombre_rol='Almacen'`,[usuario]);
 assert.ok(actor,'El usuario debe tener el rol Almacen activo.');
 const {rows:[orden]}=await c.query(`SELECT o.id_orden_compra,o.codigo,o.estado,p.razon_social,p.ruc
  FROM orden_compra o JOIN proveedor p USING(id_proveedor) WHERE o.id_orden_compra=$1 FOR UPDATE OF o`,[id]);
 assert.ok(orden&&orden.ruc==='00000000000'&&orden.razon_social==='PROVEEDOR DE PRUEBA (NO REAL)',
  'La simulación solo admite el proveedor ficticio definido para pruebas locales.');
 assert.equal(orden.estado,'EMITIDA','La compra debe estar emitida.');
 const {rows:[previa]}=await c.query('SELECT id_recepcion,observacion FROM recepcion_compra WHERE id_orden_compra=$1',[id]);
 if(previa){
  assert.ok(previa.observacion?.startsWith('SIMULACIÓN LOCAL'),'La compra ya tiene otra recepción; no se modifica.');
  console.log(JSON.stringify({codigo:orden.codigo,mensaje:'La simulación ya fue registrada. No se repitieron movimientos.',id_recepcion:previa.id_recepcion}));
 }else{
  const {rows:lineas}=await c.query(`SELECT d.id_sku,p.codigo_sku,d.cantidad,s.cantidad_actual AS antes
   FROM detalle_orden_compra d JOIN producto_sku p USING(id_sku) JOIN stock_sku s USING(id_sku)
   WHERE d.id_orden_compra=$1 ORDER BY d.id_sku FOR UPDATE OF s`,[id]);
  assert.ok(lineas.length,'La compra debe contener líneas.');
  const {rows:[recepcion]}=await c.query(`INSERT INTO recepcion_compra(id_orden_compra,id_usuario_almacen,observacion)
   VALUES($1,$2,$3) RETURNING id_recepcion`,[id,usuario,'SIMULACIÓN LOCAL solicitada para comprobar recepción completa, stock y Kardex. Mercadería ficticia; operación ejecutada desde script de prueba.']);
  const resultado=[];
  for(const linea of lineas){
   const {rows:[mov]}=await c.query(`INSERT INTO kardex_movimiento(id_sku,tipo_movimiento,cantidad,id_usuario,id_recepcion)
    VALUES($1,'ENTRADA_COMPRA',$2,$3,$4) RETURNING id_movimiento,saldo_posterior`,[linea.id_sku,linea.cantidad,usuario,recepcion.id_recepcion]);
   resultado.push({sku:linea.codigo_sku,antes:linea.antes,recibidos:linea.cantidad,ahora:mov.saldo_posterior,id_movimiento:mov.id_movimiento});
  }
  console.log(JSON.stringify({codigo:orden.codigo,id_recepcion:recepcion.id_recepcion,responsable:actor.nombre,pares:lineas.reduce((a,l)=>a+l.cantidad,0),lineas:resultado}));
 }
 await c.query('COMMIT');
}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();await pool.end();}
