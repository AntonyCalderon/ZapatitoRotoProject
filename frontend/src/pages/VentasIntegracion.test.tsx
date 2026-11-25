import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

const producto = {
  id_sku: 4, codigo_sku: 'THR-NEG-40', id_modelo: 1, modelo: 'Threshold',
  id_color: 1, color: 'Negro', id_talla: 1, talla: '40.0', disponible: 5,
}
const api = '/api/ventas'

function abrir(pagina: string, atender: (url: string, config?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, config?: RequestInit) => {
    if (url === '/api/auth/me') return Response.json({ usuario: {
      id_usuario: 12, nombre: 'Vendedor de prueba', roles: ['Ventas'], debe_cambiar_password: false,
    } })
    return atender(url, config)
  })
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState(null, '', pagina)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={cliente}><App /></QueryClientProvider>)
  return userEvent.setup()
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

it('consulta un SKU desde Ventas, actualiza el disponible y muestra Sin stock', async () => {
  const disponibilidades = [5, 2, 0]
  const usuario = abrir('/ventas', url => {
    if (url === api + '/precios/productos') return Response.json({ productos: [producto] })
    if (url === api + '/precios/productos/4/disponibilidad') {
      return Response.json({ producto: { ...producto, disponible: disponibilidades.shift() } })
    }
    throw new Error('Ruta no esperada: ' + url)
  })
  await usuario.click(await screen.findByRole('link', { name: 'Disponibilidad' }))
  await usuario.selectOptions(await screen.findByLabelText('Producto (SKU)'), '4')
  expect(await screen.findByText('Disponible: 5 pares')).toBeInTheDocument()
  const consultar = screen.getByRole('button', { name: 'Consultar disponibilidad' })
  await usuario.click(consultar)
  expect(await screen.findByText('Disponible: 2 pares')).toBeInTheDocument()
  await usuario.click(consultar)
  expect(await screen.findByText('Sin stock')).toBeInTheDocument()
})

it('exige los datos B2G, recupera un cliente y abre su borrador en precios', async () => {
  const cliente = { tipo: 'Gobierno Regional', documento: '20999999001', nombre: 'Gobierno de prueba' }
  const borrador = {
    id_orden_venta: 7, cliente: cliente.nombre, segmento: 'B2G',
    lineas: [], subtotal: '0.00', igv: '0.00', total: '0.00',
  }
  const usuario = abrir('/ventas', (url, config) => {
    if (url === api + '/clientes/20999999000') return Response.json({ cliente: null })
    if (url === api + '/clientes/20999999001') return Response.json({ cliente })
    if (url === api + '/borradores' && config?.method === 'POST') {
      expect(JSON.parse(config.body as string)).toEqual(cliente)
      return Response.json({ id_orden_venta: 7 }, { status: 201 })
    }
    if (url === api + '/precios/borradores/7') return Response.json({ borrador })
    if (url === api + '/precios/productos') return Response.json({ productos: [producto] })
    if (url === api + '/precios/borradores/7/recalcular' && config?.method === 'POST') {
      return Response.json({ borrador: { ...borrador, subtotal: '260.00', igv: '46.80', total: '306.80' } })
    }
    throw new Error('Ruta no esperada: ' + url)
  })

  const tipo = await screen.findByLabelText('Tipo de cliente')
  expect(within(tipo).getAllByRole('option').map(el => el.textContent))
    .toEqual(['Seleccionar tipo', 'Gobierno Regional', 'Municipio', 'Privado', 'Particular'])
  await usuario.selectOptions(tipo, 'Gobierno Regional')
  const guardar = screen.getByRole('button', { name: 'Guardar y continuar a precios' })
  await usuario.click(guardar)
  expect(await screen.findByRole('alert')).toHaveTextContent('RUC de 11 dígitos')
  const ruc = screen.getByLabelText('RUC (11 dígitos)')
  await usuario.type(ruc, '20999999000')
  await screen.findByLabelText('Entidad estatal')
  await usuario.click(guardar)
  expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa la entidad estatal')
  await usuario.clear(ruc)
  await usuario.type(ruc, cliente.documento)
  expect(await screen.findByLabelText('Entidad estatal')).toHaveValue(cliente.nombre)
  await usuario.click(guardar)
  expect(await screen.findByRole('heading', { name: 'Precios del borrador #7' })).toBeInTheDocument()
  expect(await screen.findByText('Gobierno de prueba · B2G')).toBeInTheDocument()
  await usuario.click(screen.getByRole('button', { name: 'Actualizar precios' }))
  expect(await screen.findByText(/306\.80/)).toBeInTheDocument()
})
