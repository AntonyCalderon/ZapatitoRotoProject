import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import ProductosSkuPage from './ProductosSkuPage'

const codigo = 'SKU-123e4567-e89b-42d3-a456-426614174000'

function respuesta(datos: unknown, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Gestión de Productos SKU', () => {
  it('registra una sola variante y muestra el código generado por la API', async () => {
    let registrado = false
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
      const ruta = String(entrada)
      if (ruta.endsWith('/opciones')) {
        return respuesta({
          modelos: [{ id_modelo: 1, nombre_modelo: 'Threshold' }],
          tallas: [{ id_talla: 2, numero_talla: '40.0' }],
          colores: [{ id_color: 1, nombre_color: 'Negro' }]
        })
      }
      if (ruta === '/api/productos-sku' && opciones?.method === 'POST') {
        expect(JSON.parse(String(opciones.body))).toEqual({ id_modelo: 1, id_talla: 2, id_color: 1 })
        registrado = true
        return respuesta({
          mensaje: 'Producto SKU registrado correctamente.',
          producto: { id_sku: 4, codigo_sku: codigo, activo: true }
        }, 201)
      }
      if (ruta.startsWith('/api/productos-sku?')) {
        return respuesta({ productos: registrado ? [{
          id_sku: 4, codigo_sku: codigo, id_modelo: 1, id_talla: 2, id_color: 1,
          nombre_modelo: 'Threshold', numero_talla: '40.0', nombre_color: 'Negro',
          activo: true, modelo_activo: true, talla_activa: true, color_activo: true
        }] : [] })
      }
      throw new Error(`Ruta inesperada: ${ruta}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MemoryRouter><ProductosSkuPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Modelo *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Talla *'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Color *'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto SKU' }))

    expect(await screen.findByRole('status')).toHaveTextContent(codigo)
    await waitFor(() => expect(screen.getByText(codigo)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/productos-sku', expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })
})
