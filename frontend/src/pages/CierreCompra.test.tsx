import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

const completa = { id_orden_compra: 28, codigo: 'OC-2026-002', estado: 'EMITIDA', proveedor: 'Proveedor QA', situacion_logistica: 'RECIBIDA', lote_verificado: true, usuario_almacen: 'Yefri', fecha_recepcion: '2026-11-22T15:00:00Z', usuario_confirma: 'Paolo', fecha_confirmacion: '2026-11-22T16:00:00Z' }
const pendiente = { ...completa, id_orden_compra: 29, codigo: 'OC-2026-003', fecha_confirmacion: null, usuario_confirma: null }
function abrir(ruta = '/compras', fallo = false) {
  window.history.replaceState(null, '', ruta)
  let cerrada = false
  const historica = { ...completa, estado: 'CERRADO', usuario_cierre: 'Paolo', fecha_cierre: '2026-11-22T17:00:00Z' }
  const peticion = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return Response.json({ usuario: { id_usuario: 1, nombre: 'Paolo', correo: 'qa@example.invalid', roles: ['Compras'], debe_cambiar_password: false } })
    if (url === '/api/ordenes-compra?estado=BORRADOR') return Response.json({ borradores: [] })
    if (url === '/api/ordenes-compra/emitidas') return Response.json(cerrada ? [pendiente] : [completa, pendiente])
    if (url === '/api/ordenes-compra/historico') return Response.json(cerrada ? [historica] : [])
    if (url === '/api/ordenes-compra/historico/28') return Response.json({ orden: { ...historica, total: '130', documento_emitido: { proveedor: { razon_social: 'Proveedor QA' }, pares: 13, lineas: [{ codigo_sku: 'THR-NEG-40', nombre_modelo: 'Threshold', nombre_color: 'Negro', numero_talla: 40, cantidad: 13 }] } } })
    if (url === '/api/ordenes-compra/28/cierre' && init?.method === 'POST') {
      if (fallo) { fallo = false; return Response.json({ mensaje: 'No se pudo cerrar la orden.' }, { status: 500 }) }
      cerrada = true
      return Response.json({ mensaje: 'Orden cerrada y archivada.', orden: historica, repetida: false })
    }
    throw Error('Petición inesperada: ' + url)
  })
  vi.stubGlobal('fetch', peticion)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  return peticion
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null }) })

it('separa borradores, emitidas e histórico con una sola opción activa en el sidebar', async () => {
  const user = userEvent.setup(), peticion = abrir()
  await screen.findByRole('heading', { name: 'Bandeja de borradores 0' })
  const nav = screen.getByRole('navigation', { name: 'Navegación de operaciones' })
  expect(within(nav).getByRole('link', { name: 'Compras' })).toHaveAttribute('aria-current', 'page')
  expect(peticion.mock.calls.some(([url]) => url === '/api/ordenes-compra/emitidas')).toBe(false)
  await user.click(within(nav).getByRole('link', { name: 'Órdenes emitidas' }))
  await screen.findByRole('table', { name: 'Órdenes emitidas y recepción' })
  expect(within(nav).getByRole('link', { name: 'Compras' })).not.toHaveAttribute('aria-current')
  expect(within(nav).getByRole('link', { name: 'Órdenes emitidas' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('heading', { name: /Bandeja de borradores/ })).not.toBeInTheDocument()
  await user.click(within(nav).getByRole('link', { name: 'Histórico' }))
  expect(await screen.findByText('Todavía no hay compras cerradas.')).toBeInTheDocument()
})

it('confirma el cierre, mueve la orden al histórico y conserva detalle, auditoría y PDF', async () => {
  const user = userEvent.setup(), peticion = abrir('/compras/emitidas')
  expect(await screen.findByRole('button', { name: 'Cerrar orden OC-2026-003' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Cerrar orden OC-2026-002' }))
  let dialogo = screen.getByRole('dialog', { name: 'Cerrar OC-2026-002' })
  await user.click(within(dialogo).getByRole('button', { name: 'Volver' }))
  expect(peticion.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Cerrar orden OC-2026-002' }))
  dialogo = screen.getByRole('dialog', { name: 'Cerrar OC-2026-002' })
  await user.click(within(dialogo).getByRole('button', { name: 'Cerrar y archivar' }))
  expect(await screen.findByRole('table', { name: 'Histórico de compras finalizadas' })).toHaveTextContent('OC-2026-002')
  expect(screen.getByText('Cerrado')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/compras/historico')
  expect(peticion.mock.calls.filter(([, init]) => init?.method === 'POST')).toEqual([['/api/ordenes-compra/28/cierre', { method: 'POST', credentials: 'include' }]])
  await user.click(screen.getByRole('link', { name: 'Ver detalle' }))
  expect(await screen.findByRole('table', { name: 'Productos de la compra cerrada' })).toHaveTextContent('THR-NEG-40')
  expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('href', '/api/ordenes-compra/28/pdf')
  await user.click(screen.getByRole('link', { name: 'Órdenes emitidas' }))
  await waitFor(() => expect(screen.queryByText('OC-2026-002')).not.toBeInTheDocument())
  expect(await screen.findByText('OC-2026-003')).toBeInTheDocument()
})

it('mantiene la orden ante un fallo del cierre y permite reintentar', async () => {
  const user = userEvent.setup(), peticion = abrir('/compras/emitidas', true)
  await user.click(await screen.findByRole('button', { name: 'Cerrar orden OC-2026-002' }))
  await user.click(screen.getByRole('button', { name: 'Cerrar y archivar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la orden.')
  expect(window.location.pathname).toBe('/compras/emitidas')
  expect(screen.getByRole('button', { name: 'Cerrar y archivar' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Cerrar y archivar' }))
  await screen.findByRole('table', { name: 'Histórico de compras finalizadas' })
  expect(peticion.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2)
})
