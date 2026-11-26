import { Router } from 'express';
import { autorizarRoles, requerirAutenticacion } from '../../middlewares/autorizarRoles.js';
import { normalizarDireccion, validarAnulacion, validarId } from './comprobante.domain.js';
import { pdfComprobante } from './comprobantePdf.js';
import {
  anularComprobante, detalleVentaConfirmada, documentoParaPdf, emitirComprobante, enviarADespacho,
  listarVentasConfirmadas
} from './ventaConfirmada.repository.js';

// HU14 (PROYEC-25) y HU15 (PROYEC-26): solo el vendedor de cada venta la ve y la opera.
const router = Router();
router.use(requerirAutenticacion, autorizarRoles('Ventas'), (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

function responder(status, accion) {
  return async (req, res) => {
    try {
      return res.status(status).json(await accion(req));
    } catch (error) {
      if (error.publico) return res.status(error.status).json({ codigo: error.codigo, mensaje: error.message });
      throw error;
    }
  };
}

const idVenta = req => validarId(req.params.id);

router.get('/', responder(200, async req => ({ ventas: await listarVentasConfirmadas(req.usuario.id_usuario) })));

router.get('/:id', responder(200, req => detalleVentaConfirmada(idVenta(req), req.usuario.id_usuario)));

router.post('/:id/comprobante', responder(201, req => emitirComprobante({
  idVenta: idVenta(req),
  idUsuario: req.usuario.id_usuario,
  direccion: normalizarDireccion(req.body?.direccion)
})));

router.post('/:id/comprobante/anular', responder(201, req => anularComprobante({
  idVenta: idVenta(req),
  idUsuario: req.usuario.id_usuario,
  ...validarAnulacion(req.body)
})));

router.post('/:id/despacho', responder(201, req => enviarADespacho({
  idVenta: idVenta(req),
  idUsuario: req.usuario.id_usuario
})));

function descargar(tipo) {
  return async (req, res) => {
    try {
      const documento = await documentoParaPdf(idVenta(req), req.usuario.id_usuario, tipo,
        validarId(req.params.idDocumento, 'El documento indicado no es válido.', 'DOCUMENTO_INVALIDO'));
      return res.attachment(`${documento.serie}-${documento.numero}.pdf`).send(pdfComprobante(documento));
    } catch (error) {
      if (error.publico) return res.status(error.status).json({ codigo: error.codigo, mensaje: error.message });
      throw error;
    }
  };
}

router.get('/:id/comprobantes/:idDocumento/pdf', descargar('comprobante'));
router.get('/:id/notas-credito/:idDocumento/pdf', descargar('nota'));

export default router;
