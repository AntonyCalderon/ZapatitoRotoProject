import { Router } from 'express';
import pool from '../../config/database.js';
import { autorizarRoles, requerirAutenticacion } from '../../middlewares/autorizarRoles.js';
import { registrarCostoBase } from '../costos-base/costoBase.service.js';
import { consolidarLineas, validarEntero } from '../lineas-compra/lineaCompra.domain.js';
import { buscarOrdenCompraPorId } from '../ordenes-compra/ordenCompra.repository.js';
import { buscarProductoSkuPorId } from '../productos-sku/productoSku.repository.js';
import { resumirCostoAdquisicion } from './costoAdquisicion.service.js';

const router = Router();

router.post('/ordenes/:idOrden/resumen-costos', requerirAutenticacion, autorizarRoles('Compras'), async (req, res) => {
  try {
    const idOrden = validarEntero(req.params.idOrden, 'La orden de compra');
    if (idOrden > 2_147_483_647) {
      return res.status(400).json({ mensaje: 'El identificador de la orden de compra no es válido.' });
    }

    const lineas = consolidarLineas(req.body?.lineas);
    const orden = await buscarOrdenCompraPorId(idOrden);
    if (!orden) {
      return res.status(404).json({ mensaje: 'La orden de compra no existe.' });
    }
    if (orden.estado !== 'BORRADOR') {
      return res.status(409).json({ mensaje: 'Solo se pueden recalcular los costos de un borrador.' });
    }

    // Las cantidades pueden incluir cambios que todavía no se han guardado.
    const resumen = await resumirCostoAdquisicion(
      pool,
      lineas.map(({ id_sku, cantidad }) => ({ idSku: id_sku, cantidad }))
    );
    return res.json(resumen);
  } catch (error) {
    if (error.status === 400 || error.status === 503) {
      return res.status(error.status).json({ mensaje: error.message });
    }
    if (error instanceof RangeError) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error('Error al calcular el costo de adquisición:', error.message);
    return res.status(500).json({ mensaje: 'No se pudo calcular el resumen de costos.' });
  }
});

router.post('/costos-faltantes/:idSku', requerirAutenticacion, autorizarRoles('Compras'), async (req, res) => {
  const idSku = Number(req.params.idSku);
  if (!Number.isInteger(idSku) || idSku < 1 || idSku > 2_147_483_647) {
    return res.status(400).json({ mensaje: 'Selecciona un SKU válido.' });
  }

  const costoUnitario = req.body?.costoUnitario;
  const monto = typeof costoUnitario === 'string' ? costoUnitario.trim() : '';
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(monto) || Number(monto) <= 0) {
    return res.status(400).json({
      mensaje: 'Ingresa un costo mayor a cero, con hasta diez dígitos enteros y dos decimales.'
    });
  }

  try {
    const sku = await buscarProductoSkuPorId(idSku);
    if (!sku) {
      return res.status(404).json({ mensaje: 'El producto SKU no existe.' });
    }
    if (!sku.activo || !sku.modelo_activo || !sku.talla_activa || !sku.color_activo) {
      return res.status(409).json({ mensaje: 'El SKU o alguno de sus componentes está inactivo.' });
    }

    const costo = await registrarCostoBase(sku.id_modelo, sku.id_talla, Number(monto));
    return res.status(201).json({ mensaje: 'Costo base registrado en el catálogo.', costo });
  } catch (error) {
    if (error.status === 409 || (error.code === '23505' && error.constraint === 'uq_costo_modelo_talla')) {
      return res.status(409).json({ mensaje: 'Este modelo y talla ya tienen un costo registrado.' });
    }
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'El modelo o la talla ya no está disponible.' });
    }

    console.error('Error al registrar costo desde Compras:', error.message);
    return res.status(500).json({ mensaje: 'No se pudo registrar el costo base.' });
  }
});

export default router;
