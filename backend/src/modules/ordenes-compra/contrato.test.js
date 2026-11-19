import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerBorradores } from './ordenCompra.service.js';
import { crearServicioLineasCompra } from '../lineas-compra/lineaCompra.service.js';

test('rechaza estados fuera del contrato antes de consultar la BD', async () => {
  for (const estado of ['Recibida', 'Cerrada', 'Borrador', '', ['BORRADOR']]) {
    await assert.rejects(obtenerBorradores(estado), {status:400});
  }
});
test('POST de detalles valida cantidad positiva y consolida los SKU repetidos', async () => {
  const llamadas=[];
  const servicio=crearServicioLineasCompra({async agregarDetalles(id,lineas){llamadas.push({id,lineas});return {lineas:lineas.map(l=>({...l,nombre_modelo:'CAT'}))};}});
  for (const cantidad of [0,-1,1.5,null,'']) {
    await assert.rejects(servicio.agregarDetallesBorrador(7,[{id_sku:1,cantidad}]),{status:400});
  }
  await assert.rejects(servicio.agregarDetallesBorrador(7,[]),{status:400});
  const resumen=await servicio.agregarDetallesBorrador('7',[{id_sku:1,cantidad:2},{id_sku:1,cantidad:3}]);
  assert.deepEqual(llamadas,[{id:7,lineas:[{id_sku:1,cantidad:5}]}]);
  assert.equal(resumen.total_pares,5);
});
test('POST comunica conflictos sin fingir que agregó detalles',async()=>{
  for(const tipo of ['orden_inexistente','no_es_borrador','detalle_no_agregado']) {
    const servicio=crearServicioLineasCompra({async agregarDetalles(){return {problema:{tipo}};}});
    await assert.rejects(servicio.agregarDetallesBorrador(7,[{id_sku:1,cantidad:2}]),{status:tipo==='orden_inexistente'?404:409});
  }
});
