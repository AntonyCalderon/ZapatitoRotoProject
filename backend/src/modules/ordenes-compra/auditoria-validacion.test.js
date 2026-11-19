import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {instalarErroresApi} from '../../middlewares/erroresApi.js';
import {validarEntero} from '../lineas-compra/lineaCompra.domain.js';
import {consultarOrdenCompra} from './ordenCompra.service.js';

test('IDs INTEGER: admite el máximo y rechaza valores fuera de rango antes de consultar',async()=>{
  assert.equal(validarEntero('2147483647','El SKU'),2147483647);
  for(const id of ['2147483648',Number.MAX_SAFE_INTEGER]) {
    assert.throws(()=>validarEntero(id,'El SKU'),{status:400});
    await assert.rejects(consultarOrdenCompra(id),{status:400});
  }
});
test('errores de JSON, URL, tamaño, ruta y servidor siempre devuelven JSON',async()=>{
  const app=express();app.use(express.json({limit:'64b'}));
  app.post('/api/prueba',(req,res)=>res.json(req.body));
  app.get('/api/prueba/:id',(req,res)=>res.json({id:req.params.id}));
  app.get('/api/error',(req,res,next)=>next(new Error('detalle interno no público')));
  instalarErroresApi(app);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const [path,method,body,status] of [
      ['/api/prueba','POST','null',400],['/api/prueba','POST','{',400],
      ['/api/prueba','POST',JSON.stringify({texto:'x'.repeat(100)}),413],
      ['/api/prueba/%ZZ','GET',undefined,400],['/api/ausente','GET',undefined,404],
      ['/api/error','GET',undefined,500]
    ]) {
      const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body});
      assert.equal(res.status,status,path);assert.match(res.headers.get('content-type'),/application\/json/);
      const data=await res.json();assert.equal(typeof data.mensaje,'string');assert.ok(!JSON.stringify(data).includes('detalle interno'));
    }
  } finally {await new Promise(resolve=>server.close(resolve));}
});
