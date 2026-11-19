import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { confirmarEmision, revisarEmision, obtenerProveedores, type OrigenCompra, consultarOrdenCompra, guardarBorrador, type OrdenCompra } from '../services/ordenCompraService'
import { obtenerLineasBorrador, guardarLineasBorrador } from '../services/lineaCompraService'
import { agregarLineas, formatearTalla, lineasIguales, totalPares, type LineaSolicitud } from '../utils/lineasCompra'
import { useAuthStore } from '../store/authStore'
import { useCambiosOperacion } from '../components/OperacionLayout'
import { EstadoCompra, fechaCompra, OpIcon, soles } from '../components/OperacionUI'
import AgregarProductosDialog from '../components/AgregarProductosDialog'

export default function CompraEditorPage() {
  const id = Number(useParams().idOrden)
  const navigate = useNavigate()
  const [proveedor, setProveedor] = useState<number | null>(null)
  const [proveedores, setProveedores] = useState<Awaited<ReturnType<typeof obtenerProveedores>>>([])
  const [origenes, setOrigenes] = useState<OrigenCompra[]>([])
  useEffect(() => {
    let activo = true
    obtenerProveedores().then(items => { if (activo) setProveedores(items) })
      .catch(e => { if (activo) setError(e.message) })
    return () => { activo = false }
  }, [])
  const valido = Number.isSafeInteger(id) && id > 0 && id <= 2147483647
  const user = useAuthStore(s => s.user)
  const setDirty = useCambiosOperacion()
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [lineas, setLineas] = useState<LineaSolicitud[]>([])
  const [guardadas, setGuardadas] = useState<LineaSolicitud[]>([])
  const [observacion, setObservacion] = useState('')
  const [dialog, setDialog] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [intento, setIntento] = useState(0)
  const lineasPendientes = !lineasIguales(lineas, guardadas)
  const notasPendientes = orden !== null && observacion !== (orden.observacion ?? '')
  const proveedorPendiente = orden !== null && proveedor !== orden.id_proveedor
  const dirty = lineasPendientes || notasPendientes || proveedorPendiente
  const editable = orden?.estado === 'BORRADOR'
  useEffect(() => {
    let activo = true
    setCargando(true); setError(''); setMensaje(''); setOrden(null); setLineas([]); setGuardadas([]); setObservacion('')
    if (!valido) { setError('El identificador del borrador no es válido.'); setCargando(false); return }
    Promise.all([consultarOrdenCompra(id), obtenerLineasBorrador(id)]).then(([datos, detalle]) => {
      if (!activo) return
      setOrigenes([]); setProveedor(datos.orden.id_proveedor); setOrden(datos.orden); setObservacion(datos.orden.observacion ?? ''); setLineas(detalle.lineas); setGuardadas(detalle.lineas)
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
    setLineas(combinadas); setMensaje(''); return undefined
  }
  const guardar = async () => {
    if (!orden || !editable || ocupado) return
    setOcupado(true); setError(''); setMensaje('')
    let productosGuardados = false
    try {
      const nuevas = lineas.map(l => ({ id_sku: l.id_sku, cantidad: l.cantidad - (guardadas.find(g => g.id_sku === l.id_sku)?.cantidad ?? 0) })).filter(l => l.cantidad > 0)
      if (nuevas.length) {
        const datos = await guardarLineasBorrador(id, nuevas)
        // Actualizar inmediatamente: si falla después la observación, reintentar
        // no debe volver a sumar pares que el servidor ya confirmó.
        setLineas(datos.lineas); setGuardadas(datos.lineas); productosGuardados = true
      }
      if (notasPendientes || proveedorPendiente) {
        const datos = await guardarBorrador(id, { ...(notasPendientes && { observacion: observacion.trim() }), ...(proveedorPendiente && { id_proveedor: proveedor }) })
        setOrden({ ...orden, ...datos.orden }); setObservacion(datos.orden.observacion ?? '')
      }
      setMensaje('Borrador guardado correctamente.')
    } catch(e) {
      const detalle = e instanceof Error ? e.message : 'No se pudo guardar el borrador.'
      setError(productosGuardados ? `Los productos se guardaron. Las observaciones siguen pendientes: ${detalle}` : detalle)
    } finally { setOcupado(false) }
  }
  const emitir = async () => {
    if (!orden || ocupado) return
    setMensaje('')
    setError('')
    if (dirty) { setError('Guarda los cambios antes de emitir.'); return }
    setOcupado(true)
    try {
      const id = orden.id_orden_compra
      const revision = await revisarEmision(id)
      if (revision.avisos.length) { setError(revision.avisos.join(' ')); return }
      const cambios = revision.lineas.filter(l => l.anterior !== null && l.anterior !== l.costo)
        .map(l => l.codigo_sku + ': S/ ' + l.anterior + ' → S/ ' + l.costo)
      const resumen = [revision.proveedor?.razon_social, revision.pares + ' pares',
        'Subtotal S/ ' + revision.subtotal, 'Total S/ ' + revision.total,
        ...cambios, '¿Confirmas la emisión de la orden?'].join('\n')
      if (!window.confirm(resumen)) return
      await confirmarEmision(id, revision.version, origenes)
      navigate('/compras')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo emitir la orden.')
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
      {editable && <section className="ops-card ops-editor-card">
        <label className="ops-field">Proveedor de la orden
          <select value={proveedor ?? ''} disabled={ocupado} onChange={e => setProveedor(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Seleccionar proveedor</option>
            {proveedores.map(p => <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>)}
          </select>
        </label>
            <fieldset disabled={ocupado} className="mt-4 space-y-2">
              <legend className="text-sm font-semibold">Referencias internas para la emisión</legend>
              {origenes.map((origen, i) => <div key={i} className="flex flex-wrap gap-2">
                <select aria-label={'Tipo de origen ' + (i + 1)} value={origen.tipo}
                  onChange={e => setOrigenes(origenes.map((o,j) => j === i ? { ...o, tipo:e.target.value } : o))}>
                  {['Pedido','Contrato','Licitacion','Reposicion'].map(t => <option key={t}>{t}</option>)}
                </select>
                <input aria-label={'Referencia ' + (i + 1)} placeholder="Referencia" maxLength={80}
                  className="rounded border px-2" value={origen.referencia}
                  onChange={e => setOrigenes(origenes.map((o,j) => j === i ? { ...o, referencia:e.target.value } : o))}/>
                <button type="button" onClick={() => setOrigenes(origenes.filter((_,j) => j !== i))}>Quitar</button>
              </div>)}
              <button type="button" className="text-sm text-indigo-700 underline"
                onClick={() => setOrigenes([...origenes,{tipo:'Pedido',referencia:''}])}>Añadir referencia</button>
            </fieldset>
        <button className="ops-btn ops-btn-primary" disabled={ocupado} onClick={() => void emitir()}>Revisar y emitir orden</button>
      </section>}
      <section className="ops-card ops-editor-card">
        <div className="ops-card-heading"><div><h2>Detalle de productos <span className="ops-count">{lineas.length}</span></h2><p>Modelo, color y cantidad de pares por talla.</p></div>{editable && <button className="ops-btn ops-btn-accent" disabled={ocupado} onClick={() => setDialog(true)}><OpIcon name="mas" />Agregar productos</button>}</div>
        <div className="ops-table-scroll"><table className="ops-table ops-product-table"><thead><tr><th>Modelo</th><th>Color</th><th>Talla</th><th className="ops-number">Cantidad</th><th className="ops-number">Costo unitario</th><th className="ops-number">Subtotal</th><th className="ops-center">Registro</th></tr></thead><tbody>
          {!lineas.length ? <tr><td colSpan={7}><div className="ops-empty-state"><OpIcon name="caja" /><h3>Agrega los productos de tu compra</h3><p>Selecciona modelo, color y tallas para empezar.<br />Puedes guardar una solicitud incompleta.</p></div></td></tr> : lineas.map(l => {
            const existente = guardadas.find(g => g.id_sku === l.id_sku)
            const pendiente = l.cantidad !== (existente?.cantidad ?? 0)
            return <tr key={l.id_sku}><td><strong>{l.nombre_modelo}</strong>{l.codigo_sku && <small className="ops-row-note">{l.codigo_sku}</small>}</td><td>{l.nombre_color}</td><td><span className="ops-size-badge">{formatearTalla(l.numero_talla)}</span></td><td className="ops-number"><strong>{l.cantidad}</strong><small className="ops-row-note">pares</small></td><td className={`ops-number ${l.costo_unitario == null ? 'ops-pending' : ''}`}>{soles(l.costo_unitario)}</td><td className={`ops-number ${l.importe == null || pendiente ? 'ops-pending' : ''}`}>{soles(pendiente ? null : l.importe)}</td><td className="ops-center">{pendiente ? <div className="ops-pending-actions"><span className="ops-pending-label">Sin guardar</span><button className="ops-icon-button" disabled={ocupado} aria-label={`Retirar selección talla ${formatearTalla(l.numero_talla)} ${l.nombre_color}`} onClick={() => setLineas(ls => existente ? ls.map(a => a.id_sku === l.id_sku ? existente : a) : ls.filter(a => a.id_sku !== l.id_sku))}><OpIcon name="quitar" /></button></div> : <span className="ops-saved"><OpIcon name="check" />Guardado</span>}</td></tr>
          })}
        </tbody></table></div>
        <div className="ops-order-bottom"><label className="ops-field ops-notes">Observaciones <span className="ops-optional">Opcional</span><textarea maxLength={500} rows={3} disabled={!editable || ocupado} value={observacion} onChange={e => { setObservacion(e.target.value); setMensaje('') }} placeholder="Añade una nota para esta solicitud…" /><span className="ops-character-count">{observacion.length}/500</span></label><div className="ops-order-summary"><div><span>Total de pares</span><strong>{totalPares(lineas)}</strong></div><div><span>Líneas de producto</span><strong>{lineas.length}</strong></div><div className="ops-grand-total"><span>Total de adquisición</span><strong>{soles(lineasPendientes ? null : orden.total)}</strong></div>{(orden.total == null || lineasPendientes) && <p>Los importes pendientes aún no se incluyen en un total.</p>}</div></div>
        <div className="ops-card-actions"><span className={`ops-save-status ${dirty ? 'is-dirty' : ''}`}><OpIcon name={dirty ? 'reloj' : 'check'} />{dirty ? 'Tienes cambios sin guardar' : 'Todos los cambios guardados'}</span>{editable && <button className="ops-btn ops-btn-primary" disabled={ocupado || !dirty} onClick={() => void guardar()}><OpIcon name="guardar" />{ocupado ? 'Guardando…' : 'Guardar borrador'}</button>}</div>
      </section>
    </>}
    {dialog && <AgregarProductosDialog cerrar={() => setDialog(false)} agregar={agregar} />}
  </>
}
