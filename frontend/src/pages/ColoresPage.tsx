import { useEffect, useState } from 'react'
import {
  obtenerColores,
  registrarColor,
  editarColor,
  cambiarEstadoColor,
  type Color
} from '../services/colorService'

export default function ColoresPage() {
  const [colores, setColores] = useState<Color[]>([])
  const [nombre, setNombre] = useState('')
  const [idEditando, setIdEditando] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [idCambiando, setIdCambiando] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // Mostramos colores activos e inactivos en el catálogo administrativo.
  useEffect(() => {
    let vigente = true
    void obtenerColores()
      .then((datos) => { if (vigente) setColores(datos) })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los colores.')
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [])

  const limpiarFormulario = () => {
    setNombre('')
    setIdEditando(null)
    setError('')
    setMensaje('')
  }

  const guardarColor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMensaje('')
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) {
      setError('El nombre del color es obligatorio.')
      return
    }
    if (nombreLimpio.length > 50) {
      setError('El nombre no puede superar 50 caracteres.')
      return
    }
    try {
      setGuardando(true)
      const datos = { nombre_color: nombreLimpio }
      const respuesta = idEditando === null
        ? await registrarColor(datos)
        : await editarColor(idEditando, datos)
      setColores(await obtenerColores())
      setNombre('')
      setIdEditando(null)
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el color.')
    } finally {
      setGuardando(false)
    }
  }

  const seleccionarEditar = (color: Color) => {
    setIdEditando(color.id_color)
    setNombre(color.nombre_color)
    setError('')
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // La operación cambia solo activo y conserva los SKU asociados.
  const cambiarEstado = async (color: Color) => {
    const nuevoEstado = !color.activo
    if (!window.confirm(
      nuevoEstado
        ? `¿Deseas activar el color "${color.nombre_color}"?`
        : `¿Deseas desactivar el color "${color.nombre_color}"?`
    )) return
    setError('')
    setMensaje('')
    try {
      setIdCambiando(color.id_color)
      const respuesta = await cambiarEstadoColor(color.id_color, nuevoEstado)
      setColores((actuales) => actuales.map((item) =>
        item.id_color === color.id_color ? respuesta.color : item
      ))
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setIdCambiando(null)
    }
  }

  const coloresFiltrados = colores.filter((color) => {
    const coincideBusqueda = color.nombre_color.toLowerCase().includes(busqueda.trim().toLowerCase())
    const coincideEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && color.activo) ||
      (filtroEstado === 'inactivos' && !color.activo)
    return coincideBusqueda && coincideEstado
  })

  return (
    <div className="min-w-0">
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {idEditando === null ? 'Registrar nuevo color' : 'Editar color'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Administra los colores disponibles en el catálogo.</p>
          </div>
          <form onSubmit={guardarColor} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="nombre" className="mb-2 block text-sm font-semibold text-slate-800">
                  Nombre del color *
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  maxLength={50}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Negro"
                  disabled={guardando}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={limpiarFormulario} disabled={guardando} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                Limpiar
              </button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {guardando ? 'Guardando...' : idEditando === null ? 'Guardar color' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {mensaje && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}

        {/* La tabla conserva filtros, estado y acciones de Modelos y Tallas. */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Colores registrados</h2>
              <p className="mt-1 text-sm text-slate-500">{colores.length} colores en el catálogo</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar color..." aria-label="Buscar color" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
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
                  <th className="px-6 py-4 font-semibold">Color</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">Cargando colores...</td></tr>
                ) : coloresFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">No se encontraron colores.</td></tr>
                ) : coloresFiltrados.map((color) => (
                  <tr key={color.id_color} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{color.id_color}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{color.nombre_color}</td>
                    <td className="px-6 py-4">
                      <span className={color.activo ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'}>
                        {color.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => seleccionarEditar(color)} disabled={guardando || idCambiando !== null} className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">Editar</button>
                        <button type="button" onClick={() => void cambiarEstado(color)} disabled={guardando || idCambiando !== null} className={color.activo ? 'rounded-lg border border-rose-200 px-3 py-2 font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50' : 'rounded-lg border border-emerald-200 px-3 py-2 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50'}>
                          {idCambiando === color.id_color ? 'Procesando...' : color.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Mostrando {coloresFiltrados.length} de {colores.length} colores
          </div>
        </section>
      </div>
    </div>
  )
}
