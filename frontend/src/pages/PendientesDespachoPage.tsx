import { useEffect, useState } from 'react' // NUEVO: useEffect y useState
import { useMutation, useQuery } from '@tanstack/react-query' // NUEVO: useMutation
import { Link, useParams } from 'react-router-dom'
import { OpIcon } from '../components/OperacionUI'
import {
  consultarDespacho, listarDespachos, registrarSalida, // NUEVO: registrarSalida
  type DespachoPendiente, type DetalleDespacho, type SalidaRegistrada, // NUEVO: SalidaRegistrada
} from '../services/despachoService'
import { useAuthStore } from '../store/authStore'
import { formatearTalla } from '../utils/lineasCompra'

const rutaCola = '/almacen/pendientes-despacho'
const tarjeta = 'rounded-2xl border border-slate-200 bg-white shadow-sm'
const boton = 'inline-flex rounded-lg border border-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50'
const celda = 'px-5 py-4'
const fechaLima = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
})

function comprobante(despacho: DespachoPendiente) {
  const { tipo_comprobante: tipo, serie_comprobante: serie, numero_comprobante: numero } = despacho
  return serie && numero ? [tipo, `${serie}-${numero}`].filter(Boolean).join(' ') : 'Por confirmar'
}

function Bandeja({ despachos }: { despachos: DespachoPendiente[] }) {
  return (
    <section className={tarjeta} aria-labelledby="titulo-cola-despachos">
      <header className="flex items-center gap-3 px-5 py-5">
        <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><OpIcon name="caja" /></span>
        <div>
          <h2 id="titulo-cola-despachos" className="font-semibold text-slate-900">Órdenes pendientes</h2>
          <p className="mt-1 text-sm text-slate-600">Las órdenes más antiguas aparecen primero.</p>
        </div>
      </header>
      {despachos.length === 0 ? (
        <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-600">
          No hay órdenes pendientes de despacho.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-b-2xl">
          <table aria-label="Órdenes pendientes de despacho" className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-indigo-50 text-slate-700">
              <tr>
                {['Despacho', 'Comprobante', 'Cliente', 'Dirección', 'Fecha de emisión', 'Acción'].map(titulo => (
                  <th key={titulo} scope="col" className={celda}>{titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {despachos.map(despacho => (
                <tr key={despacho.id_orden_despacho} className="hover:bg-slate-50">
                  <th scope="row" className={`${celda} font-medium text-slate-900`}>{despacho.codigo}</th>
                  <td className={celda}>{comprobante(despacho)}</td>
                  <td className={celda}>{despacho.cliente}</td>
                  <td className={`${celda} break-words`}>{despacho.direccion || 'Por confirmar'}</td>
                  <td className={`${celda} whitespace-nowrap`}>
                    <time dateTime={despacho.fecha_emision}>{fechaLima.format(new Date(despacho.fecha_emision))}</time>
                  </td>
                  <td className={celda}>
                    <Link className={boton} to={`${rutaCola}/${despacho.id_orden_despacho}`}
                      aria-label={`Consultar despacho ${despacho.codigo}`}>
                      Consultar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// NUEVO: propiedades para registrar la salida desde el detalle del pedido.
interface AccionSalida {
  puedeRegistrar: boolean
  registrando: boolean
  error: string
  onConfirmar: () => void
}

function Pedido({ despacho, salida }: { despacho: DetalleDespacho; salida: AccionSalida }) {
  // NUEVO: la confirmación se muestra dentro de la misma pantalla.
  const [confirmando, setConfirmando] = useState(false)
  const pares = despacho.productos.reduce((total, producto) => total + producto.cantidad, 0)

  return (
    <section className={tarjeta} aria-labelledby="titulo-detalle-despacho">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
        <h2 id="titulo-detalle-despacho" className="font-semibold text-slate-900">Despacho {despacho.codigo}</h2>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
          Pendiente de despacho
        </span>
      </header>
      <dl className="grid gap-4 border-t border-slate-100 px-5 py-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Comprobante', comprobante(despacho)],
          ['Cliente', despacho.cliente],
          ['Dirección', despacho.direccion || 'Por confirmar'],
          ['Fecha de emisión', fechaLima.format(new Date(despacho.fecha_emision))],
        ].map(([etiqueta, dato]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-slate-600">{etiqueta}</dt>
            <dd className="mt-1 break-words font-medium text-slate-900">{dato}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto rounded-b-2xl border-t border-slate-100">
        <table aria-label="Productos del despacho" className="w-full min-w-[360px] text-left text-sm">
          <thead className="bg-indigo-50 text-slate-700">
            <tr>
              {['Modelo', 'Color', 'Talla', 'Cantidad'].map(titulo => (
                <th key={titulo} scope="col" className={celda}>{titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {despacho.productos.map(producto => (
              <tr key={producto.id_sku}>
                <th scope="row" className={`${celda} font-medium text-slate-900`}>{producto.modelo}</th>
                <td className={celda}>{producto.color}</td>
                <td className={celda}>{formatearTalla(producto.talla)}</td>
                <td className={celda}>{producto.cantidad}</td>
              </tr>
            ))}
            {despacho.productos.length === 0 && (
              <tr><td colSpan={4} className={celda}>Este despacho aún no tiene productos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NUEVO: HU19. Botón "Registrar salida" con confirmación. Solo para el rol Almacén. */}
      {salida.puedeRegistrar && despacho.productos.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-5">
          {salida.error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{salida.error}</p>
          )}

          {!confirmando ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={salida.registrando}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Registrar salida
              </button>
            </div>
          ) : (
            <div role="group" aria-label="Confirmar salida física" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                ¿Confirmas la salida física del despacho <strong>{despacho.codigo}</strong>? Se descontarán{' '}
                <strong>{pares}</strong> {pares === 1 ? 'par' : 'pares'} del inventario y el pedido quedará
                despachado. Esta acción no se puede deshacer.
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={salida.registrando}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmando(false); salida.onConfirmar() }}
                  disabled={salida.registrando}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {salida.registrando ? 'Registrando...' : 'Confirmar salida'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function PendientesDespachoPage() {
  const { idDespacho } = useParams()
  const esAdmin = useAuthStore(s => s.user?.roles.includes('Administrador'))
  // NUEVO: solo el Encargado de Almacén puede registrar la salida (RN-01).
  const puedeRegistrar = useAuthStore(s => s.user?.roles.includes('Almacen') ?? false)
  // NUEVO: guarda el resultado cuando la salida ya se registró.
  const [salidaRegistrada, setSalidaRegistrada] = useState<SalidaRegistrada | null>(null)

  const consulta = useQuery<{ despacho: DetalleDespacho } | { despachos: DespachoPendiente[] }>({
    queryKey: ['pendientes-despacho', idDespacho],
    queryFn: ({ signal }) => idDespacho ? consultarDespacho(idDespacho, signal) : listarDespachos(signal),
    retry: false,
    gcTime: 0,
    // NUEVO: tras registrar la salida el despacho sale de la bandeja; no volvemos a consultarlo.
    enabled: salidaRegistrada === null,
  })

  // NUEVO: la mutación evita repetir la petición mientras está en curso (doble clic).
  const registrar = useMutation({
    mutationFn: (id: number) => registrarSalida(id),
    onSuccess: datos => setSalidaRegistrada(datos),
  })

  // NUEVO: al cambiar de despacho se limpian el resultado y el error anteriores.
  useEffect(() => {
    setSalidaRegistrada(null)
    registrar.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDespacho])

  // NUEVO: separamos el detalle y la bandeja fuera del JSX para que TypeScript
  // conserve el tipo correcto dentro de las funciones (onConfirmar).
  const datos = consulta.isSuccess ? consulta.data : undefined
  const detalle = datos && 'despacho' in datos ? datos.despacho : undefined
  const bandeja = datos && 'despachos' in datos ? datos.despachos : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!esAdmin && <h1 className="text-2xl font-bold text-slate-900">Pendientes de despacho</h1>}
        {idDespacho && <Link className={boton} to={rutaCola}>Volver a pendientes</Link>}
      </div>

      {/* NUEVO: confirmación cuando la salida se registró correctamente. */}
      {salidaRegistrada && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">{salidaRegistrada.mensaje}</p>
          <p className="mt-1">
            Despacho {salidaRegistrada.despacho.codigo}:{' '}
            {salidaRegistrada.movimientos.reduce((total, m) => total + m.cantidad, 0)} pares descontados del inventario.
          </p>
        </div>
      )}

      {!salidaRegistrada && consulta.isPending && <p role="status" className={`${tarjeta} p-5 text-sm text-slate-600`}>Consultando despachos…</p>}
      {!salidaRegistrada && consulta.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          <p>{consulta.error.message}</p>
          <button className={boton} type="button" onClick={() => void consulta.refetch()}>Reintentar</button>
        </div>
      )}
      {!salidaRegistrada && detalle && (
        <Pedido
          despacho={detalle}
          salida={{
            puedeRegistrar,
            registrando: registrar.isPending,
            error: registrar.isError ? registrar.error.message : '',
            onConfirmar: () => registrar.mutate(detalle.id_orden_despacho),
          }}
        />
      )}
      {!salidaRegistrada && bandeja && <Bandeja despachos={bandeja} />}
    </div>
  )
}