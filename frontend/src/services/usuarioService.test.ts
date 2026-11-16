import { afterEach, expect, it, vi } from 'vitest'
import { obtenerRoles, obtenerUsuarios } from './usuarioService'

afterEach(() => vi.unstubAllGlobals())

it('informa una respuesta HTML inesperada sin exponer el error de JSON', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!DOCTYPE html>', { status: 404, headers: { 'Content-Type': 'text/html' } })))
  await expect(obtenerRoles()).rejects.toThrow('El servidor devolvió una respuesta inesperada (HTTP 404).')
})

it('conserva el mensaje JSON del backend y envía cookies', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ mensaje: 'Debes iniciar sesión.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(obtenerUsuarios()).rejects.toThrow('Debes iniciar sesión.')
  expect(fetchMock).toHaveBeenCalledWith('/api/usuarios', expect.objectContaining({ credentials: 'include' }))
})
