import { Router } from 'express';
import { autorizarRoles, requerirAutenticacion } from '../../middlewares/autorizarRoles.js';
import { listarBorradoresParaPrecios, listarProductosParaPrecios, resolverPreciosBorrador } from './precioVenta.repository.js';

const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Ventas'), (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

const enteroPositivo = valor => Number.isInteger(valor) && valor > 0 && valor <= 2_147_483_647;
const idRuta = valor => /^\d+$/.test(valor) ? Number(valor) : NaN;

router.get('/productos', async (_req, res) => {
  res.json({ productos: await listarProductosParaPrecios() });
});
router.get('/borradores', async (req, res) => {
  res.json({ borradores: await listarBorradoresParaPrecios(req.usuario.id_usuario) });
});

function responderBorrador(status, obtenerCambio = () => undefined) {
  return async (req, res) => {
    const idOrden = idRuta(req.params.idOrden);
    if (!enteroPositivo(idOrden)) return res.status(400).json({ mensaje: 'La venta indicada no es válida.' });
    const cambio = obtenerCambio(req);
    if (cambio && (!enteroPositivo(cambio.idSku) || cambio.tipo === 'agregar' && !enteroPositivo(cambio.cantidad))) {
      return res.status(400).json({ mensaje: 'Selecciona un SKU e ingresa una cantidad entera mayor que cero.' });
    }
    try {
      const borrador = await resolverPreciosBorrador(idOrden, req.usuario.id_usuario, cambio);
      return res.status(status).json({ borrador });
    } catch (error) {
      if (error.publico) return res.status(error.status).json({ mensaje: error.message });
      throw error;
    }
  };
}

router.get('/borradores/:idOrden', responderBorrador(200));
router.post('/borradores/:idOrden/lineas', responderBorrador(201, ({ body }) => ({
  tipo: 'agregar', idSku: body?.id_sku, cantidad: body?.cantidad
})));
router.delete('/borradores/:idOrden/lineas/:idSku', responderBorrador(200, ({ params }) => ({
  tipo: 'quitar', idSku: idRuta(params.idSku)
})));

export default router;
