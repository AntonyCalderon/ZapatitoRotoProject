import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

function abrir(rol: string, ruta: string) {
  window.history.replaceState(null, '', ruta)
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/auth/me') return Response.json({ usuario: {
      id_usuario: 1, nombre: 'Ana', correo: 'ana@example.com', roles: [rol], debe_cambiar_password: false,
    } })
    if (url === '/api/almacen/pendientes') return Response.json([
      { id_orden_compra: 9, codigo: 'OC-2026-009', proveedor: 'Proveedor de prueba', pares: '12' },
    ])
    if (url === '/api/almacen/pendientes/9') return Response.json({
      codigo: 'OC-2026-009', proveedor: 'Proveedor de prueba',
      lineas: [{ id_detalle_compra: 1, id_sku: 1, codigo_sku: 'THR-NEG-40', modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 12 }],
    })
    if (url === '/api/almacen/pendientes-despacho') return Response.json({ despachos: [] })
    if (url.startsWith('/api/ordenes-compra')) return Response.json({ borradores: [] })
    if (url.startsWith('/api/modelos')) return Response.json({ modelos: [] })
    if (url.startsWith('/api/productos-sku')) return Response.json({ productos: [] })
    throw new Error('Ruta inesperada: ' + url)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  return fetchMock
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null }) })

it('permite a Almacén navegar entre recepción y despacho con botones separados', async () => {
  const usuario = userEvent.setup()
  abrir('Almacen', '/inicio')
  await screen.findByRole('rowheader', { name: 'OC-2026-009' })
  const nav = screen.getByRole('navigation', { name: 'Navegación de operaciones' })
  const recepcion = within(nav).getByRole('link', { name: 'Pendientes de recepción' })
  const despacho = within(nav).getByRole('link', { name: 'Pendientes de despacho' })
  expect(recepcion).toHaveAttribute('aria-current', 'page')
  expect(despacho).not.toHaveAttribute('aria-current')
  await usuario.click(screen.getByRole('link', { name: 'Abrir recepción OC-2026-009' }))
  expect(await screen.findByRole('row', { name: /THR-NEG-40 Threshold Negro 40 12/ })).toBeInTheDocument()
  await usuario.click(despacho)
  expect(await screen.findByRole('heading', { name: 'Pendientes de despacho' })).toBeInTheDocument()
  expect(despacho).toHaveAttribute('aria-current', 'page')
  expect(recepcion).not.toHaveAttribute('aria-current')
  expect(screen.queryByRole('link', { name: 'Gestión de Usuarios' })).not.toBeInTheDocument()
  await usuario.click(recepcion)
  expect(await screen.findByRole('rowheader', { name: 'OC-2026-009' })).toBeInTheDocument()
})

it('mantiene Administración separada y bloquea las rutas de Almacén sin su rol', async () => {
  const fetchMock = abrir('Administrador', '/almacen/pendientes/9')
  const nav = await screen.findByRole('navigation', { name: 'Navegación administrativa' })
  await screen.findByRole('heading', { name: 'Resumen del catálogo' })
  expect(within(nav).queryByRole('link', { name: 'Pendientes de recepción' })).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Pendientes de despacho' })).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Kardex' })).not.toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: 'Costos base' })).toHaveAttribute('href', '/costos-base')
  expect(within(nav).getByRole('link', { name: 'Márgenes de utilidad' })).toHaveAttribute('href', '/margenes')
  expect(fetchMock.mock.calls.some(([url]) => url.startsWith('/api/almacen'))).toBe(false)
})

it('no permite que Compras consulte recepción al intentar abrir la URL', async () => {
  const fetchMock = abrir('Compras', '/almacen/pendientes/9')
  // La redirección de Compras consulta sus propios borradores; no debe consultar recepción.
  await screen.findByRole('heading', { name: 'Solicitudes de compra' })
  expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('/api/almacen/pendientes/9')
})
