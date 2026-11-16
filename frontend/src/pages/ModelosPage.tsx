
import { useEffect, useState } from 'react'

import {
  obtenerModelos,
  registrarModelo,
  editarModelo,
  cambiarEstadoModelo,
  type Modelo
} from '../services/modeloService'

export default function ModelosPage() {
  // Lista de modelos obtenidos desde PostgreSQL.
  const [modelos, setModelos] = useState<Modelo[]>([])

  // Datos del formulario.
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [idEditando, setIdEditando] = useState<number | null>(null)

  // Estado de la pantalla.
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [idCambiando, setIdCambiando] = useState<number | null>(null)

  // Búsqueda y filtros de la tabla.
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Mensajes de respuesta.
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // Consulta todos los modelos registrados.
  const cargarModelos = async () => {
    try {
      setCargando(true)

      const datos = await obtenerModelos()
      setModelos(datos)

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los modelos.'
      )

    } finally {
      setCargando(false)
    }
  }

  // Cargamos el catálogo al abrir la pantalla.
  useEffect(() => {
    void cargarModelos()
  }, [])

  // Limpia el formulario y termina el modo edición.
  const limpiarFormulario = () => {
    setNombre('')
    setDescripcion('')
    setIdEditando(null)
    setError('')
    setMensaje('')
  }

  // Registra un modelo nuevo o actualiza uno existente.
  const guardarModelo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setError('')
    setMensaje('')

    if (!nombre.trim()) {
      setError('El nombre del modelo es obligatorio.')
      return
    }

    if (nombre.trim().length > 100) {
      setError('El nombre no puede superar 100 caracteres.')
      return
    }

    if (descripcion.trim().length > 255) {
      setError('La descripción no puede superar 255 caracteres.')
      return
    }

    try {
      setGuardando(true)

      const datos = {
        nombre_modelo: nombre.trim(),
        descripcion: descripcion.trim()
      }

      const respuesta = idEditando === null
        ? await registrarModelo(datos)
        : await editarModelo(idEditando, datos)

      // Actualizamos la lista después de guardar.
      const modelosActualizados = await obtenerModelos()
      setModelos(modelosActualizados)

      setNombre('')
      setDescripcion('')
      setIdEditando(null)
      setMensaje(respuesta.mensaje)

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el modelo.'
      )

    } finally {
      setGuardando(false)
    }
  }

  // Copia los datos seleccionados al formulario.
  const seleccionarEditar = (modelo: Modelo) => {
    setIdEditando(modelo.id_modelo)
    setNombre(modelo.nombre_modelo)
    setDescripcion(modelo.descripcion ?? '')
    setError('')
    setMensaje('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Cambia el estado del modelo sin eliminarlo.
  const cambiarEstado = async (modelo: Modelo) => {
    const nuevoEstado = !modelo.activo

    const confirmado = window.confirm(
      nuevoEstado
        ? `¿Deseas activar el modelo "${modelo.nombre_modelo}"?`
        : `¿Deseas desactivar el modelo "${modelo.nombre_modelo}"?`
    )

    if (!confirmado) return

    setError('')
    setMensaje('')

    try {
      setIdCambiando(modelo.id_modelo)

      const respuesta = await cambiarEstadoModelo(
        modelo.id_modelo,
        nuevoEstado
      )

      // Reflejamos el estado actualizado en la tabla.
      setModelos((actuales) =>
        actuales.map((item) =>
          item.id_modelo === modelo.id_modelo
            ? respuesta.modelo
            : item
        )
      )

      setMensaje(respuesta.mensaje)

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado.'
      )

    } finally {
      setIdCambiando(null)
    }
  }

  // Filtramos los registros sin realizar consultas adicionales.
  const modelosFiltrados = modelos.filter((modelo) => {
    const texto = busqueda.trim().toLowerCase()

    const coincideBusqueda =
      modelo.nombre_modelo.toLowerCase().includes(texto) ||
      (modelo.descripcion ?? '').toLowerCase().includes(texto)

    const coincideEstado =
      filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && modelo.activo) ||
      (filtroEstado === 'inactivos' && !modelo.activo)

    return coincideBusqueda && coincideEstado
  })

  return (
    <div className="min-w-0">
      <div className="min-w-0 space-y-4">

        {/* Formulario de registro y edición. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {idEditando === null
                ? 'Registrar nuevo modelo'
                : 'Editar modelo'}
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Administra los modelos disponibles en el catálogo.
            </p>
          </div>

          <form onSubmit={guardarModelo} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label
                  htmlFor="nombre"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Nombre del modelo *
                </label>

                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  maxLength={100}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Colorado"
                  disabled={guardando}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="descripcion"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Descripción
                </label>

                <textarea
                  id="descripcion"
                  value={descripcion}
                  maxLength={255}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción del modelo..."
                  rows={3}
                  disabled={guardando}
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
              </div>

            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={limpiarFormulario}
                disabled={guardando}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Limpiar
              </button>

              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {guardando
                  ? 'Guardando...'
                  : idEditando === null
                    ? 'Guardar modelo'
                    : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        {/* Mensajes de las operaciones. */}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        {mensaje && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {mensaje}
          </p>
        )}

        {/* Tabla de modelos registrados. */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Modelos registrados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {modelos.length} modelos en el catálogo
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar modelo..."
                aria-label="Buscar modelo"
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                aria-label="Filtrar por estado"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm"
              >
                <option value="todos">Todos los estados</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-indigo-50 text-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID</th>
                  <th className="px-6 py-4 font-semibold">Modelo</th>
                  <th className="px-6 py-4 font-semibold">Descripción</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      Cargando modelos...
                    </td>
                  </tr>
                ) : modelosFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No se encontraron modelos.
                    </td>
                  </tr>
                ) : (
                  modelosFiltrados.map((modelo) => (
                    <tr
                      key={modelo.id_modelo}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-slate-500">
                        {modelo.id_modelo}
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {modelo.nombre_modelo}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {modelo.descripcion || 'Sin descripción'}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={
                            modelo.activo
                              ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                              : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'
                          }
                        >
                          {modelo.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => seleccionarEditar(modelo)}
                            disabled={guardando || idCambiando !== null}
                            className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => void cambiarEstado(modelo)}
                            disabled={guardando || idCambiando !== null}
                            className={
                              modelo.activo
                                ? 'rounded-lg border border-rose-200 px-3 py-2 font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50'
                                : 'rounded-lg border border-emerald-200 px-3 py-2 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50'
                            }
                          >
                            {idCambiando === modelo.id_modelo
                              ? 'Procesando...'
                              : modelo.activo
                                ? 'Desactivar'
                                : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Mostrando {modelosFiltrados.length} de {modelos.length} modelos
          </div>
        </section>

      </div>
    </div>
  )
}
