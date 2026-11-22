import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validarVerificacion,idRecepcion} from './recepcion.domain.js';
const clave='12345678-1234-4234-8234-123456789abc';
const linea={id_detalle_compra:1,cantidad_recibida:6,verificado:true};
test('la verificación exige todas las declaraciones físicas y cantidades enteras',()=>{
  for(const lineas of [[],null,[{...linea,verificado:false}],[{...linea,cantidad_recibida:0}],[{...linea,cantidad_recibida:1.5}],[{...linea,id_detalle_compra:'1'}],[linea,linea]])
    assert.throws(()=>validarVerificacion('1',7,{lineas},clave),e=>e.status===400);
  assert.throws(()=>validarVerificacion('1',7,{lineas:[linea]},'clave-invalida'),e=>e.status===400);
});
test('el reintento conserva huella aunque cambie el orden de las líneas',()=>{
  const otra={...linea,id_detalle_compra:2,cantidad_recibida:7};
  const primero=validarVerificacion('1',7,{lineas:[linea,otra]},clave);
  assert.equal(primero.huella,validarVerificacion('1',7,{lineas:[otra,linea]},clave).huella);
  assert.notEqual(primero.huella,validarVerificacion('1',8,{lineas:[linea,otra]},clave).huella);
  assert.notEqual(primero.huella,validarVerificacion('2',7,{lineas:[linea,otra]},clave).huella);
});
test('valida identificadores de compra antes de consultar',()=>{
  assert.equal(idRecepcion('2147483647'),2147483647);
  for(const valor of ['0','-1','1.2','1x','2147483648',null])assert.throws(()=>idRecepcion(valor),e=>e.status===400);
});
