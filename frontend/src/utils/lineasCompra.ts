/*
Funciones puras para armar las líneas de una solicitud de compra (HU02).
No usan React ni red, por eso se prueban de forma directa.
*/

export interface LineaSolicitud {
  id_detalle_compra?: number
  costo_unitario?: string | null
  importe?: string | null
  id_sku: number
  codigo_sku: string
  nombre_modelo: string
  nombre_color: string
  numero_talla: string
  cantidad: number
}

// La base envía la talla como NUMERIC(4,1), por ejemplo "40.0". Se muestra como "40".
export function formatearTalla(valor: string): string {
  const numero = Number(valor)
  return Number.isFinite(numero) ? String(numero) : valor
}

// Una celda vacía significa que no se pide esa talla.
export function esCantidadValida(texto: string): boolean {
  return texto === '' || /^\d+$/.test(texto)
}

// Suma en una sola línea los pedidos que comparten SKU y descarta las cantidades en cero.
export function agregarLineas(actuales: LineaSolicitud[], nuevas: LineaSolicitud[]): LineaSolicitud[] {
  const porSku = new Map<number, LineaSolicitud>(actuales.map((l) => [l.id_sku, { ...l }]))

  for (const nueva of nuevas) {
    if (nueva.cantidad <= 0) continue
    const existente = porSku.get(nueva.id_sku)
    porSku.set(nueva.id_sku, existente
      ? { ...existente, cantidad: existente.cantidad + nueva.cantidad }
      : { ...nueva })
  }

  return [...porSku.values()]
}

export function quitarLinea(lineas: LineaSolicitud[], idSku: number): LineaSolicitud[] {
  return lineas.filter((linea) => linea.id_sku !== idSku)
}

export function totalPares(lineas: LineaSolicitud[]): number {
  return lineas.reduce((suma, linea) => suma + linea.cantidad, 0)
}

export interface ParesPorModelo {
  nombre_modelo: string
  pares: number
}

// CA-03: pares de cada modelo, en el orden en que aparecen en la solicitud.
export function resumirPorModelo(lineas: LineaSolicitud[]): ParesPorModelo[] {
  const porModelo = new Map<string, number>()

  for (const linea of lineas) {
    porModelo.set(linea.nombre_modelo, (porModelo.get(linea.nombre_modelo) ?? 0) + linea.cantidad)
  }

  return [...porModelo].map(([nombre_modelo, pares]) => ({ nombre_modelo, pares }))
}

// Compara dos listas por SKU y cantidad, sin importar el orden. Sirve para detectar cambios sin guardar.
export function lineasIguales(a: LineaSolicitud[], b: LineaSolicitud[]): boolean {
  if (a.length !== b.length) return false

  const cantidadPorSku = new Map(a.map((linea) => [linea.id_sku, linea.cantidad]))
  return b.every((linea) => cantidadPorSku.get(linea.id_sku) === linea.cantidad)
}
