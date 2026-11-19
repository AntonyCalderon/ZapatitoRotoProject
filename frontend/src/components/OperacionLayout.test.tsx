import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OperacionLayout from './OperacionLayout'
import RolRoute from './RolRoute'
import Home from '../pages/Home'
import { useAuthStore } from '../store/authStore'
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }) })
for (const [rol, path, nombre] of [['Ventas', '/ventas', 'Ventas'], ['Almacen', '/almacen', 'Almacén']]) {
  it(`prepara ${nombre} con su sidebar y contenido, sin navegación administrativa`, () => {
    useAuthStore.setState({ user: { id_usuario: 1, nombre: 'Ana', correo: 'ana@example.com', roles: [rol], debe_cambiar_password: false } })
    render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<OperacionLayout />}><Route element={<RolRoute rol={rol} />}><Route path={path} element={<Home />} /></Route></Route></Routes></MemoryRouter>)
    expect(screen.getByRole('navigation', { name: 'Navegación de operaciones' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: nombre })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: nombre })).toBeInTheDocument()
    expect(screen.getByText('En preparación')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gestión de Usuarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Compras' })).not.toBeInTheDocument()
  })
}
