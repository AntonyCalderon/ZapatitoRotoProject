import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import UsuariosPage from './UsuariosPage'
import { useAuthStore } from '../store/authStore'

const administrador = { id_usuario: 1, nombre: 'Admin', correo: 'admin@ejemplo.com', roles: ['Administrador'], activo: true, debe_cambiar_password: false }
const trabajador = { id_usuario: 2, nombre: 'Ana', correo: 'ana@ejemplo.com', roles: ['Ventas'], activo: true, debe_cambiar_password: true }
const respuesta = (datos: unknown, ok = true) => ({ ok, json: async () => datos })

beforeEach(() => { useAuthStore.setState({ user: administrador }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null }) })

function preparar(duplicado = false) {
  const fetchMock = vi.fn(async (url: string, opciones?: RequestInit) => {
    if (url.endsWith('/roles')) return respuesta({ roles: [{ id_rol: 4, nombre_rol: 'Ventas' }] })
    if (opciones?.method === 'POST') return duplicado ? respuesta({ mensaje: 'Ya existe un usuario con ese correo.' }, false) : respuesta({ usuario: trabajador, passwordTemporal: 'secreto-temporal' })
    if (opciones?.method === 'PATCH') return respuesta({ usuario: { id_usuario: 2, nombre: 'Ana', correo: 'ana@ejemplo.com', activo: JSON.parse(String(opciones.body)).activo, debe_cambiar_password: true } })
    return respuesta({ usuarios: [administrador, trabajador] })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<UsuariosPage />)
  return fetchMock
}

async function rellenar() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@ejemplo.com' } })
  fireEvent.click(await screen.findByLabelText('Ventas'))
  fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
}

describe('gestión de usuarios', () => {
  it('distingue un error de carga de una lista vacía de roles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => { throw new SyntaxError('HTML') } }))
    render(<UsuariosPage />)
    expect(await screen.findByText('No se pudieron cargar los roles.')).toBeInTheDocument()
    expect(screen.queryByText('No hay roles disponibles.')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404')
  })
  it('carga roles, crea una cuenta y elimina la contraseña al cerrar', async () => {
    const fetchMock = preparar()
    await rellenar()
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('secreto-temporal')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    const llamada = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === 'POST')
    expect(JSON.parse(String(llamada?.[1]?.body))).toEqual({ nombre: 'Ana', correo: 'ana@ejemplo.com', roles: [4] })
    fireEvent.click(within(dialogo).getByLabelText(/He guardado la contraseña/))
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('secreto-temporal')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('muestra el error de correo duplicado', async () => {
    preparar(true); await rellenar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un usuario con ese correo.')
  })
  it('copia la contraseña temporal', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    preparar(); await rellenar()
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Copiar contraseña' }))
    expect(await within(dialogo).findByText('Contraseña copiada.')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('secreto-temporal')
  })
  it('protege la cuenta propia y permite desactivar y activar otra', async () => {
    preparar()
    const filaAdmin = (await screen.findByText('admin@ejemplo.com')).closest('tr')!
    expect(within(filaAdmin).getByRole('button', { name: 'Desactivar' })).toBeDisabled()
    const fila = screen.getByText('ana@ejemplo.com').closest('tr')!
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(fila).getByRole('button', { name: 'Desactivar' }))
    expect(await within(fila).findByText('Inactivo')).toBeInTheDocument()
    fireEvent.click(within(fila).getByRole('button', { name: 'Activar' }))
    expect(await within(fila).findByText('Activo')).toBeInTheDocument()
  })
})
