import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { consultarCompraCerrada, obtenerHistoricoCompras } from '../services/ordenCompraService'
import { fechaCompra, soles } from '../components/OperacionUI'
import '../recepcion.css'

export default function ComprasHistoricoPage() {
  const { idOrden } = useParams()
  const location = useLocation()
  const lista = useQuery({ queryKey: ['compras', 'historico'], queryFn: obtenerHistoricoCompras, enabled: !idOrden, staleTime: 0 })
  const detalle = useQuery({ queryKey: ['compras', 'historico', idOrden], queryFn: () => consultarCompraCerrada(Number(idOrden)), enabled: !!idOrden, staleTime: 0 })
  const consulta = idOrden ? detalle : lista
  const orden = detalle.data?.orden
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">COMPRAS</p><h1>{idOrden ? orden?.codigo || 'Detalle de compra cerrada' : 'Histórico de compras'}</h1><p>Compras finalizadas con sus documentos y trazabilidad.</p></div>
      {idOrden ? <Link className="ops-btn" to="/compras/historico">Volver al histórico</Link> : <button className="ops-btn" onClick={() => void lista.refetch()}>Actualizar histórico</button>}</div>
    {location.state?.mensaje && <p className="ops-alert ops-alert-success" role="status">{location.state.mensaje}</p>}
    {consulta.isPending ? <p role="status">Cargando histórico…</p> : consulta.isError ? <div role="alert" className="ops-alert ops-alert-error">{consulta.error.message} <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button></div> :
      idOrden && orden ? <>
        <section className="ops-card">
          <div className="ops-card-heading"><div><h2>Compra cerrada</h2><p>{orden.documento_emitido.proveedor?.razon_social || orden.proveedor}</p></div><span className="recep-state recep-state-ok">Cerrado</span></div>
          <div className="compra-cierre-auditoria">
            <div><strong>Recepción física</strong><p className="recep-verified">Lote verificado y recibido por Almacén</p><small>{orden.usuario_almacen} · {fechaCompra(orden.fecha_recepcion!)}</small></div>
            <div><strong>Confirmación comercial</strong><p>{orden.usuario_confirma}</p><small>{fechaCompra(orden.fecha_confirmacion!)}</small></div>
            <div><strong>Cierre</strong><p>{orden.usuario_cierre}</p><small>{fechaCompra(orden.fecha_cierre)}</small></div>
          </div>
          <div className="ops-table-scroll"><table className="ops-table" aria-label="Productos de la compra cerrada"><thead><tr><th>SKU</th><th>Modelo</th><th>Color</th><th>Talla</th><th>Pares</th></tr></thead><tbody>{(orden.documento_emitido.lineas || []).map(l => <tr key={l.codigo_sku}><td>{l.codigo_sku}</td><td>{l.nombre_modelo}</td><td>{l.nombre_color}</td><td>{l.numero_talla}</td><td>{l.cantidad}</td></tr>)}</tbody></table></div>
          <div className="ops-table-footer"><span>{orden.documento_emitido.pares} pares · Total {soles(orden.total)}</span><a className="ops-btn ops-btn-small" href={`/api/ordenes-compra/${orden.id_orden_compra}/pdf`}>Descargar PDF</a></div>
        </section>
      </> : <section className="ops-card"><div className="ops-table-scroll"><table className="ops-table" aria-label="Histórico de compras finalizadas"><thead><tr><th>Orden</th><th>Proveedor</th><th>Estado</th><th>Cerrada por</th><th>Fecha de cierre</th><th>Acciones</th></tr></thead><tbody>
        {!lista.data?.length ? <tr><td colSpan={6} className="ops-table-empty">Todavía no hay compras cerradas.</td></tr> : lista.data.map(o => <tr key={o.id_orden_compra}><td><strong>{o.codigo}</strong></td><td>{o.proveedor}</td><td><span className="recep-state recep-state-ok">Cerrado</span></td><td>{o.usuario_cierre}</td><td>{fechaCompra(o.fecha_cierre)}</td><td><div className="ops-draft-actions"><Link className="ops-btn ops-btn-small" to={`/compras/historico/${o.id_orden_compra}`}>Ver detalle</Link><a className="ops-btn ops-btn-small" href={`/api/ordenes-compra/${o.id_orden_compra}/pdf`} aria-label={`Descargar ${o.codigo} PDF`}>PDF</a></div></td></tr>)}
      </tbody></table></div></section>}
  </>
}
