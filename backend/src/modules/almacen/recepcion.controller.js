import { consultarPendientesRecepcion, consultarDetalleRecepcion, confirmarRecepcion } from './recepcion.service.js';
function error(res,e) {
  if ([400,404,409].includes(e.status)) return res.status(e.status).json({codigo:e.codigo,mensaje:e.message});
  console.error('Error en recepción de compra:',e);
  return res.status(500).json({mensaje:'No se pudo procesar la recepción.'});
}
export async function listarPendientesController(_req,res) {
  try {return res.json(await consultarPendientesRecepcion());}catch(e){return error(res,e);}
}
export async function detalleRecepcionController(req,res) {
  try {return res.json(await consultarDetalleRecepcion(req.params.id));}catch(e){return error(res,e);}
}
export async function confirmarRecepcionController(req,res) {
  try {
    const datos=await confirmarRecepcion(req.params.id,req.usuario.id_usuario,req.body,req.get('Idempotency-Key'));
    return res.status(datos.repetida?200:201).json({mensaje:'Lote verificado y recibido por Almacén.',...datos});
  }catch(e){return error(res,e);}
}
