import { Router } from 'express';
import { autorizarRoles, requerirAutenticacion } from '../../middlewares/autorizarRoles.js';
import { registrarCostoBase } from '../costos-base/costoBase.service.js';
import { buscarProductoSkuPorId } from '../productos-sku/productoSku.repository.js';

const router = Router();

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
