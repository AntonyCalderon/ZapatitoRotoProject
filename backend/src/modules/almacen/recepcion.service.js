import { idRecepcion, validarVerificacion, errorRecepcion } from './recepcion.domain.js';
import { listarRecepcionesPendientes,buscarRecepcionPendiente,registrarRecepcionCompleta } from './recepcion.repository.js';
export const consultarPendientesRecepcion = () => listarRecepcionesPendientes();
export async function consultarDetalleRecepcion(id) {
  const datos = await buscarRecepcionPendiente(idRecepcion(id));
  if (!datos) throw errorRecepcion(404,'La orden no está pendiente de recepción.');
  return datos;
}
export function confirmarRecepcion(id, usuario, cuerpo, clave) {
  return registrarRecepcionCompleta(validarVerificacion(id,usuario,cuerpo,clave));
}
