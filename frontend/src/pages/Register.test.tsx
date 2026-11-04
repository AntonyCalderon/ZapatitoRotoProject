import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'

describe('registro', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('muestra los errores de validación para datos inválidos', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText('El nombre debe tener al menos 2 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa un correo válido.')).toBeInTheDocument()
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()
  })

  it('registra una cuenta válida y guarda el usuario en localStorage', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana Pérez' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-segura' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'clave-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('registro-login-users') ?? '[]')).toHaveLength(1))
    expect(JSON.parse(localStorage.getItem('registro-login-users') ?? '[]')[0]).toMatchObject({ name: 'Ana Pérez', email: 'ana@example.com' })
  })
})
