import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CompraEditorPage from './CompraEditorPage'
import ComprasBorradoresPage from './ComprasBorradoresPage'
import OperacionLayout from '../components/OperacionLayout'
import { useAuthStore } from '../store/authStore'

const orden = { id_orden_compra: 7, estado: 'BORRADOR', id_proveedor: null, proveedor: null, id_usuario_creador: 1, creador: 'Ana Compras', fecha_creacion: '2026-11-19T15:00:00Z', observacion: null, codigo: null, subtotal: null, total: null }
const linea = { id_sku: 1, codigo_sku: 'CAT-NEG-40', nombre_modelo: 'Threshold', nombre_color: 'Negro', numero_talla: '40.0', cantidad: 2, costo_unitario: null, importe: null }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
function api({ falloNotas = false, falloCarga = false } = {}) {
  let actual = { ...orden }
  let lineas: typeof linea[] = []
  let fallo = falloNotas
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url)
    if (path === '/api/ordenes-compra?estado=BORRADOR') return json({ borradores: [actual] })
    if (path === '/api/ordenes-compra' && init?.method === 'POST') return json({ orden: actual }, 201)
    if (path === '/api/ordenes-compra/7' && init?.method === 'PATCH') {
      if (fallo) { fallo = false; return json({ mensaje: 'Error temporal de observaciones.' }, 500) }
      actual = { ...actual, ...JSON.parse(String(init.body)) }; return json({ orden: actual })
    }
    if (path === '/api/ordenes-compra/7') return falloCarga ? json({ mensaje: 'No se pudo abrir.' }, 500) : json({ orden: actual })
    if (path === '/api/ordenes-compra/7/detalles' && init?.method === 'POST') {
      const data = JSON.parse(String(init.body)); lineas = [{ ...linea, cantidad: data.lineas[0].cantidad }]
      return json({ lineas, total_pares: lineas[0].cantidad, pares_por_modelo: [] }, 201)
    }
    if (path === '/api/ordenes-compra/7/detalles') return json({ estado: 'BORRADOR', lineas, total_pares: 0, pares_por_modelo: [] })
    if (path === '/api/lineas-compra/catalogo') return json({
      modelos:[{id_modelo:1,nombre_modelo:'Threshold'}],colores:[{id_color:1,nombre_color:'Negro'}],
      tallas:[{id_talla:1,numero_talla:'40.0'}],
      variantes:[{...linea,id_modelo:1,id_color:1,id_talla:1,costo_base_vigente:'200.00'}]
    })
    if (path === '/api/lineas-compra/modelos') return json({ modelos: [{ id_modelo: 1, nombre_modelo: 'Threshold' }] })
    if (path === '/api/lineas-compra/modelos/1/colores') return json({ colores: [{ id_color: 1, nombre_color: 'Negro' }] })
    if (path === '/api/lineas-compra/modelos/1/colores/1/tallas') return json({ tallas: [{ id_sku: 1, id_talla: 1, numero_talla: '40.0' }] })
    throw new Error(`Ruta inesperada ${path}`)
  })
}
function mostrar(path = '/compras/borrador/7') {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<OperacionLayout />}><Route path="/compras" element={<ComprasBorradoresPage />} /><Route path="/compras/borrador/:idOrden" element={<CompraEditorPage />} /></Route></Routes></MemoryRouter>)
}
async function seleccionar() {
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar productos' }))
  await screen.findByRole('option', { name: 'Negro' })
  fireEvent.change(screen.getByLabelText('Color de la fila 1'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Talla de la fila 1'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Modelo de la fila 1'), { target: { value: 'Threshold' } })
  fireEvent.change(screen.getByLabelText('Cantidad de la fila 1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Agregar a la solicitud' }))
}
beforeEach(() => { useAuthStore.setState({ user: { id_usuario: 1, nombre: 'Ana Compras', correo: 'ana@example.com', roles: ['Compras'], debe_cambiar_password: false } }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null }) })
describe('Flujo integrado de Compras', () => {
  it('muestra datos reales y columnas acordadas sin acciones de historias posteriores', async () => {
    vi.stubGlobal('fetch', api()); mostrar()
    expect(await screen.findByText('Datos de la solicitud')).toBeInTheDocument()
    for (const name of ['Modelo', 'Color', 'Talla', 'Cantidad', 'Costo unitario', 'Subtotal']) expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    expect(screen.queryByText(/IGV/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Emitir|Cancelar borrador/ })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).not.toHaveTextContent('Modelos')
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
  })
  it('selecciona y guarda productos desde el editor y persiste observaciones con PATCH', async () => {
    const fetchMock = api(); vi.stubGlobal('fetch', fetchMock); mostrar(); await seleccionar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Threshold')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /Observaciones/ }), { target: { value: 'Pedido prioritario' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText('Borrador guardado correctamente.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/ordenes-compra/7/detalles', expect.objectContaining({ method: 'POST', body: JSON.stringify({ lineas: [{ id_sku: 1, cantidad: 2 }] }) }))
    expect(fetchMock).toHaveBeenCalledWith('/api/ordenes-compra/7', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ observacion: 'Pedido prioritario' }) }))
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
  })
  it('no duplica productos al reintentar si fallan las observaciones después del POST', async () => {
    const fetchMock = api({ falloNotas: true }); vi.stubGlobal('fetch', fetchMock); mostrar(); await seleccionar()
    fireEvent.change(screen.getByRole('textbox', { name: /Observaciones/ }), { target: { value: 'Nota' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Los productos se guardaron')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText('Borrador guardado correctamente.')
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/detalles') && init?.method === 'POST')).toHaveLength(1)
  })
  it('crea desde la bandeja y abre el editor sin pasos intermedios', async () => {
    vi.stubGlobal('fetch', api()); mostrar('/compras')
    await screen.findByRole('link', { name: 'Abrir borrador 7' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar solicitudes' }), { target: { value: 'noexiste' } })
    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    expect(await screen.findByText('Datos de la solicitud')).toBeInTheDocument()
  })
  it('distingue un fallo de carga de un borrador vacío', async () => {
    vi.stubGlobal('fetch', api({ falloCarga: true })); mostrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir.')
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Cargando borrador…')).not.toBeInTheDocument())
  })
})
