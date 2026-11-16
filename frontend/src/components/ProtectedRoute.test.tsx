import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '../store/authStore'

const usuario = { id_usuario: 1, nombre: 'Ana', correo: 'a@b.co', roles: ['Ventas'], debe_cambiar_password: true }
afterEach(() => { cleanup(); vi.restoreAllMocks(); useAuthStore.setState({ user: null }) })

function abrir(ruta: string, pendiente: boolean) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ usuario: { ...usuario, debe_cambiar_password: pendiente } }) }))
  render(<MemoryRouter initialEntries={[ruta]}><Routes><Route element={<ProtectedRoute />}>
    <Route path="/inicio" element={<p>Inicio autorizado</p>} />
    <Route path="/cambiar-password" element={<p>Cambio requerido</p>} />
  </Route></Routes></MemoryRouter>)
}
describe('sesión protegida', () => {
  it('recarga la sesión y dirige al cambio pendiente', async () => {
    abrir('/inicio', true)
    expect(await screen.findByText('Cambio requerido')).toBeInTheDocument()
    expect(screen.queryByText('Inicio autorizado')).not.toBeInTheDocument()
  })
  it('mantiene la pantalla de cambio pendiente sin bucles', async () => {
    abrir('/cambiar-password', true)
    expect(await screen.findByText('Cambio requerido')).toBeInTheDocument()
  })
  it('redirige al inicio cuando el cambio ya se completó', async () => {
    abrir('/cambiar-password', false)
    expect(await screen.findByText('Inicio autorizado')).toBeInTheDocument()
  })
})
