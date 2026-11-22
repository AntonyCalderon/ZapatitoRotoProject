import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

const ruta = '/almacen/pendientes-despacho'
const antiguo = {
  id_orden_despacho: 2, codigo: 'DES-002', fecha_emision: '2026-11-20T14:00:00Z',
  cliente: 'Cliente de prueba', direccion: 'Av. de prueba 123',
  tipo_comprobante: 'Boleta', serie_comprobante: 'B001', numero_comprobante: '0002',
}
const reciente = { ...antiguo, id_orden_despacho: 3, codigo: 'DES-003', fecha_emision: '2026-11-20T16:00:00Z' }
const productos = [{ id_sku: 1, modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 2 }]

function abrir(rol: string, pagina = ruta) {
  window.history.replaceState(null, '', pagina)
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/auth/me') {
      return Response.json({ usuario: {
        id_usuario: 1, nombre: 'Usuario de prueba', correo: 'usuario@example.com',
        roles: [rol], debe_cambiar_password: false,
      } })
    }
    if (url === '/api' + ruta) return Response.json({ despachos: [antiguo, reciente] })
    if (url === '/api' + ruta + '/2') return Response.json({ despacho: { ...antiguo, productos } })
    throw new Error('Ruta inesperada durante la prueba ' + url)
  })
  vi.stubGlobal('fetch', fetchMock)
  const cliente = new QueryClient()
  render(<QueryClientProvider client={cliente}><App /></QueryClientProvider>)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

it('muestra la cola y permite abrir el detalle de un despacho desde Almacén', async () => {
  const usuario = userEvent.setup()
  abrir('Almacen', '/inicio')
  await usuario.click(await screen.findByRole('link', { name: 'Pendientes de despacho' }))

  const cola = await screen.findByRole('table', { name: 'Órdenes pendientes de despacho' })
  expect(within(cola).getAllByRole('rowheader').map(celda => celda.textContent)).toEqual(['DES-002', 'DES-003'])
  await usuario.click(within(cola).getByRole('link', { name: 'Consultar despacho DES-002' }))
  expect(await screen.findByText('Av. de prueba 123')).toBeInTheDocument()
  expect(screen.getByText('Boleta B001-0002')).toBeInTheDocument()

  const detalle = screen.getByRole('table', { name: 'Productos del despacho' })
  expect(within(detalle).getAllByRole('columnheader').map(celda => celda.textContent))
    .toEqual(['Modelo', 'Color', 'Talla', 'Cantidad'])
  expect(within(detalle).getByRole('row', { name: 'Threshold Negro 40 2' })).toBeInTheDocument()
})

it('mantiene el menú administrativo al consultar y bloquea la ruta para Ventas', async () => {
  abrir('Administrador', ruta + '/2')
  expect(await screen.findByRole('navigation', { name: 'Navegación administrativa' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pendientes de despacho' })).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByRole('heading', { name: 'Despacho DES-002' })).toBeInTheDocument()

  cleanup()
  useAuthStore.setState({ user: null })
  const fetchMock = abrir('Ventas', ruta + '/2')
  expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/me'])
})
