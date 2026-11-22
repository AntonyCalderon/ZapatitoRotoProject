export interface OrdenPorRecibir { id_orden_compra:number; codigo:string; proveedor:string; pares:number; situacion_logistica:'EN_TRANSITO' }
export interface LineaRecepcion { id_detalle_compra:number; id_sku:number; codigo_sku:string; modelo:string; color:string; talla:string; cantidad:number }
export interface DetalleRecepcion { id_orden_compra:number; codigo:string; proveedor:string; situacion_logistica:'EN_TRANSITO'; lineas:LineaRecepcion[] }
export interface ResultadoRecepcion { mensaje:string; repetida:boolean; recepcion:{id_recepcion:number;codigo:string;pares:number;usuario_almacen:string;fecha_recepcion:string;lote_verificado:boolean} }
async function solicitar<T>(url:string,opciones:RequestInit):Promise<T> {
  const r=await fetch(url,{credentials:'include',...opciones});
  const d=await r.json().catch(()=>null);
  if(!r.ok)throw Object.assign(new Error(d?.mensaje||'No se pudo procesar la recepción.'),{status:r.status,codigo:d?.codigo});
  return d as T;
}
export const listarPendientesRecepcion=(signal:AbortSignal)=>solicitar<OrdenPorRecibir[]>('/api/almacen/pendientes',{signal});
export const consultarRecepcion=(id:string,signal:AbortSignal)=>solicitar<DetalleRecepcion>('/api/almacen/pendientes/'+encodeURIComponent(id),{signal});
export function confirmarRecepcionCompleta(id:string,lineas:LineaRecepcion[],clave:string) {
  return solicitar<ResultadoRecepcion>('/api/almacen/recepciones/'+encodeURIComponent(id)+'/confirmacion',{
    method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':clave},
    body:JSON.stringify({lineas:lineas.map(l=>({id_detalle_compra:l.id_detalle_compra,cantidad_recibida:l.cantidad,verificado:true}))}),
  });
}
