// Prueba integrada con SQL real, login y cookies sobre fixtures aislados.
// No modifica tablas ni sesiones del esquema público.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import express from 'express';
import session from 'express-session';
import argon2 from 'argon2';
import pool from '../src/config/database.js';
import authRoutes from '../src/modules/auth/auth.routes.js';
import inventarioRoutes from '../src/modules/almacen/inventario.routes.js';
import { instalarErroresApi } from '../src/middlewares/erroresApi.js';

const schema = 'qa_api_inventario_' + Date.now();
assert.match(schema, /^qa_api_inventario_\d+$/);
const conectarOriginal = pool.connect.bind(pool), consultarOriginal = pool.query.bind(pool);
const admin = await conectarOriginal();
let creado = false, server, checks = 0;
const password = 'SoloPruebaLocal2026';
try {
  await admin.query(`CREATE SCHEMA ${schema}`); creado = true;
  await admin.query(`SET search_path TO ${schema}, public`);
  await admin.query(`
    CREATE TABLE usuario(id_usuario INTEGER PRIMARY KEY,nombre TEXT,correo TEXT,password_hash TEXT,activo BOOLEAN,debe_cambiar_password BOOLEAN);
    CREATE TABLE rol(id_rol INTEGER PRIMARY KEY,nombre_rol TEXT,activo BOOLEAN);
    CREATE TABLE usuario_rol(id_usuario INTEGER,id_rol INTEGER);
    CREATE TABLE modelo(id_modelo INTEGER PRIMARY KEY,nombre_modelo TEXT,activo BOOLEAN);
    CREATE TABLE color(id_color INTEGER PRIMARY KEY,nombre_color TEXT,activo BOOLEAN);
    CREATE TABLE talla(id_talla INTEGER PRIMARY KEY,numero_talla NUMERIC(4,1),activo BOOLEAN);
    CREATE TABLE producto_sku(id_sku INTEGER PRIMARY KEY,codigo_sku TEXT,id_modelo INTEGER,id_color INTEGER,id_talla INTEGER,activo BOOLEAN);
    CREATE TABLE stock_sku(id_sku INTEGER PRIMARY KEY,cantidad_actual INTEGER,stock_minimo INTEGER);
    CREATE TABLE orden_compra(id_orden_compra INTEGER PRIMARY KEY,codigo TEXT);
    CREATE TABLE recepcion_compra(id_recepcion INTEGER PRIMARY KEY,id_orden_compra INTEGER);
    CREATE TABLE orden_despacho(id_orden_despacho INTEGER PRIMARY KEY,codigo TEXT);
    CREATE TABLE kardex_movimiento(id_movimiento BIGINT PRIMARY KEY,id_sku INTEGER,tipo_movimiento TEXT,cantidad INTEGER,saldo_posterior INTEGER,fecha_movimiento TIMESTAMPTZ,id_usuario INTEGER,id_recepcion INTEGER,id_orden_despacho INTEGER);
    INSERT INTO rol VALUES(1,'Almacen',true),(2,'Administrador',true),(3,'Ventas',true),(4,'Compras',true);
    INSERT INTO usuario_rol VALUES(1,1),(2,2),(3,3),(4,4),(5,1),(6,1);
    INSERT INTO modelo VALUES(1,'Threshold',true),(2,'Colorado',true),(3,'Modelo inactivo',false);
    INSERT INTO color VALUES(1,'Negro',true),(2,'Marrón',true);
    INSERT INTO talla VALUES(1,40,true),(2,41,true),(3,42,true);
    INSERT INTO producto_sku VALUES
      (1,'QA-001',1,1,1,true),(2,'QA-002',1,2,1,true),(3,'QA-003',2,1,2,true),
      (4,'QA-004',2,2,2,true),(5,'QA-005',3,1,1,true),(6,'QA-006',1,2,3,false),
      (7,'QA-007',1,1,3,true),(8,'QA-008',2,1,3,true);
    INSERT INTO stock_sku VALUES(1,3,5),(2,0,4),(3,12,5),(4,7,NULL),(5,2,1),(6,0,NULL),(7,5,5),(8,2,0);
    INSERT INTO orden_compra VALUES(1,'OC-QA-001');
    INSERT INTO recepcion_compra VALUES(1,1);
    INSERT INTO orden_despacho VALUES(1,'DES-QA-001');
    INSERT INTO kardex_movimiento VALUES
      (1,1,'APERTURA',10,10,'2026-11-01T04:59:59Z',1,NULL,NULL),
      (9007199254740993,1,'SALIDA_VENTA',7,3,'2026-11-01T05:00:00Z',1,NULL,1),
      (3,3,'ENTRADA_COMPRA',12,12,'2026-11-02T15:00:00Z',1,1,NULL),
      (4,4,'APERTURA',7,7,'2026-11-01T15:00:00Z',1,NULL,NULL),
      (5,5,'APERTURA',2,2,'2026-11-01T15:00:00Z',1,NULL,NULL),
      (7,7,'APERTURA',5,5,'2026-11-01T15:00:00Z',1,NULL,NULL),
      (8,8,'APERTURA',2,2,'2026-11-01T15:00:00Z',1,NULL,NULL);
  `);
  const hash = await argon2.hash(password);
  for (const [id, correo] of [[1,'almacen'],[2,'admin'],[3,'ventas'],[4,'compras'],[5,'inactivo'],[6,'cambiar']]) {
    await admin.query('INSERT INTO usuario VALUES($1,$2,$3,$4,$5,$6)',
      [id,'Usuario QA ' + id, correo + '@qa.invalid',hash,id !== 5,id === 6]);
  }
  // Las consultas de la aplicación apuntan exclusivamente al esquema de QA.
  pool.connect = async () => {
    const cliente = await conectarOriginal();
    await cliente.query(`SET search_path TO ${schema}, public`);
    return cliente;
  };
  pool.query = async (sql, valores) => {
    const cliente = await pool.connect();
    try { return await cliente.query(sql, valores); } finally { cliente.release(); }
  };
  const app = express();
  app.use(express.json());
  app.use(session({ name:'aym.sid', secret:'Sesion-aislada-QA-inventario-2026-no-produccion', resave:false,saveUninitialized:false }));
  app.use('/api/auth',authRoutes);
  app.use('/api/almacen',inventarioRoutes);
  instalarErroresApi(app);
  server = app.listen(0,'127.0.0.1');await once(server,'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  async function pedir(ruta, cookie, status=200) {
    const r=await fetch(url+'/api/almacen'+ruta,{headers:cookie?{cookie}:{}});
    assert.equal(r.status,status,ruta);checks++;
    if(status===200)assert.equal(r.headers.get('cache-control'),'private, no-store');
    return r.json();
  }
  async function login(correo,status=200) {
    const r=await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({correo:correo+'@qa.invalid',password})});
    assert.equal(r.status,status);checks++;
    return r.headers.get('set-cookie')?.split(';')[0];
  }
  for(const ruta of ['/existencias','/catalogo','/kardex/1'])await pedir(ruta,null,401);
  const cookie=await login('almacen');
  let data=await pedir('/existencias',cookie);assert.equal(data.total,6);assert.equal(data.items.length,6);
  assert.equal(data.items.find(i=>i.id_sku===7).situacion,'stock_bajo');
  assert.equal(data.items.find(i=>i.id_sku===8).situacion,'disponible');
  assert.equal(data.items.find(i=>i.id_sku===4).situacion,'sin_minimo');
  data=await pedir('/existencias?catalogo=todos&pagina=2&tamano=3',cookie);assert.equal(data.total,8);assert.equal(data.items.length,3);assert.equal(data.items[0].id_sku,4);
  data=await pedir('/existencias?catalogo=inactivos',cookie);assert.deepEqual(data.items.map(i=>i.id_sku),[5,6]);
  data=await pedir('/existencias?situacion=stock_bajo',cookie);assert.deepEqual(data.items.map(i=>i.id_sku),[1,7]);
  data=await pedir('/existencias?situacion=agotado',cookie);assert.deepEqual(data.items.map(i=>i.id_sku),[2]);
  data=await pedir('/existencias?situacion=sin_minimo',cookie);assert.deepEqual(data.items.map(i=>i.id_sku),[4]);
  data=await pedir('/existencias?id_modelo=1&id_color=1&id_talla=1',cookie);assert.equal(data.total,1);assert.equal(data.items[0].id_sku,1);
  data=await pedir('/existencias?q=threshold',cookie);assert.equal(data.total,3);
  data=await pedir('/existencias?q='+encodeURIComponent("' OR 1=1 --"),cookie);assert.equal(data.total,0);
  data=await pedir('/existencias?q=%25',cookie);assert.equal(data.total,0);
  data=await pedir('/existencias?pagina=100',cookie);assert.equal(data.total,6);assert.equal(data.items.length,0);
  data=await pedir('/catalogo',cookie);assert.equal(data.modelos.length,2);assert.equal(data.colores.length,2);assert.equal(data.tallas.length,3);
  data=await pedir('/catalogo?catalogo=todos',cookie);assert.equal(data.modelos.length,3);
  data=await pedir('/catalogo?catalogo=inactivos',cookie);assert.equal(data.modelos.length,2);
  data=await pedir('/kardex/1',cookie);assert.equal(data.cantidad_actual,3);assert.equal(data.total,2);
  assert.equal(data.items[0].id_movimiento,'9007199254740993');assert.equal(data.items[0].salida,7);assert.equal(data.items[1].saldo_posterior,10);
  assert.equal(data.items[0].documento_origen.codigo,'DES-QA-001');
  data=await pedir('/kardex/1?desde=2026-11-01&hasta=2026-11-01',cookie);assert.equal(data.total,1);assert.equal(data.cantidad_actual,3);
  data=await pedir('/kardex/1?desde=2026-10-31&hasta=2026-10-31',cookie);assert.equal(data.total,1);assert.equal(data.items[0].saldo_posterior,10);assert.equal(data.cantidad_actual,3);
  data=await pedir('/kardex/1?tipo_movimiento=APERTURA',cookie);assert.equal(data.total,1);assert.equal(data.items[0].entrada,10);
  data=await pedir('/kardex/1?pagina=2&tamano=1',cookie);assert.equal(data.total,2);assert.equal(data.items[0].saldo_posterior,10);
  data=await pedir('/kardex/2',cookie);assert.equal(data.total,0);assert.equal(data.cantidad_actual,0);
  data=await pedir('/kardex/5',cookie);assert.equal(data.producto.catalogo_activo,false);
  data=await pedir('/kardex/3',cookie);assert.equal(data.items[0].documento_origen.codigo,'OC-QA-001');
  await pedir('/kardex/2147483647',cookie,404);
  for(const ruta of ['/existencias?tamano=101','/existencias?pagina=0','/catalogo?catalogo=otro','/kardex/1?desde=2026-02-30','/kardex/1?desde=2026-12-01&hasta=2026-11-01'])await pedir(ruta,cookie,400);
  const adminCookie=await login('admin');for(const ruta of ['/existencias','/catalogo','/kardex/1'])await pedir(ruta,adminCookie,403);
  for(const rol of ['ventas','compras']){const c=await login(rol);for(const ruta of ['/existencias','/catalogo','/kardex/1'])await pedir(ruta,c,403);}
  await login('inactivo',401);
  const cambio=await login('cambiar');await pedir('/existencias',cambio,403);
  const antes=(await admin.query('SELECT json_agg(s ORDER BY id_sku) AS datos FROM stock_sku s')).rows[0].datos;
  await pedir('/existencias',cookie);await pedir('/kardex/1',cookie);
  assert.deepEqual((await admin.query('SELECT json_agg(s ORDER BY id_sku) AS datos FROM stock_sku s')).rows[0].datos,antes);
  // El nuevo acuerdo completa todos los mínimos y aplica 5 a nuevas filas.
  await admin.query(readFileSync(new URL('../../database/migration/014_stock_minimo_cinco.sql',import.meta.url),'utf8'));
  await admin.query("INSERT INTO producto_sku VALUES(9,'QA-009',1,1,2,true); INSERT INTO stock_sku(id_sku,cantidad_actual) VALUES(9,6)");
  data=await pedir('/existencias?catalogo=todos',cookie);
  assert.ok(data.items.every(p=>p.stock_minimo===5));
  for(const [id,situacion] of [[1,'stock_bajo'],[2,'agotado'],[3,'disponible'],[4,'disponible'],[7,'stock_bajo'],[8,'stock_bajo'],[9,'disponible']]){
    assert.equal(data.items.find(p=>p.id_sku===id).situacion,situacion);
  }
  data=await pedir('/existencias?situacion=stock_bajo',cookie);assert.deepEqual(data.items.map(p=>p.id_sku),[1,7,8]);
  data=await pedir('/kardex/7',cookie);assert.equal(data.producto.stock_minimo,5);assert.equal(data.producto.situacion,'stock_bajo');
  data=await pedir('/kardex/9',cookie);assert.equal(data.producto.situacion,'disponible');
  console.log(`${checks} peticiones verificadas por HTTP: login real, permisos, filtros, alertas, fechas de Perú, paginación y trazabilidad.`);
  if(process.argv.includes('--postman')) {
    const args=['collection','run','../docs/postman/PROYEC-6-inventario.postman_collection.json',
      '--env-var','base_url='+url,'--env-var','correo=almacen@qa.invalid','--env-var','password='+password,'--reporters','cli'];
    const proceso=process.platform === 'win32'
      ? spawn(process.execPath,[process.env.APPDATA+'/npm/node_modules/postman-cli/bin/postman.js',...args],{stdio:'inherit',windowsHide:true})
      : spawn('postman',args,{stdio:'inherit'});
    const [codigo]=await once(proceso,'exit');assert.equal(codigo,0,'Falló la colección de Postman');
  }
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  pool.connect=conectarOriginal;pool.query=consultarOriginal;
  await admin.query('RESET search_path');
  if(creado)await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  admin.release();await pool.end();
}
