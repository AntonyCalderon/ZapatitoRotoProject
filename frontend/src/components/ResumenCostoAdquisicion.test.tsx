import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import ResumenCostoAdquisicion from './ResumenCostoAdquisicion'

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
