import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'
import type { ComprobanteVenta, DetalleVentaConfirmada } from '../services/ventaConfirmadaService'

// HU14 (PROYEC-25) y HU15 (PROYEC-26) con un servidor simulado que conserva el estado de la venta.
const api = '/api/ventas/confirmadas'

function ventaInicial(): DetalleVentaConfirmada {
  return {
    venta: {
      id_orden_venta: 18, estado: 'Pendiente', fecha_creacion: '2026-11-25T20:00:00Z', fecha_confirmacion: '2026-11-25T22:40:00Z',
      tasa_igv: '0.1800', subtotal: '3120.00', igv: '561.60', total: '3681.60',
      tipo_documento_cliente: 'O/C', numero_documento_cliente: '0045-2026',
      tipo_documento: 'RUC', numero_documento: '20123456789', razon_social_nombre: 'Gobierno Regional de prueba',
      direccion: null, tipo_cliente: 'Gobierno Regional', segmento: 'B2G',
    },
    lineas: [
      { id_sku: 1, codigo_sku: 'THR-NEG-40', modelo: 'Threshold', color: 'Negro', talla: '40.0', cantidad: 6, importe: '1560.00', precio_con_igv: '306.80' },
      { id_sku: 2, codigo_sku: 'THR-NEG-41', modelo: 'Threshold', color: 'Negro', talla: '41.0', cantidad: 6, importe: '1560.00', precio_con_igv: '306.80' },
    ],
    comprobantes: [], notas_credito: [], despacho: null,
    comprobante_propuesto: { tipo: 'Factura', serie: 'F001', motivo: null },
  }
}

function abrir(rol: string, pagina: string) {
  const estado = ventaInicial()
  let numero = 3
  const enviados: { url: string; cuerpo: unknown }[] = []
  window.history.replaceState(null, '', pagina)
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') {
      return Response.json({ usuario: { id_usuario: 1, nombre: 'Usuario de prueba', correo: 'usuario@example.com', roles: [rol], debe_cambiar_password: false } })
    }
    if (init?.method === 'POST') enviados.push({ url, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (url === api) {
      const vigente = estado.comprobantes.find(c => c.estado === 'Emitido')
      return Response.json({ ventas: [{
        id_orden_venta: 18, estado: estado.venta.estado, fecha_confirmacion: estado.venta.fecha_confirmacion, total: '3681.60',
        cliente: 'Gobierno Regional de prueba', tipo_documento: 'RUC', tipo_cliente: 'Gobierno Regional', segmento: 'B2G', pares: 12,
        tipo_comprobante: vigente?.tipo ?? null, serie_comprobante: vigente?.serie ?? null, numero_comprobante: vigente?.numero ?? null,
        codigo_despacho: estado.despacho?.codigo ?? null,
      }] })
    }
    if (url === `${api}/18`) return Response.json(structuredClone(estado))
    if (url === `${api}/18/comprobante`) {
      const { direccion } = JSON.parse(String(init?.body))
      estado.venta.direccion = direccion
      const comprobante: ComprobanteVenta = { id_comprobante: numero, tipo: 'Factura', serie: 'F001', numero: String(numero).padStart(8, '0'),
        estado: 'Emitido', fecha_emision: `2026-11-26T15:${10 + numero}:00Z`, total: '3681.60' }
      numero += 1
      estado.comprobantes.push(comprobante)
      return Response.json({ comprobante }, { status: 201 })
    }
    if (url === `${api}/18/comprobante/anular`) {
      const { motivo, sustento } = JSON.parse(String(init?.body))
      const vigente = estado.comprobantes.find(c => c.estado === 'Emitido')!
      vigente.estado = 'Anulado'
      const nota_credito = { id_nota_credito: 5, id_comprobante: vigente.id_comprobante, serie: 'FC01', numero: '00000001', motivo, sustento,
        fecha_emision: '2026-11-26T16:05:00Z', total: vigente.total }
      estado.notas_credito.push(nota_credito)
      return Response.json({ nota_credito, comprobante_anulado: vigente }, { status: 201 })
    }
    if (url === `${api}/18/despacho`) {
      estado.venta.estado = 'En Almacén'
      estado.despacho = { id_orden_despacho: 9, codigo: 'OD-2026-002', estado: 'Pendiente de Despacho', fecha_emision: '2026-11-26T15:32:00Z' }
      return Response.json({ despacho: estado.despacho, estado_venta: 'En Almacén' }, { status: 201 })
    }
    if (url.startsWith('/api/ventas') || url.startsWith('/api/modelos') || url.startsWith('/api/productos-sku')) {
      return Response.json({ borradores: [], productos: [], modelos: [] })
    }
    throw new Error('Ruta inesperada durante la prueba ' + url)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  return { enviados, fetchMock }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

it('Ventas abre la bandeja desde el menú y entra al detalle de la venta', async () => {
  const usuario = userEvent.setup()
  abrir('Ventas', '/ventas/precios')
  await usuario.click(await screen.findByRole('link', { name: 'Ventas confirmadas' }))
  const tabla = await screen.findByRole('table', { name: 'Ventas confirmadas' })
  const fila = within(tabla).getByRole('row', { name: /#18/ })
  expect(fila).toHaveTextContent('Gobierno Regional de prueba')
  expect(fila).toHaveTextContent('Por emitir')
  expect(fila).toHaveTextContent('Pendiente')
  await usuario.click(within(fila).getByRole('link', { name: 'Abrir venta 18' }))
  expect(await screen.findByRole('heading', { name: 'Venta #18' })).toBeInTheDocument()
})

it('HU14 y HU15: pide la dirección, emite la factura y recién entonces permite enviar a Almacén', async () => {
  const usuario = userEvent.setup()
  const { enviados } = abrir('Ventas', '/ventas/confirmadas/18')
  expect(await screen.findByText(/Factura · serie F001/)).toBeInTheDocument()

  const emitir = screen.getByRole('button', { name: 'Revisar y emitir comprobante' })
  const enviar = screen.getByRole('button', { name: 'Enviar a despacho' })
  expect(emitir).toBeDisabled()
  expect(enviar).toBeDisabled()
  expect(screen.getByText('Disponible cuando la venta tenga comprobante.')).toBeInTheDocument()

  await usuario.type(screen.getByRole('textbox', { name: 'Dirección fiscal y de entrega' }), 'Av. de prueba 123, Ayacucho')
  await usuario.click(emitir)
  const dialogo = screen.getByRole('dialog', { name: 'Emitir factura F001' })
  expect(dialogo).toHaveTextContent('S/ 3,681.60')
  expect(dialogo).toHaveTextContent('no modifica el stock')
  await usuario.click(within(dialogo).getByRole('button', { name: 'Volver' }))
  expect(enviados).toHaveLength(0)

  await usuario.click(emitir)
  await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Emitir factura' }))
  expect(await screen.findByText('Factura F001-00000003 emitida')).toBeInTheDocument()
  expect(enviados).toEqual([{ url: `${api}/18/comprobante`, cuerpo: { direccion: 'Av. de prueba 123, Ayacucho' } }])
  expect(screen.getByRole('link', { name: 'Descargar Factura F001-00000003 PDF' }))
    .toHaveAttribute('href', `${api}/18/comprobantes/3/pdf`)
  expect(screen.queryByRole('button', { name: 'Revisar y emitir comprobante' })).not.toBeInTheDocument()

  const enviarAhora = await screen.findByRole('button', { name: 'Enviar a despacho' })
  expect(enviarAhora).toBeEnabled()
  await usuario.click(enviarAhora)
  const confirmar = screen.getByRole('dialog', { name: 'Enviar a Almacén' })
  expect(confirmar).toHaveTextContent('F001-00000003')
  expect(confirmar).toHaveTextContent('12 pares')
  await usuario.click(within(confirmar).getByRole('button', { name: 'Enviar a Almacén' }))
  expect(await screen.findByText('Orden OD-2026-002 enviada a Almacén')).toBeInTheDocument()
  expect(await screen.findByText('Orden OD-2026-002 · Pendiente de Despacho')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enviar a despacho' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Anular comprobante' })).not.toBeInTheDocument()
  expect(enviados.at(-1)).toEqual({ url: `${api}/18/despacho`, cuerpo: undefined })
})

it('Corrección: anula con nota de crédito y permite emitir un comprobante nuevo', async () => {
  const usuario = userEvent.setup()
  const { enviados } = abrir('Ventas', '/ventas/confirmadas/18')
  await usuario.type(await screen.findByRole('textbox', { name: 'Dirección fiscal y de entrega' }), 'Av. de prueba 123')
  await usuario.click(screen.getByRole('button', { name: 'Revisar y emitir comprobante' }))
  await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Emitir factura' }))
  await usuario.click(await screen.findByRole('button', { name: 'Anular comprobante' }))

  const dialogo = screen.getByRole('dialog', { name: 'Anular factura F001-00000003' })
  const confirmar = within(dialogo).getByRole('button', { name: 'Anular con nota de crédito' })
  expect(confirmar).toBeDisabled()
  await usuario.selectOptions(within(dialogo).getByRole('combobox', { name: 'Motivo' }), '02')
  await usuario.type(within(dialogo).getByRole('textbox', { name: 'Sustento' }), 'RUC de la unidad ejecutora')
  await usuario.click(confirmar)

  expect(await screen.findByText('Factura F001-00000003 anulada')).toBeInTheDocument()
  expect(enviados.at(-1)).toEqual({ url: `${api}/18/comprobante/anular`, cuerpo: { motivo: '02', sustento: 'RUC de la unidad ejecutora' } })
  const tabla = await screen.findByRole('table', { name: 'Comprobantes de la venta' })
  expect(within(tabla).getByRole('row', { name: /Factura F001-00000003/ })).toHaveTextContent('Anulada')
  expect(within(tabla).getByRole('row', { name: /Nota de crédito FC01-00000001/ }))
    .toHaveTextContent('02 · Anulación por error en el RUC · ref. F001-00000003')
  expect(await screen.findByRole('button', { name: 'Revisar y emitir comprobante' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Enviar a despacho' })).toBeDisabled()
})

it('Almacén no ve el menú de Ventas confirmadas', async () => {
  abrir('Almacen', '/inicio')
  await screen.findByRole('link', { name: 'Pendientes de despacho' })
  expect(screen.queryByRole('link', { name: 'Ventas confirmadas' })).not.toBeInTheDocument()
})
