import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

it('agrega al borrador con precio de solo lectura y muestra el motivo cuando la línea se bloquea', async () => {
  const borrador = {
    id_orden_venta: 7, cliente: 'Cliente de prueba', segmento: 'B2B',
    fecha_creacion: '2026-11-24T12:00:00Z', lineas: [], subtotal: '0.00', igv: '0.00', total: '0.00',
  }
  const producto = {
    id_sku: 4, codigo_sku: 'THR-NEG-40', id_modelo: 1, modelo: 'Threshold',
    id_color: 1, color: 'Negro', id_talla: 1, talla: '40.0', disponible: 7,
  }
  const api = '/api/ventas/precios'
  const fetchMock = vi.fn(async (ruta: string, config?: RequestInit) => {
    if (ruta === '/api/auth/me') return Response.json({ usuario: {
      id_usuario: 12, nombre: 'Vendedor de prueba', roles: ['Ventas'], debe_cambiar_password: false,
    } })
    if (ruta === api + '/borradores') return Response.json({ borradores: [borrador] })
    if (ruta === api + '/borradores/7') return Response.json({ borrador })
    if (ruta === api + '/productos') return Response.json({ productos: [producto] })
    if (ruta === api + '/borradores/7/lineas' && config?.method === 'POST') {
      const envio = JSON.parse(config.body as string)
      if (envio.cantidad > 7) return Response.json({ mensaje: 'Stock insuficiente. Disponible: 7 pares.' }, { status: 409 })
      expect(envio).toEqual({ id_sku: 4, cantidad: 2 })
      return Response.json({ borrador: {
        ...borrador, subtotal: '520.00', igv: '93.60', total: '613.60',
        lineas: [{ ...producto, cantidad: 2, precio_con_igv: '306.80', importe: '520.00', motivo: null }],
      } }, { status: 201 })
    }
    throw new Error('Ruta inesperada en la prueba: ' + ruta)
  })
  window.history.replaceState(null, '', '/ventas')
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const usuario = userEvent.setup()
  render(<QueryClientProvider client={client}><App /></QueryClientProvider>)

  await usuario.click(await screen.findByRole('link', { name: 'Precios de venta' }))
  await usuario.click(await screen.findByRole('link', { name: 'Abrir venta 7' }))
  await usuario.selectOptions(await screen.findByLabelText('Modelo'), '1')
  await usuario.selectOptions(screen.getByLabelText('Color'), '1')
  await usuario.selectOptions(screen.getByLabelText('Talla'), '4')
  expect(screen.getByText('Disponibles: 7 pares')).toBeInTheDocument()

  const cantidad = screen.getByRole('spinbutton', { name: 'Cantidad' })
  const agregar = screen.getByRole('button', { name: 'Agregar producto' })
  await usuario.clear(cantidad)
  await usuario.type(cantidad, '8')
  await usuario.click(agregar)
  expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente')
  expect(screen.queryByRole('table', { name: 'Productos de la venta' })).toBeNull()

  await usuario.clear(cantidad)
  await usuario.type(cantidad, '2')
  await usuario.click(agregar)
  const tabla = await screen.findByRole('table', { name: 'Productos de la venta' })
  expect(within(tabla).getByText(/306\.80/)).toBeInTheDocument()
  expect(within(tabla).queryByRole('columnheader', { name: /costo|margen/i })).toBeNull()
  expect(within(tabla).queryByRole('spinbutton')).toBeNull()
  expect(screen.getByText(/613\.60/)).toBeInTheDocument()
})
