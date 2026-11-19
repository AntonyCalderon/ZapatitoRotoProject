import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { cerrarSesion } from '../services/authApi'
import { useAuthStore } from '../store/authStore'
import {
  obtenerBorradores,
  consultarOrdenCompra,
  crearBorrador,
  guardarBorrador,
  type OrdenCompra
} from '../services/ordenCompraService'

function formatearFecha(valor: string) {
  return new Date(valor).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ComprasBorradoresPage() {
  const usuario = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  // Bandeja de borradores y borrador abierto en el editor.
  const [borradores, setBorradores] = useState<OrdenCompra[]>([])
  const [abierto, setAbierto] = useState<OrdenCompra | null>(null)
  const [observacion, setObservacion] = useState('')

  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // RN-04: hay cambios sin guardar si el texto difiere de lo guardado.
  const haySinGuardar =
    abierto !== null && observacion.trim() !== (abierto.observacion ?? '')

  // Cargamos la bandeja al abrir la pantalla.
  useEffect(() => {
    let activo = true

    obtenerBorradores()
      .then((datos) => {
        if (activo) setBorradores(datos)
      })
      .catch((err) => {
        if (activo) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los borradores.')
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  // RN-04: al recargar o cerrar la pestaña con cambios sin guardar, el navegador avisa.
  useEffect(() => {
    if (!haySinGuardar) return

    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [haySinGuardar])

  // Pregunta antes de abandonar el borrador si hay cambios sin guardar.
  const confirmarSalida = () =>
    !haySinGuardar ||
    window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?')

  const abrir = (orden: OrdenCompra) => {
    setAbierto(orden)
    setObservacion(orden.observacion ?? '')
  }

  const refrescarLista = async () => {
    setBorradores(await obtenerBorradores())
  }

  // CA-01: crea una solicitud vacía en estado Borrador y la abre.
  const nuevaSolicitud = async () => {
    if (!confirmarSalida()) return
    setError('')
    setMensaje('')

    try {
      setOcupado(true)
      const respuesta = await crearBorrador()
      await refrescarLista()
      abrir(respuesta.orden)
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el borrador.')
    } finally {
      setOcupado(false)
    }
  }

  // Abre un borrador existente consultando su información guardada (CA-03).
  const abrirBorrador = async (idOrden: number) => {
    if (!confirmarSalida()) return
    setError('')
    setMensaje('')

    try {
      setOcupado(true)
      const respuesta = await consultarOrdenCompra(idOrden)
      abrir(respuesta.orden)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el borrador.')
    } finally {
      setOcupado(false)
    }
  }

  // CA-02: guarda manualmente aunque falten modelos, tallas o cantidades.
  const guardar = async () => {
    if (!abierto) return
    setError('')
    setMensaje('')

    if (observacion.length > 500) {
      setError('Las observaciones no pueden superar 500 caracteres.')
      return
    }

    try {
      setOcupado(true)
      const respuesta = await guardarBorrador(abierto.id_orden_compra, {
        id_proveedor: abierto.id_proveedor,
        observacion: observacion.trim()
      })
      abrir(respuesta.orden)
      await refrescarLista()
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el borrador.')
    } finally {
      setOcupado(false)
    }
  }

  const volverALaBandeja = () => {
    if (!confirmarSalida()) return
    setAbierto(null)
    setObservacion('')
    setError('')
    setMensaje('')
  }

  const cerrar = async () => {
    if (!confirmarSalida()) return

    try {
      await cerrarSesion()
      logout()
      navigate('/login', { replace: true })
    } catch {
      setError('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Compras</p>
            <h1 className="text-xl font-semibold text-slate-900">Solicitudes de compra</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{usuario?.nombre}</span>
            <button
              type="button"
              onClick={() => void cerrar()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        )}

        {mensaje && (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {mensaje}
          </p>
        )}

        {/* Borrador abierto. */}
        {abierto && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Borrador #{abierto.id_orden_compra}
                </h2>
                <p className="text-sm text-slate-500">
                  Creado el {formatearFecha(abierto.fecha_creacion)}
                </p>
              </div>

              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {abierto.estado}
              </span>
            </div>

            <label htmlFor="observacion" className="mb-2 block text-sm font-semibold text-slate-800">
              Observaciones
            </label>
            <textarea
              id="observacion"
              value={observacion}
              maxLength={500}
              rows={4}
              disabled={ocupado}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Notas sobre esta compra en preparación..."
              className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            />

            {haySinGuardar && (
              <p className="mt-2 text-sm font-medium text-amber-700">Tienes cambios sin guardar.</p>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              {abierto.estado === 'Borrador' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    if (confirmarSalida()) {
                      navigate(`/compras/borrador/${abierto.id_orden_compra}/productos`)
                    }
                  }}
                  className="rounded-lg border border-indigo-600 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  Seleccionar productos
                </button>
              )}

              <button
                type="button"
                onClick={volverALaBandeja}
                disabled={ocupado}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Volver a la bandeja
              </button>

              <button
                type="button"
                onClick={() => void guardar()}
                disabled={ocupado}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {ocupado ? 'Guardando...' : 'Guardar borrador'}
              </button>
            </div>
          </section>
        )}

        {/* Bandeja de borradores. */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bandeja de borradores</h2>
              <p className="mt-1 text-sm text-slate-500">{`${borradores.length} borradores`}</p>
            </div>

            <button
              type="button"
              onClick={() => void nuevaSolicitud()}
              disabled={ocupado}
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Nueva solicitud
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-indigo-50 text-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">N.º</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Creado por</th>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                  <th className="px-6 py-4 font-semibold">Observaciones</th>
                  <th className="px-6 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      Cargando borradores...
                    </td>
                  </tr>
                ) : borradores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No hay borradores. Presiona «Nueva solicitud» para crear uno.
                    </td>
                  </tr>
                ) : (
                  borradores.map((borrador) => (
                    <tr key={borrador.id_orden_compra} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-500">{borrador.id_orden_compra}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          {borrador.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{borrador.creador}</td>
                      <td className="px-6 py-4 text-slate-600">{formatearFecha(borrador.fecha_creacion)}</td>
                      <td className="px-6 py-4 text-slate-600">{borrador.observacion || 'Sin observaciones'}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void abrirBorrador(borrador.id_orden_compra)}
                            disabled={ocupado}
                            className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            Abrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  )
}
