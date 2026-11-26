// Reglas puras de HU14 (PROYEC-25) y de su corrección con nota de crédito: sin SQL ni HTTP.

export function errorVentaConfirmada(status, mensaje, codigo, extra = {}) {
  return Object.assign(new Error(mensaje), { status, codigo, publico: true, ...extra });
}

const ENTERO_MAXIMO = 2_147_483_647;

export function validarId(valor, mensaje = 'La venta indicada no es válida.', codigo = 'VENTA_INVALIDA') {
  const texto = String(valor);
  const id = Number(texto);
  if (!/^[1-9]\d*$/.test(texto) || id > ENTERO_MAXIMO) throw errorVentaConfirmada(400, mensaje, codigo);
  return id;
}

// RN-02: clientes con RUC reciben factura; con DNI, boleta. B2G siempre lleva factura.
export function tipoComprobante({ tipo_documento: tipo, numero_documento: numero, segmento }) {
  if (tipo === 'RUC' && /^\d{11}$/.test(numero ?? '')) return { tipo: 'Factura', serie: 'F001', correlativo: 'FACTURA' };
  if (tipo === 'DNI' && /^\d{8}$/.test(numero ?? '') && segmento !== 'B2G') {
    return { tipo: 'Boleta', serie: 'B001', correlativo: 'BOLETA' };
  }
  throw errorVentaConfirmada(409,
    'El documento del cliente no permite emitir el comprobante. Una entidad pública necesita RUC; corrige el cliente en Ventas.',
    'DOCUMENTO_CLIENTE_INVALIDO');
}

// RN-04: cada serie tiene su propio correlativo de 8 dígitos, por ejemplo F001-00000001.
export function formatearNumero(numero) {
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 99_999_999) {
    throw errorVentaConfirmada(409, 'Se agotó la numeración de la serie. Configura una serie nueva.', 'SERIE_AGOTADA');
  }
  return String(numero).padStart(8, '0');
}

export function normalizarDireccion(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw errorVentaConfirmada(400, 'La dirección debe ser un texto.', 'DIRECCION_INVALIDA');
  const limpia = valor.replace(/\s+/g, ' ').trim();
  if (limpia.length < 5 || limpia.length > 255) {
    throw errorVentaConfirmada(400, 'La dirección debe tener entre 5 y 255 caracteres.', 'DIRECCION_INVALIDA');
  }
  return limpia;
}

const faltaMonto = valor => valor === null || valor === undefined;

// RN-05 y RN-06: arma el documento con los datos y los montos congelados de la venta confirmada.
export function prepararDocumento(venta, lineas, direccion) {
  if (!direccion) {
    throw errorVentaConfirmada(400, 'Ingresa la dirección del cliente para emitir el comprobante.', 'DIRECCION_REQUERIDA');
  }
  if (!lineas.length) throw errorVentaConfirmada(409, 'La venta no tiene productos.', 'VENTA_SIN_PRODUCTOS');
  if ([venta.tasa_igv, venta.subtotal, venta.igv, venta.total].some(faltaMonto) ||
      lineas.some(linea => faltaMonto(linea.precio_unitario) || faltaMonto(linea.importe))) {
    throw errorVentaConfirmada(409, 'La venta no tiene sus importes completos. Revisa los precios antes de emitir.', 'MONTOS_PENDIENTES');
  }
  return {
    cliente: {
      tipo_documento: venta.tipo_documento,
      numero_documento: venta.numero_documento,
      nombre: venta.razon_social_nombre,
      direccion
    },
    documento_respaldo: venta.numero_documento_cliente
      ? { tipo: venta.tipo_documento_cliente, numero: venta.numero_documento_cliente }
      : null,
    lineas: lineas.map(({ codigo_sku, modelo, color, talla, cantidad, precio_unitario, importe }) =>
      ({ codigo_sku, modelo, color, talla, cantidad, precio_unitario, importe })),
    moneda: 'PEN',
    tasa_igv: venta.tasa_igv,
    subtotal: venta.subtotal,
    igv: venta.igv,
    total: venta.total
  };
}

// Códigos del catálogo 09 de SUNAT usados en el MVP para anular un comprobante.
export const MOTIVOS_NOTA_CREDITO = Object.freeze({
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción'
});

export const SERIE_NOTA_CREDITO = Object.freeze({ Factura: 'FC01', Boleta: 'BC01' });

export function validarAnulacion(cuerpo) {
  const motivo = cuerpo?.motivo;
  if (typeof motivo !== 'string' || !Object.hasOwn(MOTIVOS_NOTA_CREDITO, motivo)) {
    throw errorVentaConfirmada(400, 'Selecciona el motivo de la anulación.', 'MOTIVO_INVALIDO');
  }
  const sustento = typeof cuerpo.sustento === 'string' ? cuerpo.sustento.replace(/\s+/g, ' ').trim() : '';
  if (sustento.length < 5 || sustento.length > 250) {
    throw errorVentaConfirmada(400, 'Explica la anulación en 5 a 250 caracteres.', 'SUSTENTO_INVALIDO');
  }
  return { motivo, sustento };
}

// HU15 RN-02: código propio de la orden de despacho, anual como OC-AAAA-NNN.
export function codigoDespacho(anio, numero) {
  if (!Number.isSafeInteger(numero) || numero < 1) throw new Error('Correlativo de despacho inválido.');
  return `OD-${anio}-${String(numero).padStart(3, '0')}`;
}
