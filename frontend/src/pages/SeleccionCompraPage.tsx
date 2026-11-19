import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import CuadriculaTallas from '../components/CuadriculaTallas'
import ResumenCostoAdquisicion from '../components/ResumenCostoAdquisicion'
import {
  calcularResumenCostos,
  guardarLineasBorrador,
  obtenerColoresCompra,
  obtenerLineasBorrador,
  obtenerModelosCompra,
  obtenerTallasCompra,
  type ColorCompra,
  type ModeloCompra,
  type TallaCompra
} from '../services/lineaCompraService'
import {
  agregarLineas,
  esCantidadValida,
  formatearTalla,
  lineasIguales,
  quitarLinea,
  resumirPorModelo,
  totalPares,
  type LineaSolicitud
} from '../utils/lineasCompra'

function mensajeDe(error: unknown, porDefecto: string) {
  return error instanceof Error ? error.message : porDefecto
}

/*
HU02: dentro de un borrador, el comprador elige modelo y color, indica cantidades por talla
y guarda las líneas. Ruta: /compras/borrador/:idOrden/productos
*/
export default function SeleccionCompraPage() {
  const idOrden = Number(useParams().idOrden)
  const idValido = Number.isSafeInteger(idOrden) && idOrden > 0
  const clienteConsultas = useQueryClient()

  const [modelos, setModelos] = useState<ModeloCompra[]>([])
  const [colores, setColores] = useState<ColorCompra[]>([])
  const [tallas, setTallas] = useState<TallaCompra[]>([])
  const [idModelo, setIdModelo] = useState('')
  const [idColor, setIdColor] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [lineas, setLineas] = useState<LineaSolicitud[]>([])
  const [guardadas, setGuardadas] = useState<LineaSolicitud[]>([])
  const [estado, setEstado] = useState('')
  const [cargando, setCargando] = useState(idValido)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(idValido ? '' : 'El borrador indicado no es válido.')
  const [mensaje, setMensaje] = useState('')

  const editable = estado === 'BORRADOR'
  const haySinGuardar = !lineasIguales(lineas, guardadas)
  const lineasPedidas = lineas.map(({ id_sku, cantidad }) => ({ id_sku, cantidad }))
  const mostrarResumen = idValido && editable && !cargando && lineasPedidas.length > 0
  const claveResumen = ['resumen-costos-borrador', idOrden]
  const resumenCostos = useQuery({
    queryKey: [...claveResumen, lineasPedidas],
    queryFn: ({ signal }) => calcularResumenCostos(idOrden, lineasPedidas, signal),
    enabled: mostrarResumen,
    gcTime: 0,
    retry: false,
  })

  useEffect(() => {
    if (!idValido) return
    let vigente = true

    Promise.all([obtenerModelosCompra(), obtenerLineasBorrador(idOrden)])
      .then(([datosModelos, borrador]) => {
        if (!vigente) return
        setModelos(datosModelos)
        setEstado(borrador.estado ?? '')
        setLineas(borrador.lineas)
        setGuardadas(borrador.lineas)
      })
      .catch((err: unknown) => { if (vigente) setError(mensajeDe(err, 'No se pudo cargar el borrador.')) })
      .finally(() => { if (vigente) setCargando(false) })

    return () => { vigente = false }
  }, [idOrden, idValido])

  useEffect(() => {
    if (!idModelo) return
    let vigente = true
    obtenerColoresCompra(Number(idModelo))
      .then((datos) => { if (vigente) setColores(datos) })
      .catch((err: unknown) => { if (vigente) setError(mensajeDe(err, 'No se pudieron cargar los colores.')) })
    return () => { vigente = false }
  }, [idModelo])

  useEffect(() => {
    if (!idModelo || !idColor) return
    let vigente = true
    obtenerTallasCompra(Number(idModelo), Number(idColor))
      .then((datos) => { if (vigente) setTallas(datos) })
      .catch((err: unknown) => { if (vigente) setError(mensajeDe(err, 'No se pudieron cargar las tallas.')) })
    return () => { vigente = false }
  }, [idModelo, idColor])

  // El navegador avisa si se recarga o se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!haySinGuardar) return

    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [haySinGuardar])

  // Al cambiar de modelo se descartan el color, las tallas y las cantidades, que ya no corresponden.
  const cambiarModelo = (valor: string) => {
    setIdModelo(valor)
    setIdColor('')
    setColores([])
    setTallas([])
    setCantidades({})
  }

  const cambiarColor = (valor: string) => {
    setIdColor(valor)
    setTallas([])
    setCantidades({})
  }

  const cambiarCantidad = (idSku: number, texto: string) => {
    setCantidades((actuales) => ({ ...actuales, [idSku]: texto }))
  }

  const agregarALaSolicitud = () => {
    setError('')
    setMensaje('')

    const textos = tallas.map((talla) => cantidades[talla.id_sku] ?? '')
    if (textos.some((texto) => !esCantidadValida(texto))) {
      setError('Las cantidades deben ser números enteros mayores o iguales a cero.')
      return
    }

    const modelo = modelos.find((m) => m.id_modelo === Number(idModelo))
    const color = colores.find((c) => c.id_color === Number(idColor))
    if (!modelo || !color) return

    const nuevas: LineaSolicitud[] = tallas
      .map((talla) => ({
        id_sku: talla.id_sku,
        codigo_sku: '',
        nombre_modelo: modelo.nombre_modelo,
        nombre_color: color.nombre_color,
        numero_talla: talla.numero_talla,
        cantidad: Number(cantidades[talla.id_sku] || 0)
      }))
      .filter((linea) => linea.cantidad > 0)

    if (nuevas.length === 0) {
      setError('Indica la cantidad de pares de al menos una talla.')
      return
    }

    setLineas((actuales) => agregarLineas(actuales, nuevas))
    setCantidades({})
  }

  // Guardado manual: agrega únicamente los pares nuevos; el servidor conserva las demás líneas.
  const guardar = async () => {
    setError('')
    setMensaje('')
    try {
      setGuardando(true)
      const resultado = await guardarLineasBorrador(
        idOrden,
        lineas.map(({ id_sku, cantidad }) => ({
          id_sku,
          cantidad: cantidad - (guardadas.find((guardada) => guardada.id_sku === id_sku)?.cantidad ?? 0)
        })).filter((linea) => linea.cantidad > 0)
      )
      setLineas(resultado.lineas)
      setGuardadas(resultado.lineas)
      setMensaje(`${resultado.mensaje} ${resultado.total_pares} pares en ${resultado.lineas.length} líneas.`)
      void clienteConsultas.invalidateQueries({ queryKey: claveResumen })
    } catch (err) {
      setError(mensajeDe(err, 'No se pudieron guardar las líneas.'))
    } finally {
      setGuardando(false)
    }
  }

  const confirmarSalida = (e: React.MouseEvent) => {
    if (haySinGuardar && !window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?')) {
      e.preventDefault()
    }
  }

  const paresPorModelo = resumirPorModelo(lineas)

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Compras</p>
            <h1 className="text-xl font-semibold text-slate-900">
              {idValido ? `Productos del borrador #${idOrden}` : 'Productos del borrador'}
            </h1>
          </div>
          <Link to="/compras" onClick={confirmarSalida} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            Volver a la bandeja
          </Link>
        </header>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {mensaje && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}

        {!cargando && idValido && !editable && estado && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Este documento está en estado {estado}. Solo se pueden modificar las líneas de un borrador.
          </p>
        )}

        {editable && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">Seleccionar modelos y tallas</h2>
            <p className="mt-1 text-sm text-slate-600">Elige un modelo y un color, e indica los pares que necesitas por talla.</p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="modelo" className="mb-2 block text-sm font-semibold text-slate-800">Modelo</label>
                <select id="modelo" value={idModelo} onChange={(e) => cambiarModelo(e.target.value)} disabled={cargando || guardando} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                  <option value="">Seleccionar modelo</option>
                  {modelos.map((modelo) => <option key={modelo.id_modelo} value={modelo.id_modelo}>{modelo.nombre_modelo}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="color" className="mb-2 block text-sm font-semibold text-slate-800">Color</label>
                <select id="color" value={idColor} onChange={(e) => cambiarColor(e.target.value)} disabled={!idModelo || guardando} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                  <option value="">Seleccionar color</option>
                  {colores.map((color) => <option key={color.id_color} value={color.id_color}>{color.nombre_color}</option>)}
                </select>
              </div>
            </div>

            {idColor && (
              <div className="mt-6">
                <CuadriculaTallas tallas={tallas} cantidades={cantidades} deshabilitado={guardando} onCambio={cambiarCantidad} />
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={agregarALaSolicitud} disabled={tallas.length === 0 || guardando} className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    Agregar a la solicitud
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Líneas de la solicitud</h2>
              <p className="mt-1 text-sm text-slate-500">Total general: {totalPares(lineas)} pares en {lineas.length} líneas</p>
              {haySinGuardar && <p className="mt-1 text-sm font-medium text-amber-700">Tienes cambios sin guardar.</p>}
            </div>
            {editable && (
              <button type="button" onClick={() => void guardar()} disabled={!haySinGuardar || guardando} className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {guardando ? 'Guardando...' : 'Guardar líneas'}
              </button>
            )}
          </div>

          {paresPorModelo.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-b border-slate-200 px-6 py-4" aria-label="Pares por modelo">
              {paresPorModelo.map((resumen) => (
                <li key={resumen.nombre_modelo} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {resumen.nombre_modelo}: {resumen.pares} pares
                </li>
              ))}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-indigo-50 text-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Modelo</th>
                  <th className="px-6 py-4 font-semibold">Color</th>
                  <th className="px-6 py-4 font-semibold">Talla</th>
                  <th className="px-6 py-4 font-semibold">Pares</th>
                  {editable && <th className="px-6 py-4 text-right font-semibold">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Cargando borrador...</td></tr>
                ) : lineas.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Aún no agregaste líneas.</td></tr>
                ) : lineas.map((linea) => (
                  <tr key={linea.id_sku} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-600">{linea.nombre_modelo}</td>
                    <td className="px-6 py-4 text-slate-600">{linea.nombre_color}</td>
                    <td className="px-6 py-4 text-slate-600">{formatearTalla(linea.numero_talla)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{linea.cantidad}</td>
                    {editable && (
                      <td className="px-6 py-4 text-right">
                        <button type="button" disabled={guardando || guardadas.some((guardada) => guardada.id_sku === linea.id_sku)} aria-label={`Quitar talla ${formatearTalla(linea.numero_talla)} ${linea.nombre_color}`} onClick={() => setLineas((actuales) => quitarLinea(actuales, linea.id_sku))} className="rounded-lg border border-rose-200 px-3 py-2 font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">Quitar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {mostrarResumen && (
          resumenCostos.data ? (
            <ResumenCostoAdquisicion
              resumen={resumenCostos.data}
              actualizarResumen={async () => { await resumenCostos.refetch({ throwOnError: true }) }}
            />
          ) : resumenCostos.isError ? (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p role="alert">{resumenCostos.error.message}</p>
              <button type="button" className="font-semibold underline" onClick={() => void resumenCostos.refetch()}>
                Reintentar cálculo
              </button>
            </div>
          ) : (
            <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Calculando costos de adquisición…
            </p>
          )
        )}
      </div>
    </div>
  )
}
