import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '../store/authStore'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route path="/inicio" element={<p>Pantalla de inicio</p>} />
        <Route
          path="/costo-base"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <p>Pantalla de costo base</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute con roles', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null })
  })
  afterEach(cleanup)

  it('el admin entra a costo base', () => {
    useAuthStore.setState({ user: { name: 'Admin', email: 'admin@zapatito.com', role: 'admin' } })
    renderAt('/costo-base')
    expect(screen.getByText('Pantalla de costo base')).toBeInTheDocument()
  })

  it('el vendedor vuelve a inicio', () => {
    useAuthStore.setState({ user: { name: 'Ana', email: 'ana@example.com', role: 'vendedor' } })
    renderAt('/costo-base')
    expect(screen.getByText('Pantalla de inicio')).toBeInTheDocument()
  })

  it('sin sesión va a login', () => {
    renderAt('/costo-base')
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })
})