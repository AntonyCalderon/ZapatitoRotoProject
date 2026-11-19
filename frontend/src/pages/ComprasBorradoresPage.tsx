import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { crearBorrador, obtenerBorradores, type OrdenCompra } from '../services/ordenCompraService'
import { EstadoCompra, fechaCompra, OpIcon } from '../components/OperacionUI'

export default function ComprasBorradoresPage() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let activo = true
    setCargando(true); setError('')
    obtenerBorradores().then(datos => { if (activo) setOrdenes(datos) }).catch(e => { if (activo) setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.') }).finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [intento])
  const nueva = async () => {
    setCreando(true); setError('')
    try { const {orden} = await crearBorrador(); navigate(`/compras/borrador/${orden.id_orden_compra}`) }
    catch(e) { setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud.') }
    finally { setCreando(false) }
  }
  const texto = busqueda.trim().toLocaleLowerCase('es')
  const filtradas = ordenes.filter(o => [o.id_orden_compra, o.creador, o.proveedor, o.observacion].join(' ').toLocaleLowerCase('es').includes(texto))
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">COMPRAS</p><h1>Solicitudes de compra</h1><p>Prepara tus pedidos y continúa donde los dejaste.</p></div><button className="ops-btn ops-btn-primary" disabled={creando} onClick={() => void nueva()}><OpIcon name="mas" />{creando ? 'Creando…' : 'Nueva solicitud'}</button></div>
    {error && <div className="ops-alert ops-alert-error" role="alert">{error} <button className="ops-text-button" onClick={() => setIntento(n => n + 1)}>Reintentar</button></div>}
    <section className="ops-card">
      <div className="ops-card-heading"><div className="ops-section-title"><span className="ops-section-icon"><OpIcon name="documento" /></span><div><h2>Bandeja de borradores <span className="ops-count">{cargando ? '…' : ordenes.length}</span></h2><p>Solicitudes en preparación</p></div></div><label className="ops-search"><OpIcon name="buscar" /><input aria-label="Buscar solicitudes" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar solicitud, creador…" /></label></div>
      <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>Solicitud</th><th>Estado</th><th>Proveedor</th><th>Creado por</th><th>Fecha de creación</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {cargando ? <tr><td colSpan={6} className="ops-table-empty">Cargando solicitudes…</td></tr> : error ? <tr><td colSpan={6} className="ops-table-empty">No se pudo consultar la bandeja.</td></tr> : filtradas.length === 0 ? <tr><td colSpan={6}><div className="ops-empty-state"><OpIcon name="documento" /><h3>{texto ? 'Sin coincidencias' : 'Tu próxima compra empieza aquí'}</h3><p>{texto ? 'Prueba con otro número o nombre.' : 'Crea una solicitud y agrega los productos que necesitas.'}</p></div></td></tr> : filtradas.map(o => <tr key={o.id_orden_compra}><td><Link className="ops-order-link" to={`/compras/borrador/${o.id_orden_compra}`}>Borrador #{o.id_orden_compra}</Link><small className="ops-row-note">{o.observacion || 'Sin observaciones'}</small></td><td><EstadoCompra estado={o.estado} /></td><td>{o.proveedor || (o.id_proveedor ? `Proveedor #${o.id_proveedor}` : <span className="ops-muted">Por definir</span>)}</td><td>{o.creador || '—'}</td><td className="ops-nowrap">{fechaCompra(o.fecha_creacion)}</td><td><Link className="ops-btn ops-btn-small" aria-label={`Abrir borrador ${o.id_orden_compra}`} to={`/compras/borrador/${o.id_orden_compra}`}>Abrir</Link></td></tr>)}
      </tbody></table></div>
      <div className="ops-table-footer">{cargando ? 'Consultando…' : `${filtradas.length} de ${ordenes.length} solicitudes`}</div>
    </section>
  </>
}
