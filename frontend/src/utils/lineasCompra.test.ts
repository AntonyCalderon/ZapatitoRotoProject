import { describe, expect, it } from 'vitest'
import {
  agregarLineas,
  esCantidadValida,
  formatearTalla,
  lineasIguales,
  quitarLinea,
  resumirPorModelo,
  totalPares,
  type LineaSolicitud
} from './lineasCompra'

const linea = (id_sku: number, cantidad: number): LineaSolicitud => ({
  id_sku,
  codigo_sku: `SKU-${id_sku}`,
  nombre_modelo: 'Threshold',
  nombre_color: 'Negro',
  numero_talla: '40.0',
  cantidad
})

describe('formatearTalla', () => {
  it('quita el decimal innecesario que envía la base de datos', () => {
    expect(formatearTalla('40.0')).toBe('40')
    expect(formatearTalla('40.5')).toBe('40.5')
    expect(formatearTalla('41')).toBe('41')
  })
})

describe('esCantidadValida', () => {
  it('acepta vacío o enteros no negativos', () => {
    for (const texto of ['', '0', '6', '120']) expect(esCantidadValida(texto)).toBe(true)
  })

  it('rechaza negativos, decimales y texto', () => {
    for (const texto of ['-1', '1.5', 'abc', '1e3', ' ']) expect(esCantidadValida(texto)).toBe(false)
  })
})

describe('agregarLineas', () => {
  it('suma en una sola línea los pedidos del mismo SKU', () => {
    const resultado = agregarLineas([linea(1, 6)], [linea(1, 6), linea(2, 3)])
    expect(resultado.map((l) => [l.id_sku, l.cantidad])).toEqual([[1, 12], [2, 3]])
  })

  it('ignora las líneas con cantidad cero y no modifica los arreglos recibidos', () => {
    const actuales = [linea(1, 6)]
    const resultado = agregarLineas(actuales, [linea(2, 0)])
    expect(resultado).toHaveLength(1)
    expect(actuales[0].cantidad).toBe(6)
  })
})

describe('resumirPorModelo', () => {
  it('suma los pares de cada modelo en el orden en que aparecen', () => {
    const colorado = { ...linea(3, 6), nombre_modelo: 'Colorado' }
    const resumen = resumirPorModelo([linea(1, 12), colorado, linea(2, 4)])
    expect(resumen).toEqual([
      { nombre_modelo: 'Threshold', pares: 16 },
      { nombre_modelo: 'Colorado', pares: 6 }
    ])
  })
})

describe('lineasIguales', () => {
  it('detecta cambios de SKU o de cantidad sin importar el orden', () => {
    expect(lineasIguales([linea(1, 6), linea(2, 3)], [linea(2, 3), linea(1, 6)])).toBe(true)
    expect(lineasIguales([linea(1, 6)], [linea(1, 7)])).toBe(false)
    expect(lineasIguales([linea(1, 6)], [linea(1, 6), linea(2, 1)])).toBe(false)
    expect(lineasIguales([], [])).toBe(true)
  })
})

describe('quitarLinea y totalPares', () => {
  it('quita la línea indicada', () => {
    expect(quitarLinea([linea(1, 6), linea(2, 3)], 1).map((l) => l.id_sku)).toEqual([2])
  })

  it('suma los pares de todas las líneas', () => {
    expect(totalPares([linea(1, 6), linea(2, 3)])).toBe(9)
    expect(totalPares([])).toBe(0)
  })
})
