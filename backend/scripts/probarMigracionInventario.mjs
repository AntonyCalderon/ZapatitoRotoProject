import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pool from '../src/config/database.js';

const sql=readFileSync(new URL('../../database/migration/013_inventario_kardex.sql',import.meta.url),'utf8');
const minimoSql=readFileSync(new URL('../../database/migration/014_stock_minimo_cinco.sql',import.meta.url),'utf8');
const ddl=sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const schema='qa_inventario_'+Date.now();
assert.match(schema,/^qa_inventario_\d+$/);
const client=await pool.connect();
let created=false, checks=0;
async function invalid(query,params,code){
  await client.query('SAVEPOINT caso_invalido');
  let failure;
  try {await client.query(query,params);} catch(error){failure=error;}
  await client.query('ROLLBACK TO SAVEPOINT caso_invalido');
  await client.query('RELEASE SAVEPOINT caso_invalido');
  assert.equal(failure?.code,code,failure?.message??'Se aceptó una operación inválida'); checks++;
}
const insert=`INSERT INTO kardex_movimiento
  (id_sku,tipo_movimiento,cantidad,id_usuario,id_recepcion,id_orden_despacho)
  VALUES($1,$2,$3,$4,$5,$6) RETURNING saldo_posterior,fecha_movimiento`;
try {
  // Compilar contra las tablas reales sin dejar cambios ni consumir sus IDs.
  const {rows:[existing]}=await client.query("SELECT to_regclass('public.stock_sku') AS stock, to_regclass('public.kardex_movimiento') AS kardex");
  if(!existing.stock && !existing.kardex){
    await client.query('BEGIN');await client.query(ddl);await client.query('ROLLBACK');
    console.log('Migración compatible con las tablas reales; comprobación revertida.');
  }else{
    assert.ok(existing.stock && existing.kardex,'Migración pública parcial: revisar el esquema.');
    console.log('Migración ya aplicada: pruebas aisladas sin repetirla.');
  }

  // Fixtures aislados: ninguna orden, SKU, usuario o secuencia real se modifica.
  await client.query(`CREATE SCHEMA ${schema}`);created=true;
  await client.query(`SET search_path TO ${schema}, public`);
  await client.query(`
    CREATE TABLE producto_sku(id_sku INTEGER PRIMARY KEY);
    CREATE TABLE usuario(id_usuario INTEGER PRIMARY KEY);
    CREATE TABLE recepcion_compra(id_recepcion INTEGER PRIMARY KEY,id_orden_compra INTEGER NOT NULL);
    CREATE TABLE detalle_orden_compra(id_orden_compra INTEGER NOT NULL,id_sku INTEGER NOT NULL,cantidad INTEGER NOT NULL);
    CREATE TABLE orden_despacho(id_orden_despacho INTEGER PRIMARY KEY,id_orden_venta INTEGER NOT NULL);
    CREATE TABLE detalle_orden_venta(id_orden_venta INTEGER NOT NULL,id_sku INTEGER NOT NULL,cantidad INTEGER NOT NULL);
    INSERT INTO producto_sku VALUES(1),(2),(3);
    INSERT INTO usuario VALUES(1);
    INSERT INTO recepcion_compra VALUES(1,1),(2,2),(3,3),(4,4);
    INSERT INTO detalle_orden_compra VALUES(1,1,12),(2,2,6),(3,3,12),(4,3,12);
    INSERT INTO orden_despacho VALUES(1,1),(2,2),(3,3);
    INSERT INTO detalle_orden_venta VALUES(1,1,10),(2,1,5),(3,3,8);
  `);
  await client.query(sql);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM stock_sku WHERE cantidad_actual=0 AND stock_minimo IS NULL')).rows[0].n,3);checks++;
  await client.query(minimoSql);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM stock_sku WHERE stock_minimo=5')).rows[0].n,3);checks++;
  await client.query('INSERT INTO producto_sku VALUES(4)');
  assert.equal((await client.query('SELECT stock_minimo FROM stock_sku WHERE id_sku=4')).rows[0].stock_minimo,5);checks++;
  assert.equal((await client.query('SELECT cantidad_actual FROM stock_sku WHERE id_sku=4')).rows[0].cantidad_actual,0);checks++;
  await client.query('BEGIN');
  await invalid('UPDATE stock_sku SET stock_minimo=-1 WHERE id_sku=1',[],'23514');
  await invalid('UPDATE stock_sku SET stock_minimo=NULL WHERE id_sku=1',[],'23502');
  await invalid(insert,[1,'ENTRADA_COMPRA',10,1,1,null],'23514');
  await invalid(insert,[2,'ENTRADA_COMPRA',12,1,1,null],'23514');
  await invalid(insert,[1,'ENTRADA_COMPRA',12,999,1,null],'23503');
  assert.equal((await client.query('SELECT cantidad_actual FROM stock_sku WHERE id_sku=1')).rows[0].cantidad_actual,0);checks++;
  assert.equal((await client.query(insert,[1,'ENTRADA_COMPRA',12,1,1,null])).rows[0].saldo_posterior,12);checks++;
  await invalid(insert,[1,'ENTRADA_COMPRA',12,1,1,null],'23505');
  assert.equal((await client.query('SELECT cantidad_actual FROM stock_sku WHERE id_sku=1')).rows[0].cantidad_actual,12);checks++;
  assert.equal((await client.query(insert,[1,'SALIDA_VENTA',10,1,null,1])).rows[0].saldo_posterior,2);checks++;
  await invalid(insert,[1,'SALIDA_VENTA',5,1,null,2],'23514');
  await invalid(insert,[2,'APERTURA',0,1,null,null],'23514');
  await invalid(insert,[1,'APERTURA',1,1,null,null],'23514');
  await invalid(insert,[2,'APERTURA',1,1,2,null],'23514');
  await invalid('UPDATE kardex_movimiento SET cantidad=1',[],'55000');
  await invalid('DELETE FROM kardex_movimiento',[],'55000');
  await invalid('DELETE FROM recepcion_compra WHERE id_recepcion=1',[],'23503');
  await invalid('DELETE FROM stock_sku WHERE id_sku=1',[],'23503');
  // Simular una transacción de varios SKU que falla a mitad.
  await client.query('SAVEPOINT operacion_completa');
  await client.query(insert,[2,'ENTRADA_COMPRA',6,1,2,null]);
  await assert.rejects(client.query(insert,[1,'SALIDA_VENTA',5,1,null,2]),{code:'23514'});
  await client.query('ROLLBACK TO SAVEPOINT operacion_completa');
  assert.equal((await client.query('SELECT cantidad_actual FROM stock_sku WHERE id_sku=2')).rows[0].cantidad_actual,0);checks++;
  assert.equal((await client.query('SELECT count(*)::int AS n FROM kardex_movimiento WHERE id_sku=2')).rows[0].n,0);checks++;
  // Apertura válida, sin inventar una compra antigua.
  assert.equal((await client.query(insert,[4,'APERTURA',7,1,null,null])).rows[0].saldo_posterior,7);checks++;
  await invalid(insert,[4,'APERTURA',1,1,null,null],'23514');
  await client.query('COMMIT');

  // Dos recepciones concurrentes del mismo SKU deben serializar sus saldos.
  const first=await pool.connect(),second=await pool.connect();
  try {
    for(const c of [first,second]) {await c.query(`SET search_path TO ${schema}, public`);await c.query('BEGIN');}
    await first.query(insert,[3,'ENTRADA_COMPRA',12,1,3,null]);
    const other=second.query(insert,[3,'ENTRADA_COMPRA',12,1,4,null]);
    await first.query('COMMIT');
    assert.equal((await other).rows[0].saldo_posterior,24);checks++;
    await second.query('COMMIT');
  } finally {
    for(const c of [first,second]) {await c.query('ROLLBACK');await c.query('RESET search_path');c.release();}
  }
  assert.equal((await client.query('SELECT cantidad_actual FROM stock_sku WHERE id_sku=3')).rows[0].cantidad_actual,24);checks++;
  const mismatch=await client.query(`SELECT s.id_sku FROM stock_sku s LEFT JOIN kardex_movimiento k USING(id_sku)
    GROUP BY s.id_sku,s.cantidad_actual HAVING s.cantidad_actual<>COALESCE(SUM(CASE WHEN k.tipo_movimiento='SALIDA_VENTA' THEN -k.cantidad ELSE k.cantidad END),0)`);
  assert.equal(mismatch.rowCount,0);checks++;
  console.log(`${checks} comprobaciones correctas: claves, cantidades, duplicados, stock, apertura, inmutabilidad, rollback y concurrencia.`);
} finally {
  await client.query('ROLLBACK');
  await client.query('RESET search_path');
  if(created)await client.query(`DROP SCHEMA ${schema} CASCADE`);
  client.release();await pool.end();
}
