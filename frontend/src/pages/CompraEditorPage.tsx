import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { consultarOrdenCompra, guardarBorrador, type OrdenCompra } from '../services/ordenCompraService'
import { calcularResumenCostos, obtenerLineasBorrador, guardarCambiosLineas } from '../services/lineaCompraService'
import { agregarLineas, formatearTalla, lineasIguales, totalPares, type LineaSolicitud } from '../utils/lineasCompra'
import { useAuthStore } from '../store/authStore'
import { useCambiosOperacion } from '../components/OperacionLayout'
import { EstadoCompra, fechaCompra, OpIcon, soles } from '../components/OperacionUI'
import AgregarProductosDialog from '../components/AgregarProductosDialog'
import CampoCostoFaltante from '../components/CampoCostoFaltante'

export default function CompraEditorPage() {
  const id = Number(useParams().idOrden)
  const valido = Number.isSafeInteger(id) && id > 0 && id <= 2147483647
  const user = useAuthStore(s => s.user)
  const setDirty = useCambiosOperacion()
  const clienteConsultas = useQueryClient()
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [lineas, setLineas] = useState<LineaSolicitud[]>([])
  const [guardadas, setGuardadas] = useState<LineaSolicitud[]>([])
  const [observacion, setObservacion] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editando, setEditando] = useState(false)
  const [cantidadesEditadas, setCantidadesEditadas] = useState<Record<number, string>>({})
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [intento, setIntento] = useState(0)
  const lineasPendientes = !lineasIguales(lineas, guardadas)
  const notasPendientes = orden !== null && observacion !== (orden.observacion ?? '')
  const dirty = lineasPendientes || notasPendientes
  const editable = orden?.estado === 'BORRADOR'
  const cantidadesValidas = lineas.every(l => Number.isInteger(l.cantidad) && l.cantidad > 0 && l.cantidad <= 100000)
  const lineasPedidas = lineas.map(({ id_sku, cantidad }) => ({ id_sku, cantidad }))
  const claveResumen = ['resumen-costos-borrador', id]
  const consultaCostos = useQuery({
    queryKey: [...claveResumen, lineasPedidas],
    queryFn: ({ signal }) => calcularResumenCostos(id, lineasPedidas, signal),
    enabled: valido && orden?.id_orden_compra === id && editable && !cargando && cantidadesValidas && lineas.length > 0,
    retry: false,
    gcTime: 0,
  })
  const resumen = consultaCostos.data
  const costosPorSku = new Map(resumen?.lineas.map(linea => [linea.idSku, linea]))
  async function actualizarResumen() {
    await consultaCostos.refetch({ throwOnError: true })
  }

  useEffect(() => {
    let activo = true
    setCargando(true); setError(''); setMensaje(''); setOrden(null); setLineas([]); setGuardadas([]); setObservacion(''); setEditando(false); setCantidadesEditadas({})
    if (!valido) { setError('El identificador del borrador no es válido.'); setCargando(false); return }
    Promise.all([consultarOrdenCompra(id), obtenerLineasBorrador(id)]).then(([datos, detalle]) => {
      if (!activo) return
      setOrden(datos.orden); setObservacion(datos.orden.observacion ?? ''); setLineas(detalle.lineas); setGuardadas(detalle.lineas)
    }).catch(e => { if (activo) setError(e instanceof Error ? e.message : 'No se pudo abrir el borrador.') }).finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [id, valido, intento])
  useEffect(() => { setDirty(dirty); return () => setDirty(false) }, [dirty, setDirty])
  useEffect(() => {
    if (!dirty) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [dirty])
  const confirmarSalida = (e: React.MouseEvent) => {
    if (ocupado || dirty && !window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?')) e.preventDefault()
  }
  const agregar = (nuevas: LineaSolicitud[]) => {
    const combinadas = agregarLineas(lineas, nuevas)
    if (combinadas.some(l => l.cantidad > 100000)) return 'La cantidad acumulada no puede superar 100000 pares por talla.'
    setLineas(combinadas); setCantidadesEditadas({}); setMensaje(''); return undefined
  }
  const cambiarCantidad = (sku: number, texto: string) => {
    setCantidadesEditadas(actuales => ({ ...actuales, [sku]: texto }))
    setLineas(actuales => actuales.map(l => l.id_sku === sku ? { ...l, cantidad: Number(texto) } : l))
    setMensaje('')
  }
  const quitar = (linea: LineaSolicitud) => {
    const guardada = guardadas.some(g => g.id_sku === linea.id_sku)
    if (guardada && !window.confirm(`¿Quitar ${linea.nombre_modelo}, talla ${formatearTalla(linea.numero_talla)}, del borrador #${id}? Se aplicará al guardar.`)) return
    setLineas(actuales => actuales.filter(l => l.id_sku !== linea.id_sku)); setMensaje('')
  }
  const guardar = async () => {
    if (!orden || !editable || ocupado || !cantidadesValidas) return
    setOcupado(true); setError(''); setMensaje('')
    let productosGuardados = false
    let lineasCompletadas = false
    let confirmadas = guardadas
    try {
      const resultado = await guardarCambiosLineas(id, lineas, guardadas, datos => {
        confirmadas = datos; productosGuardados = true; setGuardadas(datos)
      })
      lineasCompletadas = true
      setLineas(resultado); setGuardadas(resultado); setCantidadesEditadas({})
      void clienteConsultas.invalidateQueries({ queryKey: claveResumen })
      if (notasPendientes) {
        const datos = await guardarBorrador(id, { observacion: observacion.trim() })
        setOrden({ ...orden, ...datos.orden }); setObservacion(datos.orden.observacion ?? '')
      }
      setEditando(false)
      setMensaje('Borrador guardado correctamente.')
    } catch(e) {
      const detalle = e instanceof Error ? e.message : 'No se pudo guardar el borrador.'
      setLineas(actuales => actuales.map(l => { const confirmada = confirmadas.find(c => c.id_sku === l.id_sku); return confirmada ? { ...l, id_detalle_compra: confirmada.id_detalle_compra } : l }))
      setError(productosGuardados ? lineasCompletadas ? `Los productos se guardaron. Las observaciones siguen pendientes: ${detalle}` : `Algunos cambios de productos se guardaron; los pendientes se conservaron. ${detalle}` : detalle)
    } finally { setOcupado(false) }
  }
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">SOLICITUDES DE COMPRA</p><h1>Borrador de compra {orden && <span className="ops-heading-id">#{id}</span>}</h1><p>Organiza los productos y cantidades de tu solicitud.</p></div><Link className="ops-btn" to="/compras" onClick={confirmarSalida}>Volver a solicitudes</Link></div>
    {error && <div className="ops-alert ops-alert-error" role="alert">{error} {!orden && <button className="ops-text-button" onClick={() => setIntento(n => n + 1)}>Reintentar</button>}</div>}
    {mensaje && <p className="ops-alert ops-alert-success" role="status"><OpIcon name="check" />{mensaje}</p>}
    {cargando ? <div className="ops-card ops-loading" role="status">Cargando borrador…</div> : orden && <>
      <section className="ops-card">
        <div className="ops-card-heading"><div className="ops-section-title"><span className="ops-section-icon"><OpIcon name="documento" /></span><div><h2>Datos de la solicitud</h2><p>Identificador interno #{id}</p></div></div><EstadoCompra estado={orden.estado} /></div>
        <dl className="ops-order-meta"><div><dt>Creado por</dt><dd>{orden.creador || (orden.id_usuario_creador === user?.id_usuario ? user.nombre : `Usuario #${orden.id_usuario_creador}`)}</dd></div><div><dt>Fecha de creación</dt><dd>{fechaCompra(orden.fecha_creacion)}</dd></div><div><dt>Proveedor</dt><dd>{orden.proveedor || (orden.id_proveedor ? `Proveedor #${orden.id_proveedor}` : <span className="ops-muted">Por definir</span>)}</dd></div><div><dt>Código oficial</dt><dd>{orden.codigo || <span className="ops-muted">Pendiente de emisión</span>}</dd></div></dl>
      </section>
      <section className="ops-card ops-editor-card">
        <div className="ops-card-heading"><div><h2>Detalle de productos <span className="ops-count">{lineas.length}</span></h2><p>Modelo, color y cantidad de pares por talla.</p></div>{editable && <div className="ops-draft-actions"><button className="ops-btn" disabled={ocupado || editando && !cantidadesValidas} aria-pressed={editando} onClick={() => setEditando(valor => !valor)}>{editando ? 'Finalizar edición' : 'Modificar borrador'}</button><button className="ops-btn ops-btn-accent" disabled={ocupado || !cantidadesValidas} onClick={() => setDialog(true)}><OpIcon name="mas" />Agregar productos</button></div>}</div>
        <div className="ops-table-scroll"><table className="ops-table ops-product-table"><thead><tr><th>Modelo</th><th>Color</th><th>Talla</th><th className="ops-number">Cantidad</th><th className="ops-number">Costo unitario</th><th className="ops-number">Subtotal</th><th className="ops-center">Acciones</th></tr></thead><tbody>
          {!lineas.length ? <tr><td colSpan={7}><div className="ops-empty-state"><OpIcon name="caja" /><h3>Agrega los productos de tu compra</h3><p>Selecciona modelo, color y tallas para empezar.<br />Puedes guardar una solicitud incompleta.</p></div></td></tr> : lineas.map(l => {
            const existente = guardadas.find(g => g.id_sku === l.id_sku)
            const pendiente = l.cantidad !== (existente?.cantidad ?? 0)
            const costo = costosPorSku.get(l.id_sku)
            const costoUnitario = editable ? costo?.costoUnitario : l.costo_unitario
            const importe = editable ? costo?.importe : l.importe
            return <tr key={l.id_sku}>
              <td><strong>{l.nombre_modelo}</strong>{l.codigo_sku && <small className="ops-row-note">{l.codigo_sku}</small>}</td>
              <td>{l.nombre_color}</td>
              <td><span className="ops-size-badge">{formatearTalla(l.numero_talla)}</span></td>
              <td className="ops-number">{editable && editando ? <input className="ops-edit-quantity" aria-label={`Cantidad de ${l.nombre_modelo}, talla ${formatearTalla(l.numero_talla)}, ${l.nombre_color}`} type="number" min={1} max={100000} step={1} value={cantidadesEditadas[l.id_sku] ?? String(l.cantidad)} disabled={ocupado} onChange={e => cambiarCantidad(l.id_sku, e.target.value)} aria-invalid={!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 100000} /> : <strong>{l.cantidad}</strong>}<small className="ops-row-note">pares</small></td>
              <td className={`ops-number ${costoUnitario == null ? 'ops-pending' : ''}`}>
                {editable && costoUnitario === null
                  ? <CampoCostoFaltante idSku={l.id_sku} actualizarResumen={actualizarResumen} />
                  : costoUnitario == null ? '—' : soles(costoUnitario)}
              </td>
              <td className={`ops-number ${importe == null ? 'ops-pending' : ''}`}>{importe == null ? '—' : soles(importe)}</td>
              <td className="ops-center">{editable && editando ? <button className="ops-btn ops-btn-small ops-btn-cancel" aria-label={`Quitar ${l.nombre_modelo}, talla ${formatearTalla(l.numero_talla)}, ${l.nombre_color}`} disabled={ocupado} onClick={() => quitar(l)}>Quitar</button> : pendiente ? <div className="ops-pending-actions"><span className="ops-pending-label">Sin guardar</span><button className="ops-icon-button" disabled={ocupado} aria-label={`Retirar selección talla ${formatearTalla(l.numero_talla)} ${l.nombre_color}`} onClick={() => setLineas(ls => existente ? ls.map(a => a.id_sku === l.id_sku ? existente : a) : ls.filter(a => a.id_sku !== l.id_sku))}><OpIcon name="quitar" /></button></div> : <span className="ops-saved"><OpIcon name="check" />Guardado</span>}</td>
            </tr>
          })}
        </tbody></table></div>
        {!cantidadesValidas && <p className="ops-alert ops-alert-error" role="alert">Las cantidades deben ser enteros entre 1 y 100000 pares.</p>}
        <div className="ops-order-bottom">
          <label className="ops-field ops-notes">Observaciones <span className="ops-optional">Opcional</span><textarea maxLength={500} rows={3} disabled={!editable || ocupado} value={observacion} onChange={e => { setObservacion(e.target.value); setMensaje('') }} placeholder="Añade una nota para esta solicitud…" /><span className="ops-character-count">{observacion.length}/500</span></label>
          <section className="ops-order-summary" aria-label="Resumen de costos de adquisición">
            <div><span>Total de pares</span><strong>{totalPares(lineas)}</strong></div>
            <div><span>Líneas de producto</span><strong>{lineas.length}</strong></div>
            {resumen && <>
              <div><span>{resumen.total === null ? 'Subtotal conocido' : 'Subtotal'}</span><strong>{soles(resumen.subtotalConocido)}</strong></div>
              <div><span>IGV</span><strong>{resumen.igv === null ? 'Por calcular' : soles(resumen.igv)}</strong></div>
            </>}
            <div className="ops-grand-total">
              <span>Total de adquisición</span>
              <strong>{editable ? resumen && !consultaCostos.isError ? soles(resumen.total) : '—' : soles(orden.total)}</strong>
            </div>
            {consultaCostos.isFetching && <p role="status">Calculando costos…</p>}
            {consultaCostos.isError && <p role="alert">{consultaCostos.error.message} <button className="ops-text-button" onClick={() => void consultaCostos.refetch()}>Reintentar cálculo</button></p>}
            {resumen?.total === null && <p>Registra los costos faltantes para obtener el total.</p>}
          </section>
        </div>
        <div className="ops-card-actions"><span className={`ops-save-status ${dirty ? 'is-dirty' : ''}`}><OpIcon name={dirty ? 'reloj' : 'check'} />{dirty ? 'Tienes cambios sin guardar' : 'Todos los cambios guardados'}</span>{editable && <div className="ops-draft-actions">{lineasPendientes && <button className="ops-btn" disabled={ocupado} onClick={() => { setLineas(guardadas); setCantidadesEditadas({}); setMensaje('') }}>Deshacer cambios de productos</button>}<button className="ops-btn ops-btn-primary" disabled={ocupado || !dirty || !cantidadesValidas} onClick={() => void guardar()}><OpIcon name="guardar" />{ocupado ? 'Guardando…' : 'Guardar borrador'}</button></div>}</div>
      </section>
    </>}
    {dialog && <AgregarProductosDialog cerrar={() => setDialog(false)} agregar={agregar} />}
  </>
}
