import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import ResumenCostoAdquisicion from './ResumenCostoAdquisicion'

afterEach(() => vi.unstubAllGlobals())

test('conserva el subtotal conocido y oculta el total definitivo mientras falte un costo', () => {
  const lineaConCosto = { idSku: 1, cantidad: 2, costoUnitario: '195.00', importe: '390.00' }
  const { rerender } = render(
    <ResumenCostoAdquisicion resumen={{
      lineas: [lineaConCosto, { idSku: 3, cantidad: 1, costoUnitario: null, importe: null }],
      subtotalConocido: '390.00',
      igv: null,
      total: null,
    }} />,
  )

  const totales = within(screen.getByRole('status'))
  expect(totales.getByText('Subtotal conocido')).toBeInTheDocument()
  expect(totales.getByText('S/ 390.00')).toBeInTheDocument()
  expect(totales.getByText('Por calcular')).toBeInTheDocument()
  expect(totales.getByText('Pendiente')).toBeInTheDocument()
  expect(screen.getByText('Falta costo')).toBeInTheDocument()

  rerender(
    <ResumenCostoAdquisicion resumen={{
      lineas: [lineaConCosto, { idSku: 3, cantidad: 1, costoUnitario: '190.00', importe: '190.00' }],
      subtotalConocido: '580.00',
      igv: '104.40',
      total: '684.40',
    }} />,
  )

  expect(totales.getByText('S/ 104.40')).toBeInTheDocument()
  expect(totales.getByText('S/ 684.40')).toBeInTheDocument()
  expect(totales.queryByText('Pendiente')).not.toBeInTheDocument()
})

test('valida el costo y, si falla el recálculo, permite reintentar sin guardar dos veces', async () => {
  const usuario = userEvent.setup()
  const peticion = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
  vi.stubGlobal('fetch', peticion)
  const actualizarResumen = vi.fn()
    .mockRejectedValueOnce(new Error('No se pudo actualizar'))
    .mockResolvedValueOnce(undefined)

  render(
    <ResumenCostoAdquisicion
      resumen={{
        lineas: [{ idSku: 3, cantidad: 1, costoUnitario: null, importe: null }],
        subtotalConocido: '0.00',
        igv: null,
        total: null,
      }}
      actualizarResumen={actualizarResumen}
    />,
  )

  const campo = screen.getByRole('textbox', { name: 'Costo en soles para el SKU 3' })
  await usuario.type(campo, '0')
  await usuario.click(screen.getByRole('button', { name: 'Guardar costo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('mayor a cero')
  expect(peticion).not.toHaveBeenCalled()

  await usuario.clear(campo)
  await usuario.type(campo, '190,50')
  await usuario.click(screen.getByRole('button', { name: 'Guardar costo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El costo ya se guardó')
  expect(peticion).toHaveBeenCalledWith('/api/compras/costos-faltantes/3', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ costoUnitario: '190.50' }),
  }))

  await usuario.click(screen.getByRole('button', { name: 'Actualizar resumen' }))
  await waitFor(() => expect(actualizarResumen).toHaveBeenCalledTimes(2))
  expect(peticion).toHaveBeenCalledTimes(1)
})
