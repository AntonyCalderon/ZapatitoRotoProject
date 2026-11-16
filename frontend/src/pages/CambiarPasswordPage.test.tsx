import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CambiarPasswordPage from './CambiarPasswordPage'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('valida la confirmación antes de enviar contraseñas', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<CambiarPasswordPage />)
  fireEvent.change(screen.getByLabelText('Contraseña temporal o actual'), { target: { value: 'temporal' } })
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'contraseña nueva segura' } })
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'distinta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})
