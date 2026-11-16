import { obtenerUsuarios, obtenerRoles, registrarUsuario, actualizarEstado } from './usuario.service.js';
function responderError(res, error) {
  if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ mensaje: error.message });
  console.error('Error en gestión de usuarios:', error.message);
  return res.status(500).json({ mensaje: 'No se pudo completar la operación.' });
}
export async function listarUsuariosController(req, res) {
  try { return res.json({ usuarios: await obtenerUsuarios() }); } catch (e) { return responderError(res, e); }
}
export async function listarRolesController(req, res) {
  try { return res.json({ roles: await obtenerRoles() }); } catch (e) { return responderError(res, e); }
}
export async function crearUsuarioController(req, res) {
  res.set('Cache-Control', 'no-store');
  try { return res.status(201).json(await registrarUsuario(req.body)); } catch (e) { return responderError(res, e); }
}
export async function cambiarEstadoController(req, res) {
  try { return res.json({ usuario: await actualizarEstado(req.params.id, req.body?.activo, req.usuario.id_usuario) }); } catch (e) { return responderError(res, e); }
}
