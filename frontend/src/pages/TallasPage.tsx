import { useEffect, useState } from 'react'
import {
  obtenerTallas,
  registrarTalla,
  editarTalla,
  cambiarEstadoTalla,
  type Talla
} from '../services/tallaService'

const numeroValido = (valor: string) =>
  /^(?:0|[1-9]\d{0,2})(?:\.\d)?$/.test(valor) && Number(valor) > 0

export default function TallasPage() {
  const [tallas, setTallas] = useState<Talla[]>([])
  const [numero, setNumero] = useState('')
  const [idEditando, setIdEditando] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [idCambiando, setIdCambiando] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // Cargamos todo el catálogo para mostrar también las tallas inactivas.
  useEffect(() => {
    let vigente = true
    void obtenerTallas()
      .then((datos) => { if (vigente) setTallas(datos) })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar las tallas.')
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [])

  const limpiarFormulario = () => {
    setNumero('')
    setIdEditando(null)
    setError('')
    setMensaje('')
  }

  const guardarTalla = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMensaje('')
    const valor = numero.trim()
    if (!numeroValido(valor)) {
      setError('La talla debe ser positiva, hasta 999.9 y con máximo un decimal.')
      return
    }
    try {
      setGuardando(true)
      const datos = { numero_talla: valor }
      const respuesta = idEditando === null
        ? await registrarTalla(datos)
        : await editarTalla(idEditando, datos)
      setTallas(await obtenerTallas())
      setNumero('')
      setIdEditando(null)
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la talla.')
    } finally {
      setGuardando(false)
    }
  }

  const seleccionarEditar = (talla: Talla) => {
    setIdEditando(talla.id_talla)
    setNumero(talla.numero_talla)
    setError('')
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // La operación cambia solo activo; las relaciones permanecen intactas.
  const cambiarEstado = async (talla: Talla) => {
    const nuevoEstado = !talla.activo
    if (!window.confirm(
      nuevoEstado
        ? `¿Deseas activar la talla "${talla.numero_talla}"?`
        : `¿Deseas desactivar la talla "${talla.numero_talla}"?`
    )) return
    setError('')
    setMensaje('')
    try {
      setIdCambiando(talla.id_talla)
      const respuesta = await cambiarEstadoTalla(talla.id_talla, nuevoEstado)
      setTallas((actuales) => actuales.map((item) =>
        item.id_talla === talla.id_talla ? respuesta.talla : item
      ))
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setIdCambiando(null)
    }
  }

  const tallasFiltradas = tallas.filter((talla) => {
    const coincideBusqueda = talla.numero_talla.includes(busqueda.trim())
    const coincideEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && talla.activo) ||
      (filtroEstado === 'inactivos' && !talla.activo)
    return coincideBusqueda && coincideEstado
  })

  return (
    <div className="min-w-0">
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {idEditando === null ? 'Registrar nueva talla' : 'Editar talla'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Administra las tallas disponibles en el catálogo.</p>
          </div>
          <form onSubmit={guardarTalla} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="numero" className="mb-2 block text-sm font-semibold text-slate-800">
                  Número de talla *
                </label>
                <input
                  id="numero"
                  type="text"
                  inputMode="decimal"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ej. 40.5"
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
                {guardando ? 'Guardando...' : idEditando === null ? 'Guardar talla' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {mensaje && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}

        {/* Tabla, filtros y acciones siguen el comportamiento de Modelos. */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tallas registradas</h2>
              <p className="mt-1 text-sm text-slate-500">{tallas.length} tallas en el catálogo</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar talla..." aria-label="Buscar talla" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
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
                  <th className="px-6 py-4 font-semibold">Talla</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">Cargando tallas...</td></tr>
                ) : tallasFiltradas.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">No se encontraron tallas.</td></tr>
                ) : tallasFiltradas.map((talla) => (
                  <tr key={talla.id_talla} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{talla.id_talla}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{talla.numero_talla}</td>
                    <td className="px-6 py-4">
                      <span className={talla.activo ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'}>
                        {talla.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => seleccionarEditar(talla)} disabled={guardando || idCambiando !== null} className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">Editar</button>
                        <button type="button" onClick={() => void cambiarEstado(talla)} disabled={guardando || idCambiando !== null} className={talla.activo ? 'rounded-lg border border-rose-200 px-3 py-2 font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50' : 'rounded-lg border border-emerald-200 px-3 py-2 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50'}>
                          {idCambiando === talla.id_talla ? 'Procesando...' : talla.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Mostrando {tallasFiltradas.length} de {tallas.length} tallas
          </div>
        </section>
      </div>
    </div>
  )
}
