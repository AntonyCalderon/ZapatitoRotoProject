import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import express from 'express';
import pool from '../src/config/database.js';
import pendientes from '../src/modules/almacen/pendientes.routes.js';
import recepciones from '../src/modules/almacen/recepcion.routes.js';
import ordenes from '../src/modules/ordenes-compra/ordenCompra.routes.js';
import {instalarErroresApi} from '../src/middlewares/erroresApi.js';
const schema='qa_recepcion_'+Date.now();assert.match(schema,/^qa_recepcion_\d+$/);
const connect=pool.connect.bind(pool),query=pool.query.bind(pool),admin=await connect();
let creado=false,server,n=0;
try{
 await admin.query(`CREATE SCHEMA ${schema}`);creado=true;
 await admin.query(`SET search_path TO ${schema},public`);
 await admin.query(`
  CREATE TABLE usuario(id_usuario INTEGER PRIMARY KEY,nombre TEXT,correo TEXT,activo BOOLEAN,debe_cambiar_password BOOLEAN);
  CREATE TABLE rol(id_rol INTEGER PRIMARY KEY,nombre_rol TEXT,activo BOOLEAN);
  CREATE TABLE usuario_rol(id_usuario INTEGER,id_rol INTEGER);
  INSERT INTO usuario VALUES(1,'Almacenero QA','almacen@qa.invalid',true,false),(2,'Comprador QA','compras@qa.invalid',true,false),(3,'Admin QA','admin@qa.invalid',true,false);
  INSERT INTO rol VALUES(1,'Almacen',true),(2,'Compras',true),(3,'Administrador',true);
  INSERT INTO usuario_rol VALUES(1,1),(2,2),(3,3);
  CREATE TABLE proveedor(id_proveedor INTEGER PRIMARY KEY,razon_social TEXT);
  INSERT INTO proveedor VALUES(1,'Proveedor QA');
  CREATE TABLE modelo(id_modelo INTEGER PRIMARY KEY,nombre_modelo TEXT);
  CREATE TABLE color(id_color INTEGER PRIMARY KEY,nombre_color TEXT);
  CREATE TABLE talla(id_talla INTEGER PRIMARY KEY,numero_talla NUMERIC(4,1));
  CREATE TABLE producto_sku(id_sku INTEGER PRIMARY KEY,codigo_sku TEXT,id_modelo INTEGER,id_color INTEGER,id_talla INTEGER);
  INSERT INTO modelo VALUES(1,'Threshold');INSERT INTO color VALUES(1,'Negro');INSERT INTO talla VALUES(1,40);
  INSERT INTO producto_sku VALUES(1,'THR-NEG-40',1,1,1),(2,'SKU-QA-2',1,1,1),(3,'SKU-QA-3',1,1,1);
  CREATE TABLE orden_compra(id_orden_compra INTEGER PRIMARY KEY,codigo TEXT,estado TEXT,id_proveedor INTEGER,
    fecha_emision TIMESTAMPTZ DEFAULT now(),documento_emitido JSONB DEFAULT '{}',id_usuario_confirma INTEGER,fecha_confirmacion TIMESTAMPTZ);
  INSERT INTO orden_compra(id_orden_compra,codigo,estado,id_proveedor) VALUES
    (1,'OC-QA-001','EMITIDA',1),(2,'OC-QA-002','EMITIDA',1),(3,'OC-QA-003','BORRADOR',1),
    (4,'OC-QA-004','EMITIDA',1),(5,'OC-QA-005','EMITIDA',1),(6,'OC-QA-006','EMITIDA',1),(7,'OC-QA-007','EMITIDA',1);
  CREATE TABLE detalle_orden_compra(id_detalle_compra INTEGER PRIMARY KEY,id_orden_compra INTEGER,id_sku INTEGER,cantidad INTEGER,UNIQUE(id_orden_compra,id_sku));
  INSERT INTO detalle_orden_compra VALUES(1,1,1,6),(2,1,2,7),(3,2,1,4),(4,2,3,8),(5,3,1,1),(6,5,2,2),(7,6,1,3),(8,7,1,2);
  CREATE TABLE recepcion_compra(id_recepcion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_orden_compra INTEGER UNIQUE REFERENCES orden_compra,
    id_usuario_almacen INTEGER REFERENCES usuario,fecha_recepcion TIMESTAMPTZ DEFAULT now(),observacion TEXT);
  CREATE TABLE orden_despacho(id_orden_despacho INTEGER PRIMARY KEY,id_orden_venta INTEGER);
  CREATE TABLE detalle_orden_venta(id_orden_venta INTEGER,id_sku INTEGER,cantidad INTEGER);
  INSERT INTO recepcion_compra(id_orden_compra,id_usuario_almacen) VALUES(6,1);
 `);
 for(const file of ['013_inventario_kardex.sql','014_stock_minimo_cinco.sql','015_verificacion_recepcion.sql'])
   await admin.query(readFileSync(new URL('../../database/migration/'+file,import.meta.url),'utf8'));
 pool.connect=async()=>{const c=await connect();await c.query(`SET search_path TO ${schema},public`);return c;};
 pool.query=async(sql,values)=>{const c=await pool.connect();try{return await c.query(sql,values);}finally{c.release();}};
 const app=express();app.use(express.json());
 app.use((req,_res,next)=>{req.session={idUsuario:Number(req.get('x-test-session'))};next();});
 app.use('/api/almacen/pendientes',pendientes);app.use('/api/almacen/recepciones',recepciones);app.use('/api/ordenes-compra',ordenes);instalarErroresApi(app);
 server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port;
 async function pedir(path,usuario=1,status=200,body,key){
  const r=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','x-test-session':String(usuario),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const d=await r.json();assert.ok(Array.isArray(status)?status.includes(r.status):r.status===status,JSON.stringify({path,d,status:r.status}));n++;return d;
 }
 const body=lineas=>({lineas:lineas.map(([id,cantidad])=>({id_detalle_compra:id,cantidad_recibida:cantidad,verificado:true}))});
 const confirm=(id,datos,status=201,key=randomUUID(),usuario=1)=>pedir(`/api/almacen/recepciones/${id}/confirmacion`,usuario,status,datos,key);
 const comercial=(id,status=200,usuario=2)=>pedir(`/api/ordenes-compra/${id}/confirmacion`,usuario,status,{});
 const stocks=async()=>(await admin.query('SELECT id_sku,cantidad_actual FROM stock_sku ORDER BY id_sku')).rows;
 const detalle=await pedir('/api/almacen/pendientes/1');assert.equal(detalle.lineas[0].codigo_sku,'THR-NEG-40');assert.equal(detalle.lineas[0].id_detalle_compra,1);
 assert.ok((await pedir('/api/almacen/pendientes')).every(o=>o.situacion_logistica==='EN_TRANSITO'));
 await comercial(1,409);assert.equal((await stocks())[0].cantidad_actual,0);
 await confirm(1,body([[1,6],[2,7]]),401,randomUUID(),0);
 await confirm(1,body([[1,6],[2,7]]),403,randomUUID(),2);await confirm(1,body([[1,6],[2,7]]),403,randomUUID(),3);
 await comercial(1,403,1);
 await confirm(1,{lineas:[]},400);await confirm(1,{lineas:[{id_detalle_compra:1,cantidad_recibida:6,verificado:false}]},400);
 await confirm(1,body([[1,6],[1,6]]),400);await confirm(1,body([[1,6],[2,7]]),400,'invalida');
 await confirm(1,body([[1,5],[2,7]]),409);await confirm(1,body([[1,6]]),409);await confirm(1,body([[1,6],[3,7]]),409);
 await confirm(3,body([[5,1]]),409);await confirm(4,body([[1,6]]),409);await confirm(999,body([[1,6]]),404);
 const key=randomUUID(),recibida=await confirm(1,{...body([[1,6],[2,7]]),id_usuario_almacen:2},201,key);
 assert.equal(recibida.recepcion.pares,13);assert.equal(recibida.recepcion.usuario_almacen,'Almacenero QA');assert.equal(recibida.recepcion.lote_verificado,true);
 assert.deepEqual((await stocks()).map(s=>s.cantidad_actual),[6,7,0]);
 assert.equal((await confirm(1,body([[2,7],[1,6]]),200,key)).repetida,true);
 await confirm(1,body([[1,6],[2,7]]),409);await confirm(1,body([[1,6],[2,6]]),409,key);await confirm(2,body([[3,4],[4,8]]),409,key);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM kardex_movimiento')).rows[0].n,2);
 await pedir('/api/almacen/pendientes/1',1,404);assert.ok(!(await pedir('/api/almacen/pendientes')).some(o=>o.id_orden_compra===1));
 const emitidas=await pedir('/api/ordenes-compra/emitidas',2);
 assert.equal(emitidas.find(o=>o.id_orden_compra===1).situacion_logistica,'RECIBIDA');assert.equal(emitidas.find(o=>o.id_orden_compra===2).situacion_logistica,'EN_TRANSITO');
 assert.equal(emitidas.find(o=>o.id_orden_compra===6).lote_verificado,false);await comercial(6,409);
 const antes=await stocks();const confirmado=await comercial(1);assert.equal(confirmado.orden.usuario_confirma,'Comprador QA');
 assert.equal(confirmado.orden.estado,'EMITIDA');assert.equal((await comercial(1)).orden.fecha_confirmacion,confirmado.orden.fecha_confirmacion);assert.deepEqual(await stocks(),antes);
 // Forzar un fallo en la segunda línea: no debe persistir cabecera ni primer incremento.
 await admin.query(`CREATE FUNCTION fallar_segunda_linea() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.id_sku=3 THEN RAISE EXCEPTION 'Fallo de QA controlado'; END IF; RETURN NEW; END; $$;
  CREATE TRIGGER qa_fallo BEFORE INSERT ON kardex_movimiento FOR EACH ROW EXECUTE FUNCTION fallar_segunda_linea();`);
 const retry=randomUUID();await confirm(2,body([[3,4],[4,8]]),500,retry);assert.deepEqual(await stocks(),antes);
 assert.equal((await admin.query('SELECT count(*)::int AS n FROM recepcion_compra WHERE id_orden_compra=2')).rows[0].n,0);
 await admin.query('DROP TRIGGER qa_fallo ON kardex_movimiento');await confirm(2,body([[3,4],[4,8]]),201,retry);
 const concurrentKey=randomUUID();const repeticiones=await Promise.all([confirm(5,body([[6,2]]),[200,201],concurrentKey),confirm(5,body([[6,2]]),[200,201],concurrentKey)]);assert.deepEqual(repeticiones.map(r=>r.repetida).sort(),[false,true]);
 // Con claves diferentes se rechaza exactamente una confirmación, sin duplicar entradas.
 const respuestas=await Promise.all([1,2].map(()=>fetch(url+'/api/almacen/recepciones/7/confirmacion',{method:'POST',headers:{'Content-Type':'application/json','x-test-session':'1','Idempotency-Key':randomUUID()},body:JSON.stringify(body([[8,2]]))})));
 assert.deepEqual(respuestas.map(r=>r.status).sort(),[201,409]);n+=2;
 const reconciliacion=await admin.query(`SELECT s.id_sku FROM stock_sku s LEFT JOIN kardex_movimiento k USING(id_sku) GROUP BY s.id_sku,s.cantidad_actual HAVING s.cantidad_actual<>COALESCE(sum(k.cantidad),0)`);
 assert.equal(reconciliacion.rowCount,0);
 console.log(`${n} peticiones verificadas: recepción completa, roles, reintentos, concurrencia, rollback, indicador y confirmación comercial sin sumar stock.`);
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));pool.connect=connect;pool.query=query;
 await admin.query('RESET search_path');if(creado)await admin.query(`DROP SCHEMA ${schema} CASCADE`);admin.release();await pool.end();
}
