import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

const productos = [
  { id_sku: 1, codigo_sku: 'THR-NEG-40', modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad_actual: 18, stock_minimo: 5, situacion: 'disponible', catalogo_activo: true },
  { id_sku: 2, codigo_sku: 'THR-MAR-41', modelo: 'Threshold', color: 'Marrón', talla: '41.0', cantidad_actual: 3, stock_minimo: 5, situacion: 'stock_bajo', catalogo_activo: true },
  { id_sku: 3, codigo_sku: 'COL-NEG-42', modelo: 'Colorado', color: 'Negro', talla: '42.0', cantidad_actual: 0, stock_minimo: 4, situacion: 'agotado', catalogo_activo: true },
  { id_sku: 4, codigo_sku: 'HLT-MIE-39', modelo: 'Holt', color: 'Miel', talla: '39.0', cantidad_actual: 14, stock_minimo: null, situacion: 'sin_minimo', catalogo_activo: true },
  { id_sku: 5, codigo_sku: 'EXC-NEG-40', modelo: 'Excavator', color: 'Negro', talla: '40.0', cantidad_actual: 4, stock_minimo: 0, situacion: 'disponible', catalogo_activo: false },
]
const catalogo = {
  modelos: [{ id_modelo: 1, nombre_modelo: 'Threshold' }, { id_modelo: 2, nombre_modelo: 'Colorado' }, { id_modelo: 3, nombre_modelo: 'Holt' }, { id_modelo: 4, nombre_modelo: 'Excavator' }],
  colores: [{ id_color: 1, nombre_color: 'Negro' }, { id_color: 2, nombre_color: 'Marrón' }, { id_color: 3, nombre_color: 'Miel' }],
  tallas: [{ id_talla: 1, numero_talla: '40.0' }, { id_talla: 2, numero_talla: '41.0' }, { id_talla: 3, numero_talla: '42.0' }, { id_talla: 4, numero_talla: '39.0' }],
}
const movimientos = [
  { id_movimiento: '9007199254740993', fecha: '2026-10-24T16:20:00Z', tipo_movimiento: 'ENTRADA_COMPRA', entrada: 12, salida: 0, saldo_posterior: 18, responsable: 'Yefri', documento_origen: { tipo: 'RECEPCION', id: 1, codigo: 'OC-2026-0891' } },
  { id_movimiento: '3', fecha: '2026-10-23T13:45:00Z', tipo_movimiento: 'SALIDA_VENTA', entrada: 0, salida: 4, saldo_posterior: 6, responsable: 'Yefri', documento_origen: { tipo: 'DESPACHO', id: 1, codigo: 'DES-2026-001' } },
  { id_movimiento: '2', fecha: '2026-10-22T14:15:00Z', tipo_movimiento: 'SALIDA_VENTA', entrada: 0, salida: 2, saldo_posterior: 10, responsable: 'Yefri', documento_origen: { tipo: 'DESPACHO', id: 2, codigo: 'DES-2026-002' } },
  { id_movimiento: '1', fecha: '2026-10-20T18:00:00Z', tipo_movimiento: 'APERTURA', entrada: 12, salida: 0, saldo_posterior: 12, responsable: 'Yefri', documento_origen: { tipo: 'APERTURA', id: null, codigo: null } },
]

function abrir({ ruta = '/almacen/kardex', rol = 'Almacen', paginado = false, falloInicial = false } = {}) {
  window.history.replaceState(null, '', ruta)
  let falla = falloInicial
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/auth/me') return Response.json({ usuario: { id_usuario: 1, nombre: 'Yefri', correo: 'qa@example.invalid', roles: [rol], debe_cambiar_password: false } })
    expect(init?.credentials).toBe('include')
    expect(init?.method ?? 'GET').toBe('GET')
    const url = new URL(input, 'http://localhost'), q = url.searchParams
    if (url.pathname === '/api/almacen/catalogo') return Response.json(catalogo)
    if (url.pathname === '/api/almacen/existencias') {
      if (falla) { falla = false; return Response.json({ mensaje: 'No se pudo consultar el inventario.' }, { status: 500 }) }
      let items = paginado ? Array.from({ length: 25 }, (_, i) => ({ ...productos[0], id_sku: i + 1, codigo_sku: `SKU-${String(i + 1).padStart(3, '0')}` })) : productos
      if (q.get('catalogo') !== 'todos') items = items.filter(p => p.catalogo_activo === (q.get('catalogo') !== 'inactivos'))
      if (q.get('situacion') && q.get('situacion') !== 'todos') items = items.filter(p => p.situacion === q.get('situacion'))
      if (q.get('id_color')) items = items.filter(p => p.color === catalogo.colores.find(c => String(c.id_color) === q.get('id_color'))?.nombre_color)
      if (q.get('q')) items = items.filter(p => (p.codigo_sku + ' ' + p.modelo).toLowerCase().includes(q.get('q')!.toLowerCase()))
      const pagina = Number(q.get('pagina') ?? 1), tamano = Number(q.get('tamano') ?? 20)
      return Response.json({ items: items.slice((pagina - 1) * tamano, pagina * tamano), pagina, tamano, total: items.length })
    }
    if (url.pathname.startsWith('/api/almacen/kardex/')) {
      const producto = productos.find(p => String(p.id_sku) === url.pathname.split('/').at(-1))
      if (!producto) return Response.json({ mensaje: 'El SKU indicado no existe.' }, { status: 404 })
      let items = producto.id_sku === 1 ? movimientos : []
      if (q.get('tipo_movimiento') && q.get('tipo_movimiento') !== 'todos') items = items.filter(m => m.tipo_movimiento === q.get('tipo_movimiento'))
      return Response.json({ producto, cantidad_actual: producto.cantidad_actual, items, pagina: 1, tamano: 20, total: items.length })
    }
    if (url.pathname === '/api/modelos') return Response.json({ modelos: [] })
    if (url.pathname === '/api/productos-sku') return Response.json({ productos: [] })
    if (url.pathname === '/api/almacen/pendientes') return Response.json([])
    if (url.pathname === '/api/almacen/pendientes-despacho') return Response.json({ despachos: [] })
    throw new Error('Ruta inesperada: ' + input)
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><App /></QueryClientProvider>)
  return fetchMock
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null }) })

it('muestra las cuatro situaciones físicas sin costos ni acciones de escritura', async () => {
  abrir()
  const tabla = await screen.findByRole('table', { name: 'Existencias por SKU' })
  await within(tabla).findByRole('rowheader', { name: 'THR-NEG-40' })
  expect(within(tabla).getAllByRole('columnheader').map(c => c.textContent)).toEqual(['Código SKU','Modelo','Color','Talla','Stock actual','Stock mínimo','Situación','Catálogo','Acción'])
  for (const [sku, situacion] of [['THR-NEG-40','Disponible'],['THR-MAR-41','Stock bajo'],['COL-NEG-42','Agotado'],['HLT-MIE-39','Sin mínimo definido']]) {
    const fila = within(tabla).getByRole('row', { name: new RegExp(sku) })
    expect(within(fila).getByText(situacion)).toBeInTheDocument()
  }
  expect(screen.queryByRole('button', { name: /Guardar|Modificar|Eliminar|Configurar/i })).not.toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Navegación de operaciones' })
  expect(within(nav).getByRole('link', { name: 'Kardex' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Pendientes de recepción' })).not.toHaveAttribute('aria-current')
  expect(within(nav).getByRole('link', { name: 'Pendientes de despacho' })).not.toHaveAttribute('aria-current')
})

it('permite elegir color primero, filtrar alertas, volver del detalle y limpiar filtros', async () => {
  const usuario = userEvent.setup(), fetchMock = abrir()
  await screen.findByRole('rowheader', { name: 'THR-NEG-40' })
  await usuario.selectOptions(screen.getByRole('combobox', { name: 'Color' }), '2')
  await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'THR-NEG-40' })).not.toBeInTheDocument())
  expect(fetchMock.mock.calls.some(([url]) => url.includes('id_color=2'))).toBe(true)
  const grupo = screen.getByRole('group', { name: 'Situación de stock' })
  await usuario.click(within(grupo).getByRole('button', { name: 'Stock bajo' }))
  await usuario.click(await screen.findByRole('link', { name: 'Ver Kardex de THR-MAR-41' }))
  expect(await screen.findByRole('heading', { name: 'Kardex físico del producto' })).toBeInTheDocument()
  await screen.findByText('No hay movimientos para esta consulta.')
  await usuario.click(screen.getByRole('link', { name: 'Volver a existencias' }))
  expect(within(screen.getByRole('group', { name: 'Situación de stock' })).getByRole('button', { name: 'Stock bajo' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('combobox', { name: 'Color' })).toHaveValue('2')
  await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(await screen.findByRole('rowheader', { name: 'THR-NEG-40' })).toBeInTheDocument()
})

it('busca por SKU, consulta inactivos y muestra resultados vacíos', async () => {
  const usuario = userEvent.setup()
  abrir()
  await screen.findByRole('rowheader', { name: 'THR-NEG-40' })
  await usuario.type(screen.getByLabelText('Búsqueda rápida'), 'COL-NEG')
  await usuario.click(screen.getByRole('button', { name: 'Buscar productos' }))
  await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'THR-NEG-40' })).not.toBeInTheDocument())
  expect(screen.getByRole('rowheader', { name: 'COL-NEG-42' })).toBeInTheDocument()
  await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  await usuario.click(within(screen.getByRole('group', { name: 'Estado del catálogo' })).getByRole('button', { name: 'Inactivos' }))
  expect(await screen.findByRole('rowheader', { name: 'EXC-NEG-40' })).toBeInTheDocument()
  await usuario.type(screen.getByLabelText('Búsqueda rápida'), 'no-existe')
  await usuario.click(screen.getByRole('button', { name: 'Buscar productos' }))
  expect(await screen.findByText('No hay productos que coincidan con los filtros.')).toBeInTheDocument()
})

it('pagina las existencias sin perder el total ni mostrar filas de otra página', async () => {
  const usuario = userEvent.setup()
  abrir({ paginado: true })
  await screen.findByRole('rowheader', { name: 'SKU-001' })
  await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(await screen.findByRole('rowheader', { name: 'SKU-021' })).toBeInTheDocument()
  expect(screen.queryByRole('rowheader', { name: 'SKU-001' })).not.toBeInTheDocument()
  expect(screen.getByText('Mostrando 21 a 25 de 25 productos')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
})

it('consulta el historial, conserva saldos, filtra movimientos y bloquea rangos invertidos', async () => {
  const usuario = userEvent.setup(), fetchMock = abrir({ ruta: '/almacen/kardex/1' })
  const tabla = await screen.findByRole('table', { name: 'Movimientos físicos del SKU' })
  await within(tabla).findByText('OC-2026-0891')
  expect(within(tabla).getByText('DES-2026-001')).toBeInTheDocument()
  expect(within(tabla).getByText('10 pares')).toBeInTheDocument()
  await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo de movimiento' }), 'SALIDA_VENTA')
  await usuario.click(screen.getByRole('button', { name: 'Consultar' }))
  await waitFor(() => expect(within(tabla).queryByText('OC-2026-0891')).not.toBeInTheDocument())
  expect(within(tabla).getByText('6 pares')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Producto consultado' })).getByText('18', { exact: false })).toBeInTheDocument()
  const antes = fetchMock.mock.calls.length
  fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-11-21' } })
  fireEvent.change(screen.getByLabelText('Fecha hasta'), { target: { value: '2026-11-01' } })
  await usuario.click(screen.getByRole('button', { name: 'Consultar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('La fecha desde no puede ser posterior')
  expect(fetchMock.mock.calls.length).toBe(antes)
})

it('permite reintentar un fallo de API y recuperar la tabla', async () => {
  const usuario = userEvent.setup()
  abrir({ falloInicial: true })
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el inventario.')
  await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('rowheader', { name: 'THR-NEG-40' })).toBeInTheDocument()
})

it('excluye Almacén de Administración y bloquea Kardex para otros roles', async () => {
  const adminFetch = abrir({ rol: 'Administrador' })
  const nav = await screen.findByRole('navigation', { name: 'Navegación administrativa' })
  await screen.findByRole('heading', { name: 'Resumen del catálogo' })
  expect(within(nav).queryByRole('link', { name: 'Kardex' })).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Pendientes de recepción' })).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Pendientes de despacho' })).not.toBeInTheDocument()
  expect(adminFetch.mock.calls.some(([url]) => url.startsWith('/api/almacen'))).toBe(false)
  cleanup(); useAuthStore.setState({ user: null })
  const fetchMock = abrir({ rol: 'Ventas' })
  expect(await screen.findByRole('heading', { name: 'Nueva venta' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => url.startsWith('/api/almacen'))).toBe(false)
})
