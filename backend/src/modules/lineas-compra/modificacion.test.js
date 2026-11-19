import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import express from 'express';
import pool from '../../config/database.js';
import router from '../ordenes-compra/ordenCompra.routes.js';

async function escenario(t,{estado='BORRADOR',existe=true,existeDetalle=true,falla=false}={}) {
  let cantidad=4,retirada=false;
  const consultas=[];
  const release=t.mock.fn();
  t.mock.method(pool,'query',async(sql,args)=>{
    assert.ok(sql.includes('FROM usuario u'));return {rows:[{activo:true,debe_cambiar_password:false,roles:args[0]===1?['Compras']:['Ventas']}]};
  });
  const conectar=t.mock.method(pool,'connect',async()=>({release,async query(sql,args){
    consultas.push({sql,args});
    if(sql.includes('SELECT estado'))return {rowCount:existe?1:0,rows:existe?[{estado}]:[]};
    if(sql.startsWith('SELECT cantidad'))return {rowCount:existeDetalle&&!retirada?1:0,rows:existeDetalle&&!retirada?[{cantidad}]:[]};
    if(sql.startsWith('UPDATE detalle_orden_compra SET cantidad')){if(falla)throw Error('Fallo simulado');cantidad=args[2];return {rowCount:1};}
    if(sql.startsWith('DELETE FROM detalle_orden_compra')){retirada=true;return {rowCount:1};}
    if(sql.includes('SELECT d.id_detalle_compra'))return {rows:retirada?[]:[{id_detalle_compra:101,id_sku:1,nombre_modelo:'Threshold',cantidad,costo_unitario:'200.00',importe:(cantidad*200).toFixed(2)}]};
    if(sql.includes('SET costo_unitario = cb.costo_vigente'))return {rowCount:1};
    assert.ok(['BEGIN','COMMIT','ROLLBACK'].includes(sql),sql);return {rows:[]};
  }}));
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={idUsuario:Number(req.get('x-test-session'))||undefined};next();});app.use('/api/ordenes-compra',router);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  async function enviar(method='PATCH',body={cantidad:7,cantidad_anterior:4},id='19',detalle='101',usuario=1){
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api/ordenes-compra/${id}/detalles/${detalle}`,{method,headers:{'Content-Type':'application/json','x-test-session':String(usuario)},body:method==='DELETE'?undefined:JSON.stringify(body)});
    return {status:r.status,data:await r.json()};
  }
  return {enviar,consultas,conectar,release};
}
test('PATCH establece una cantidad absoluta y reutiliza los importes de HU15',async t=>{
  const {enviar,consultas,release}=await escenario(t);const r=await enviar();assert.equal(r.status,200);assert.equal(r.data.lineas[0].cantidad,7);assert.equal(r.data.lineas[0].importe,'1400.00');
  assert.match(consultas[1].sql,/FOR UPDATE/);assert.equal(consultas.at(-1).sql,'COMMIT');assert.equal(release.mock.callCount(),1);
});
test('DELETE quita solo la línea indicada y devuelve el borrador vacío',async t=>{
  const {enviar,consultas}=await escenario(t);const r=await enviar('DELETE');assert.equal(r.status,200);assert.deepEqual(r.data.lineas,[]);assert.equal(r.data.total_pares,0);
  const q=consultas.find(c=>c.sql.startsWith('DELETE'));assert.deepEqual(q.args,[19,101]);assert.ok(!consultas.some(c=>/DELETE FROM orden_compra/.test(c.sql)));
});
for(const estado of ['EMITIDA','CANCELADO'])test(`no modifica ni retira detalles de ${estado}`,async t=>{
  const {enviar,consultas}=await escenario(t,{estado});for(const method of ['PATCH','DELETE'])assert.equal((await enviar(method)).status,409);
  assert.ok(!consultas.some(q=>/^(UPDATE|DELETE)\b/.test(q.sql)));
});
test('rechaza una cantidad obsoleta sin sobrescribir los cambios de otra persona',async t=>{
  const {enviar,consultas}=await escenario(t);const r=await enviar('PATCH',{cantidad:7,cantidad_anterior:3});assert.equal(r.status,409);assert.match(r.data.mensaje,/Otra persona/);assert.equal(consultas.at(-1).sql,'ROLLBACK');
});
test('devuelve 404 si la orden o su detalle no existen',async t=>{
  const e=await escenario(t,{existeDetalle:false});for(const method of ['PATCH','DELETE'])assert.equal((await e.enviar(method,{cantidad:7},'19','999')).status,404);
});
test('rechaza una orden inexistente antes de acceder al detalle',async t=>{
  const e=await escenario(t,{existe:false});for(const method of ['PATCH','DELETE'])assert.equal((await e.enviar(method,{cantidad:7})).status,404);
  assert.ok(!e.consultas.some(q=>q.sql.startsWith('SELECT cantidad')));
});
test('valida IDs y cantidades antes de conectarse',async t=>{
  const {enviar,conectar}=await escenario(t);
  for(const cantidad of [undefined,null,0,-1,1.5,100001,'abc'])assert.equal((await enviar('PATCH',{cantidad})).status,400);
  assert.equal((await enviar('PATCH',{cantidad:1},'2147483648')).status,400);assert.equal((await enviar('DELETE',{},'19','abc')).status,400);assert.equal(conectar.mock.callCount(),0);
});
test('las dos rutas exigen sesión y rol Compras',async t=>{
  const {enviar,conectar}=await escenario(t);for(const method of ['PATCH','DELETE']){assert.equal((await enviar(method,{},'19','101',0)).status,401);assert.equal((await enviar(method,{},'19','101',2)).status,403);}assert.equal(conectar.mock.callCount(),0);
});
test('revierte y libera la conexión ante fallos al actualizar',async t=>{
  t.mock.method(console,'error',()=>{});const {enviar,consultas,release}=await escenario(t,{falla:true});assert.equal((await enviar()).status,500);assert.equal(consultas.at(-1).sql,'ROLLBACK');assert.equal(release.mock.callCount(),1);
});
