import { registrarSalida } from './salida.service.js';

export async function registrarSalidaController(req, res) {
  try {
    // El usuario sale de la sesión, nunca del cuerpo de la petición.
    const datos = await registrarSalida(req.params.id, req.usuario.id_usuario);
    return res
      .set('Cache-Control', 'private, no-store')
      .status(201)
      .json({ mensaje: 'Salida física registrada. El pedido quedó despachado.', ...datos });
  } catch (e) {
    if ([400, 404, 409].includes(e.status)) {
      return res.status(e.status).json({ codigo: e.codigo, mensaje: e.message, faltantes: e.faltantes });
    }
    console.error('Error al registrar la salida física:', e);
    return res.status(500).json({ mensaje: 'No se pudo registrar la salida.' });
  }
}