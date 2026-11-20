import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import express from 'express';
import pool from '../../config/database.js';
import router from './ordenCompra.routes.js';

async function escenario(t,{estado='BORRADOR',existe=true,falla=false}={}) {
  const registro={id_orden_compra:19,estado,id_usuario_cancela:null,fecha_cancelacion:null};
  const consultas=[];
  t.mock.method(pool,'query',async(sql,args)=>{
    assert.ok(sql.includes('FROM usuario u'));
    return {rows:[{activo:true,debe_cambiar_password:false,roles:args[0]===1?['Compras']:['Ventas']}]};
  });
  const release=t.mock.fn();
  const connect=t.mock.method(pool,'connect',async()=>({release,async query(sql,args){
    consultas.push({sql,args});
    if(sql.includes('SELECT estado'))return {rowCount:existe?1:0,rows:existe?[{estado:registro.estado}]:[]};
    if(sql.includes('UPDATE orden_compra')){
      if(falla)throw new Error('Error de prueba');
      Object.assign(registro,{estado:'CANCELADO',id_usuario_cancela:args[1],fecha_cancelacion:'2026-11-19T18:00:00Z'});
      return {rowCount:1,rows:[{...registro}]};
    }
    assert.ok(['BEGIN','COMMIT','ROLLBACK'].includes(sql));return {rows:[]};
  }}));
  const app=express();app.use(express.json());
  app.use((req,res,next)=>{req.session={idUsuario:Number(req.get('x-test-session'))||undefined};next();});
  app.use('/api/ordenes-compra',router);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  async function enviar(id='19',usuario=1,body={}){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ordenes-compra/${id}/cancelacion`,{method:'POST',headers:{'Content-Type':'application/json','x-test-session':String(usuario)},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  }
  return {enviar,consultas,registro,connect,release};
}
test('cancela con usuario de sesión, bloqueo de fila y confirmación de transacción',async t=>{
  const {enviar,consultas,registro,release}=await escenario(t);
  const {status,data}=await enviar('19',1,{id_usuario_cancela:999,estado:'EMITIDA'});
  assert.equal(status,200);assert.equal(data.orden.estado,'CANCELADO');assert.equal(registro.id_usuario_cancela,1);
  assert.ok(registro.fecha_cancelacion);assert.match(data.mensaje,/#19/);
  assert.match(consultas[1].sql,/FOR UPDATE/);assert.equal(consultas.at(-1).sql,'COMMIT');assert.equal(release.mock.callCount(),1);
  assert.ok(!consultas.some(q=>/DELETE|detalle_orden_compra|costo_base/.test(q.sql)));
});
test('una cancelación repetida devuelve conflicto y conserva la auditoría original',async t=>{
  const {enviar,registro}=await escenario(t);await enviar();const antes={...registro};
  const respuesta=await enviar();assert.equal(respuesta.status,409);assert.deepEqual(registro,antes);
});
for(const estado of ['EMITIDA','CANCELADO'])test(`rechaza la cancelación de ${estado}`,async t=>{
  const {enviar,consultas,registro,release}=await escenario(t,{estado});
  assert.equal((await enviar()).status,409);assert.equal(registro.estado,estado);
  assert.equal(consultas.at(-1).sql,'ROLLBACK');assert.ok(!consultas.some(q=>/^UPDATE\b/.test(q.sql)));assert.equal(release.mock.callCount(),1);
});
test('devuelve 404 para una solicitud inexistente',async t=>{
  const {enviar,consultas}=await escenario(t,{existe:false});assert.equal((await enviar()).status,404);assert.equal(consultas.at(-1).sql,'ROLLBACK');
});
test('valida IDs antes de abrir la transacción',async t=>{
  const {enviar,connect}=await escenario(t);
  for(const id of ['abc','0','-1','1.5','2147483648'])assert.equal((await enviar(id)).status,400);
  assert.equal(connect.mock.callCount(),0);
});
test('exige sesión y rol Compras',async t=>{
  const {enviar,connect}=await escenario(t);assert.equal((await enviar('19',0)).status,401);assert.equal((await enviar('19',2)).status,403);assert.equal(connect.mock.callCount(),0);
});
test('revierte y libera la conexión cuando falla la actualización',async t=>{
  t.mock.method(console,'error',()=>{});
  const {enviar,consultas,release}=await escenario(t,{falla:true});assert.equal((await enviar()).status,500);
  assert.equal(consultas.at(-1).sql,'ROLLBACK');assert.equal(release.mock.callCount(),1);
});
