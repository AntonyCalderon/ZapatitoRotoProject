import { validarIdDespacho } from './salida.domain.js';
import { registrarSalidaDespacho } from './salida.repository.js';

export function registrarSalida(id, idUsuario) {
  return registrarSalidaDespacho({ idDespacho: validarIdDespacho(id), idUsuario });
}
