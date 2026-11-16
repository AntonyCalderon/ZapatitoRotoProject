import { useEffect, useState } from 'react'
import {
  obtenerOpcionesSku,
  obtenerProductosSku,
  consultarProductoSku,
  registrarProductoSku,
  cambiarEstadoProductoSku,
  type OpcionesSku,
  type ProductoSku
} from '../services/productoSkuService'

export default function ProductosSkuPage() {
  const [productos, setProductos] = useState<ProductoSku[]>([])
  const [opciones, setOpciones] = useState<OpcionesSku>({ modelos: [], tallas: [], colores: [] })
  const [idModelo, setIdModelo] = useState('')
  const [idTalla, setIdTalla] = useState('')
  const [idColor, setIdColor] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [idCambiando, setIdCambiando] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [detalle, setDetalle] = useState<ProductoSku | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // El formulario recibe únicamente componentes activos desde Express.
  useEffect(() => {
    let vigente = true
    void Promise.all([obtenerOpcionesSku(), obtenerProductosSku()])
      .then(([datosOpciones, datosProductos]) => {
        if (vigente) {
          setOpciones(datosOpciones)
          setProductos(datosProductos)
        }
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [])

  const limpiarFormulario = () => {
    setIdModelo('')
    setIdTalla('')
    setIdColor('')
    setError('')
    setMensaje('')
  }

  // Cada envío registra una sola combinación; el código lo genera el backend.
  const guardarProducto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMensaje('')
    if (!idModelo || !idTalla || !idColor) {
      setError('Selecciona un modelo, una talla y un color.')
      return
    }
    try {
      setGuardando(true)
      const respuesta = await registrarProductoSku({
        id_modelo: Number(idModelo),
        id_talla: Number(idTalla),
        id_color: Number(idColor)
      })
      setProductos(await obtenerProductosSku())
      setIdModelo('')
      setIdTalla('')
      setIdColor('')
      setMensaje(`${respuesta.mensaje} Código: ${respuesta.producto.codigo_sku}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el producto SKU.')
    } finally {
      setGuardando(false)
    }
  }

  const mostrarDetalle = async (idSku: number) => {
    setError('')
    try {
      setDetalle(await consultarProductoSku(idSku))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar el producto SKU.')
    }
  }

  // Solo cambia el estado; código y variante conservan su identidad.
  const cambiarEstado = async (producto: ProductoSku) => {
    const nuevoEstado = !producto.activo
    if (!window.confirm(
      nuevoEstado
        ? `¿Deseas activar el SKU "${producto.codigo_sku}"?`
        : `¿Deseas desactivar el SKU "${producto.codigo_sku}"?`
    )) return
    setError('')
    setMensaje('')
    try {
      setIdCambiando(producto.id_sku)
      const respuesta = await cambiarEstadoProductoSku(producto.id_sku, nuevoEstado)
      setProductos((actuales) => actuales.map((item) =>
        item.id_sku === producto.id_sku ? { ...item, activo: respuesta.producto.activo } : item
      ))
      setDetalle((actual) => actual?.id_sku === producto.id_sku
        ? { ...actual, activo: respuesta.producto.activo }
        : actual)
      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setIdCambiando(null)
    }
  }

  const productosFiltrados = productos.filter((producto) => {
    const texto = busqueda.trim().toLowerCase()
    const coincideBusqueda = [
      producto.codigo_sku,
      producto.nombre_modelo,
      producto.numero_talla,
      producto.nombre_color
    ].some((valor) => valor.toLowerCase().includes(texto))
    const coincideEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && producto.activo) ||
      (filtroEstado === 'inactivos' && !producto.activo)
    return coincideBusqueda && coincideEstado
  })

  return (
    <div className="min-w-0">
      <div className="min-w-0 space-y-4">
        {/* El formulario conserva el diseño índigo, blanco y gris de Modelos. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Registrar nuevo producto SKU</h2>
            <p className="mt-1 text-sm text-slate-600">Selecciona una combinación activa. Se generará un código único automáticamente.</p>
          </div>
          <form onSubmit={guardarProducto} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label htmlFor="modelo" className="mb-2 block text-sm font-semibold text-slate-800">Modelo *</label>
                <select id="modelo" value={idModelo} onChange={(e) => setIdModelo(e.target.value)} disabled={guardando || cargando} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                  <option value="">Seleccionar modelo</option>
                  {opciones.modelos.map((modelo) => <option key={modelo.id_modelo} value={modelo.id_modelo}>{modelo.nombre_modelo}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="talla" className="mb-2 block text-sm font-semibold text-slate-800">Talla *</label>
                <select id="talla" value={idTalla} onChange={(e) => setIdTalla(e.target.value)} disabled={guardando || cargando} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                  <option value="">Seleccionar talla</option>
                  {opciones.tallas.map((talla) => <option key={talla.id_talla} value={talla.id_talla}>{talla.numero_talla}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="color" className="mb-2 block text-sm font-semibold text-slate-800">Color *</label>
                <select id="color" value={idColor} onChange={(e) => setIdColor(e.target.value)} disabled={guardando || cargando} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                  <option value="">Seleccionar color</option>
                  {opciones.colores.map((color) => <option key={color.id_color} value={color.id_color}>{color.nombre_color}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={limpiarFormulario} disabled={guardando} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Limpiar</button>
              <button type="submit" disabled={guardando || cargando} className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {guardando ? 'Guardando...' : 'Guardar producto SKU'}
              </button>
            </div>
          </form>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {mensaje && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}

        {detalle && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Detalle del producto SKU</h2>
              <button type="button" onClick={() => setDetalle(null)} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">Cerrar</button>
            </div>
            <p className="mt-3 font-semibold text-slate-900">{detalle.codigo_sku}</p>
            <p className="mt-2 text-sm text-slate-600">{detalle.nombre_modelo} · Talla {detalle.numero_talla} · {detalle.nombre_color}</p>
            <p className="mt-2 text-sm text-slate-600">Estado: {detalle.activo ? 'Activo' : 'Inactivo'}</p>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Productos SKU registrados</h2>
              <p className="mt-1 text-sm text-slate-500">{productos.length} productos en el catálogo</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU o variante..." aria-label="Buscar producto SKU" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
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
                  <th className="px-6 py-4 font-semibold">Código SKU</th>
                  <th className="px-6 py-4 font-semibold">Modelo</th>
                  <th className="px-6 py-4 font-semibold">Talla</th>
                  <th className="px-6 py-4 font-semibold">Color</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Cargando productos SKU...</td></tr>
                ) : productosFiltrados.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No se encontraron productos SKU.</td></tr>
                ) : productosFiltrados.map((producto) => (
                  <tr key={producto.id_sku} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{producto.id_sku}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{producto.codigo_sku}</td>
                    <td className="px-6 py-4 text-slate-600">{producto.nombre_modelo}</td>
                    <td className="px-6 py-4 text-slate-600">{producto.numero_talla}</td>
                    <td className="px-6 py-4 text-slate-600">{producto.nombre_color}</td>
                    <td className="px-6 py-4">
                      <span className={producto.activo ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => void mostrarDetalle(producto.id_sku)} className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 transition hover:bg-indigo-50">Consultar</button>
                        <button type="button" onClick={() => void cambiarEstado(producto)} disabled={guardando || idCambiando !== null} className={producto.activo ? 'rounded-lg border border-rose-200 px-3 py-2 font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50' : 'rounded-lg border border-emerald-200 px-3 py-2 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50'}>
                          {idCambiando === producto.id_sku ? 'Procesando...' : producto.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Mostrando {productosFiltrados.length} de {productos.length} productos SKU
          </div>
        </section>
      </div>
    </div>
  )
}
