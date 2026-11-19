import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { LineaPedida } from '../services/lineaCompraService'
import SeleccionCompraPage from './SeleccionCompraPage'

function respuesta(datos: unknown, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const detalle = (id_sku: number, numero_talla: string, cantidad: number) => ({
  id_sku, codigo_sku: `SKU-${id_sku}`, nombre_modelo: 'Threshold', nombre_color: 'Negro', numero_talla, cantidad
})

interface Opciones {
  estado?: string
  lineasGuardadas?: ReturnType<typeof detalle>[]
  fallaAlGuardar?: boolean
  costoAlGuardar?: number
}

function simularApi({ estado = 'BORRADOR', lineasGuardadas = [], fallaAlGuardar = false, costoAlGuardar }: Opciones = {}) {
  const costos = new Map([[1, 180]])

  return vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const ruta = String(entrada)
    if (ruta === '/api/lineas-compra/modelos') {
      return respuesta({ modelos: [{ id_modelo: 1, nombre_modelo: 'Threshold' }] })
    }
    if (ruta === '/api/lineas-compra/modelos/1/colores') {
      return respuesta({ colores: [{ id_color: 1, nombre_color: 'Negro' }] })
    }
    if (ruta === '/api/lineas-compra/modelos/1/colores/1/tallas') {
      return respuesta({ tallas: [
        { id_sku: 1, id_talla: 2, numero_talla: '40.0' },
        { id_sku: 3, id_talla: 3, numero_talla: '41.0' }
      ] })
    }
    if (ruta === '/api/ordenes-compra/7/detalles' && !opciones?.method) {
      const total = lineasGuardadas.reduce((s, l) => s + l.cantidad, 0)
      return respuesta({ estado, lineas: lineasGuardadas, total_pares: total, pares_por_modelo: [] })
    }
    if (ruta === '/api/ordenes-compra/7/detalles' && opciones?.method === 'POST') {
      if (fallaAlGuardar) return respuesta({ mensaje: 'La orden ya no es un borrador.' }, 409)
      if (costoAlGuardar !== undefined) costos.set(1, costoAlGuardar)
      const { lineas } = JSON.parse(String(opciones.body)) as { lineas: { id_sku: number; cantidad: number }[] }
      const acumuladas = new Map(lineasGuardadas.map((l) => [l.id_sku, l]))
      for (const l of lineas) acumuladas.set(l.id_sku, detalle(l.id_sku, l.id_sku === 1 ? '40.0' : '41.0', (acumuladas.get(l.id_sku)?.cantidad ?? 0) + l.cantidad))
      const guardadas = [...acumuladas.values()]
      return respuesta({ mensaje: 'Líneas guardadas correctamente.', lineas: guardadas, total_pares: guardadas.reduce((s, l) => s + l.cantidad, 0), pares_por_modelo: [] })
    }
    if (ruta === '/api/compras/ordenes/7/resumen-costos' && opciones?.method === 'POST') {
      const { lineas } = JSON.parse(String(opciones.body)) as { lineas: LineaPedida[] }
      const calculadas = lineas.map(({ id_sku, cantidad }) => {
        const costo = costos.get(id_sku)
        return { idSku: id_sku, cantidad, costoUnitario: costo?.toFixed(2) ?? null, importe: costo === undefined ? null : (costo * cantidad).toFixed(2) }
      })
      const subtotal = calculadas.reduce((suma, linea) => suma + Number(linea.importe), 0)
      const completo = calculadas.every((linea) => linea.importe !== null)
      return respuesta({
        lineas: calculadas,
        subtotalConocido: subtotal.toFixed(2),
        total: completo ? subtotal.toFixed(2) : null,
      })
    }
    if (ruta === '/api/compras/costos-faltantes/3' && opciones?.method === 'POST') {
      const { costoUnitario } = JSON.parse(String(opciones.body)) as { costoUnitario: string }
      costos.set(3, Number(costoUnitario))
      return respuesta({ mensaje: 'Costo registrado.' }, 201)
    }
    throw new Error(`Ruta inesperada: ${ruta}`)
  })
}

function mostrarPagina(idOrden = '7') {
  const cliente = new QueryClient()
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[`/compras/borrador/${idOrden}/productos`]}>
        <Routes>
          <Route path="/compras/borrador/:idOrden/productos" element={<SeleccionCompraPage />} />
          <Route path="/compras" element={<p>Bandeja</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

async function elegirModeloYColor() {
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: '1' } })
  await screen.findByRole('option', { name: 'Negro' })
  fireEvent.change(screen.getByLabelText('Color'), { target: { value: '1' } })
  await screen.findByLabelText('Talla 40')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Selección de modelos y tallas dentro de un borrador', () => {
  it('muestra la cuadrícula con las tallas sin decimales y suma el total', async () => {
    vi.stubGlobal('fetch', simularApi())
    mostrarPagina()
    await elegirModeloYColor()

    fireEvent.change(screen.getByLabelText('Talla 40'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Talla 41'), { target: { value: '4' } })

    expect(screen.getByText('Total de la cuadrícula: 10 pares')).toBeInTheDocument()
  })

  it('suma en una sola línea los pedidos repetidos y muestra los pares por modelo', async () => {
    vi.stubGlobal('fetch', simularApi())
    mostrarPagina()
    await elegirModeloYColor()

    for (let i = 0; i < 2; i += 1) {
      fireEvent.change(screen.getByLabelText('Talla 40'), { target: { value: '6' } })
      fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))
    }

    expect(screen.getByText('Total general: 12 pares en 1 líneas')).toBeInTheDocument()
    expect(screen.getByText('Threshold: 12 pares')).toBeInTheDocument()
  })

  it('rechaza cantidades inválidas y no agrega líneas', async () => {
    vi.stubGlobal('fetch', simularApi())
    mostrarPagina()
    await elegirModeloYColor()

    fireEvent.change(screen.getByLabelText('Talla 40'), { target: { value: '-3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('números enteros')
    expect(screen.getByText('Aún no agregaste líneas.')).toBeInTheDocument()
  })

  it('exige al menos una cantidad mayor que cero', async () => {
    vi.stubGlobal('fetch', simularApi())
    mostrarPagina()
    await elegirModeloYColor()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos una talla')
  })

  it('carga las líneas guardadas, avisa de cambios sin guardar y guarda con la API', async () => {
    const fetchMock = simularApi({ lineasGuardadas: [detalle(1, '40.0', 12)] })
    vi.stubGlobal('fetch', fetchMock)
    mostrarPagina()

    expect(await screen.findByText('Total general: 12 pares en 1 líneas')).toBeInTheDocument()
    expect(screen.queryByText('Tienes cambios sin guardar.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar líneas' })).toBeDisabled()

    await elegirModeloYColor()
    fireEvent.change(screen.getByLabelText('Talla 41'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))

    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar líneas' }))

    expect(await screen.findByText(/Líneas guardadas correctamente.*16 pares en 2 líneas/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/ordenes-compra/7/detalles', expect.objectContaining({ method: 'POST', credentials: 'include' }))
    await waitFor(() => expect(screen.queryByText('Tienes cambios sin guardar.')).not.toBeInTheDocument())
  })

  it('consulta el costo vigente otra vez al guardar líneas ya calculadas', async () => {
    vi.stubGlobal('fetch', simularApi({ costoAlGuardar: 200 }))
    mostrarPagina()
    await elegirModeloYColor()

    fireEvent.change(screen.getByLabelText('Talla 40'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))
    await waitFor(() => expect(screen.getByText('Total de adquisición').nextElementSibling).toHaveTextContent('S/ 2160.00'))

    fireEvent.click(screen.getByRole('button', { name: 'Guardar líneas' }))
    await waitFor(() => expect(screen.getByText('Total de adquisición').nextElementSibling).toHaveTextContent('S/ 2400.00'))
  })

  it('recalcula el borrador al agregar pares y registrar el costo faltante', async () => {
    const fetchMock = simularApi({ lineasGuardadas: [detalle(1, '40.0', 12)] })
    vi.stubGlobal('fetch', fetchMock)
    mostrarPagina()

    const resumen = await screen.findByRole('region', { name: 'Resumen de costos de adquisición' })
    expect(within(resumen).getByText('Total de adquisición').nextElementSibling).toHaveTextContent('S/ 2160.00')

    await elegirModeloYColor()
    fireEvent.change(screen.getByLabelText('Talla 41'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))

    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    const costo = screen.getByLabelText('Costo en soles para el SKU 3')
    fireEvent.change(costo, { target: { value: '190,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar costo' }))

    await waitFor(() => expect(screen.getByText('Total de adquisición').nextElementSibling).toHaveTextContent('S/ 2350.00'))
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/compras/costos-faltantes/3', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ costoUnitario: '190.00' }),
    }))
  })

  it('muestra el error del servidor cuando el borrador ya no se puede modificar', async () => {
    vi.stubGlobal('fetch', simularApi({ fallaAlGuardar: true }))
    mostrarPagina()
    await elegirModeloYColor()

    fireEvent.change(screen.getByLabelText('Talla 40'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar líneas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya no es un borrador')
  })

  it('no permite editar una orden que no está en Borrador', async () => {
    vi.stubGlobal('fetch', simularApi({ estado: 'EMITIDA', lineasGuardadas: [detalle(1, '40.0', 12)] }))
    mostrarPagina()

    expect(await screen.findByText(/estado EMITIDA/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Modelo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar líneas' })).not.toBeInTheDocument()
  })

  it('reserva quitar líneas persistidas para HU16', async () => {
    vi.stubGlobal('fetch', simularApi({ lineasGuardadas: [detalle(1, '40.0', 12)] }))
    mostrarPagina()
    expect(await screen.findByRole('button', { name: /Quitar talla 40/ })).toBeDisabled()
    expect(screen.queryByText('Tienes cambios sin guardar.')).not.toBeInTheDocument()
  })

  it('rechaza un identificador de borrador inválido sin llamar a la API', async () => {
    const fetchMock = simularApi()
    vi.stubGlobal('fetch', fetchMock)
    mostrarPagina('abc')

    expect(await screen.findByRole('alert')).toHaveTextContent('no es válido')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
