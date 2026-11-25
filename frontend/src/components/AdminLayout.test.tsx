import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import AdminLayout from './AdminLayout'
import AdminRoute from './AdminRoute'
import { InicioRoute } from '../App'
import { useAuthStore } from '../store/authStore'

const { cerrarSesion, obtenerModelos, obtenerProductosSku } = vi.hoisted(() => ({
  cerrarSesion: vi.fn(async () => ({ mensaje: 'Sesión cerrada.' })),
  obtenerModelos: vi.fn(async () => [{ id_modelo: 1 }, { id_modelo: 2 }]),
  obtenerProductosSku: vi.fn(async () => [{ id_sku: 1 }])
}))

vi.mock('../services/authApi', () => ({ cerrarSesion }))
vi.mock('../services/modeloService', () => ({ obtenerModelos }))
vi.mock('../services/productoSkuService', () => ({ obtenerProductosSku }))

const administrador = {
  id_usuario: 1, nombre: 'Ana', correo: 'ana@example.com', roles: ['Administrador'], debe_cambiar_password: false
}

function renderRutas(ruta = '/inicio') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/inicio" element={<InicioRoute />} />
          <Route path="/ventas" element={<h1>Nueva venta</h1>} />
          <Route element={<AdminRoute />}>
            <Route path="/modelos" element={<p>Formulario de modelos</p>} />
            <Route path="/usuarios" element={<p>Administración de trabajadores</p>} />
          </Route>
        </Route>
        <Route path="/login" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Panel de Administración', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: administrador })
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null })
  })

  it('mantiene el menú al navegar y destaca la sección activa', async () => {
    renderRutas()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Modelos' }))
    expect(screen.getByRole('link', { name: 'Modelos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: 'Navegación administrativa' })).toBeInTheDocument()
    expect(screen.getByText('Formulario de modelos')).toBeInTheDocument()
  })

  it('abre el menú móvil y cierra la sesión mediante la API existente', async () => {
    renderRutas()
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menú' })
    fireEvent.click(abrirMenu)
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(cerrarSesion).toHaveBeenCalledOnce())
    expect(await screen.findByText('Inicio de sesión')).toBeInTheDocument()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('impide a otros roles abrir un módulo administrativo', () => {
    useAuthStore.setState({ user: { ...administrador, roles: ['Ventas'] } })
    renderRutas('/modelos')
    expect(screen.queryByRole('navigation', { name: 'Navegación administrativa' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nueva venta' })).toBeInTheDocument()
  })

  it('mantiene el menú y destaca Gestión de Usuarios', () => {
    renderRutas('/usuarios')
    expect(screen.getByRole('link', { name: 'Gestión de Usuarios' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Administración de trabajadores')).toBeInTheDocument()
  })

  it('impide a otros roles abrir Gestión de Usuarios', () => {
    useAuthStore.setState({ user: { ...administrador, roles: ['Ventas'] } })
    renderRutas('/usuarios')
    expect(screen.queryByText('Administración de trabajadores')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nueva venta' })).toBeInTheDocument()
  })
})
