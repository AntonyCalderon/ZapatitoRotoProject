// HU14 (PROYEC-25) y HU15 (PROYEC-26): comprobante de pago y envío a despacho.
export type EstadoVentaConfirmada = 'Pendiente' | 'En Almacén' | 'Despachado'
export type TipoComprobante = 'Factura' | 'Boleta'
export type MotivoNotaCredito = '01' | '02' | '03'

export const MOTIVOS_NOTA_CREDITO: Record<MotivoNotaCredito, string> = {
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción',
}

export interface VentaConfirmadaResumen {
  id_orden_venta: number
  estado: EstadoVentaConfirmada
  fecha_confirmacion: string | null
  total: string | null
  cliente: string
  tipo_documento: 'RUC' | 'DNI'
  tipo_cliente: string
  segmento: string
  pares: number
  tipo_comprobante: TipoComprobante | null
  serie_comprobante: string | null
  numero_comprobante: string | null
  codigo_despacho: string | null
}

export interface ComprobanteVenta {
  id_comprobante: number
  tipo: TipoComprobante
  serie: string
  numero: string
  estado: 'Emitido' | 'Anulado'
  fecha_emision: string
  total: string
}

export interface NotaCreditoVenta {
  id_nota_credito: number
  id_comprobante: number
  serie: string
  numero: string
  motivo: MotivoNotaCredito
  sustento: string
  fecha_emision: string
  total: string
}

export interface DespachoVenta {
  id_orden_despacho: number
  codigo: string
  estado: string
  fecha_emision: string
}

export interface DetalleVentaConfirmada {
  venta: {
    id_orden_venta: number
    estado: EstadoVentaConfirmada
    fecha_creacion: string
    fecha_confirmacion: string | null
    tasa_igv: string | null
    subtotal: string | null
    igv: string | null
    total: string | null
    tipo_documento_cliente: string | null
    numero_documento_cliente: string | null
    tipo_documento: 'RUC' | 'DNI'
    numero_documento: string
    razon_social_nombre: string
    direccion: string | null
    tipo_cliente: string
    segmento: string
  }
  lineas: {
    id_sku: number
    codigo_sku: string
    modelo: string
    color: string
    talla: string
    cantidad: number
    importe: string | null
    precio_con_igv: string | null
  }[]
  comprobantes: ComprobanteVenta[]
  notas_credito: NotaCreditoVenta[]
  despacho: DespachoVenta | null
  comprobante_propuesto: { tipo: TipoComprobante | null; serie: string | null; motivo: string | null }
}

export const ruta = '/api/ventas/confirmadas'
export const codigoComprobante = (c: { serie: string; numero: string }) => `${c.serie}-${c.numero}`

async function solicitar<T>(camino: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(ruta + camino, { credentials: 'include', ...opciones })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos) throw new Error(datos?.mensaje || 'No se pudo procesar la operación de Ventas.')
  return datos as T
}

const enviar = (cuerpo?: unknown): RequestInit => ({
  method: 'POST',
  ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
})

export async function listarVentasConfirmadas(signal: AbortSignal) {
  return (await solicitar<{ ventas: VentaConfirmadaResumen[] }>('', { signal })).ventas
}

export function consultarVentaConfirmada(id: string, signal: AbortSignal) {
  return solicitar<DetalleVentaConfirmada>('/' + encodeURIComponent(id), { signal })
}

export function emitirComprobante(id: number, direccion: string) {
  return solicitar<{ comprobante: ComprobanteVenta }>(`/${id}/comprobante`, enviar({ direccion }))
}

export function anularComprobante(id: number, motivo: MotivoNotaCredito, sustento: string) {
  return solicitar<{ nota_credito: NotaCreditoVenta; comprobante_anulado: ComprobanteVenta }>(
    `/${id}/comprobante/anular`, enviar({ motivo, sustento }))
}

export function enviarADespacho(id: number) {
  return solicitar<{ despacho: DespachoVenta; estado_venta: EstadoVentaConfirmada }>(`/${id}/despacho`, enviar())
}

export const pdfComprobante = (idVenta: number, idComprobante: number) =>
  `${ruta}/${idVenta}/comprobantes/${idComprobante}/pdf`
export const pdfNotaCredito = (idVenta: number, idNota: number) =>
  `${ruta}/${idVenta}/notas-credito/${idNota}/pdf`
