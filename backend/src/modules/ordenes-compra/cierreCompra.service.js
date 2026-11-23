import { listarComprasCerradas, buscarCompraCerrada, registrarCierreCompra } from './cierreCompra.repository.js';

const error = (status, mensaje) => Object.assign(new Error(mensaje), { status });
function idCompra(valor) {
  if (!/^[1-9]\d*$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) > 2147483647)
    throw error(400, 'Identificador de compra inválido.');
  return Number(valor);
}
export const consultarHistoricoCompras = () => listarComprasCerradas();
export async function consultarCompraCerrada(id) {
  const orden = await buscarCompraCerrada(idCompra(id));
  if (!orden) throw error(404, 'La compra cerrada no existe.');
  return orden;
}
export async function cerrarCompra(id, usuario) {
  const resultado = await registrarCierreCompra(idCompra(id), usuario);
  if (resultado.problema === 'inexistente') throw error(404, 'La orden de compra no existe.');
  if (resultado.problema) throw error(409, 'Primero Almacén debe recibir el lote completo y Compras debe confirmar comercialmente.');
  return resultado;
}
