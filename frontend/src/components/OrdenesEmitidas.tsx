import { useEffect, useRef, useState } from 'react'
import { cerrarOrdenCompra, confirmarCompraComercialmente, type OrdenEmitida } from '../services/ordenCompraService'
import '../recepcion.css'

const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })
type Props = { ordenes: OrdenEmitida[]; actualizar: () => void; alCerrar?: (codigo: string) => void }

export default function OrdenesEmitidas({ ordenes, actualizar, alCerrar }: Props) {
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [seleccionada, setSeleccionada] = useState<OrdenEmitida | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const ejecutando = useRef(false)

  async function confirmar(orden: OrdenEmitida) {
    if (ejecutando.current || !orden.lote_verificado || orden.fecha_confirmacion) return
    if (!window.confirm(`¿Confirmar comercialmente ${orden.codigo}? Almacén ya verificó el lote. Esta acción no modifica las existencias.`)) return
    ejecutando.current = true
    setOcupada(orden.id_orden_compra); setError(''); setMensaje('')
    try {
      await confirmarCompraComercialmente(orden.id_orden_compra)
      setMensaje(`Confirmación comercial registrada para ${orden.codigo}.`)
      actualizar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra.')
      actualizar()
    } finally { ejecutando.current = false; setOcupada(null) }
  }

  async function cerrar() {
    if (!seleccionada || ejecutando.current) return
    ejecutando.current = true
    setOcupada(seleccionada.id_orden_compra); setError(''); setMensaje('')
    try {
      await cerrarOrdenCompra(seleccionada.id_orden_compra)
      setSeleccionada(null)
      actualizar()
      alCerrar?.(seleccionada.codigo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar la orden.')
    } finally { ejecutando.current = false; setOcupada(null) }
  }

  return <section className="ops-card recep-card">
    <div className="ops-card-heading"><div><h2>Seguimiento de órdenes</h2><p>Recepción física, confirmación comercial y cierre.</p></div><button type="button" className="ops-btn ops-btn-small" onClick={actualizar} disabled={ocupada !== null}>Actualizar emitidas</button></div>
    {error && !seleccionada && <p className="ops-alert ops-alert-error" role="alert">{error}</p>}
    {mensaje && <p className="ops-alert ops-alert-success" role="status">{mensaje}</p>}
    <div className="ops-table-scroll"><table className="ops-table recep-commercial" aria-label="Órdenes emitidas y recepción"><thead><tr><th>Orden</th><th>Situación logística</th><th>Verificación de Almacén</th><th>Confirmación comercial</th><th>Acciones</th></tr></thead><tbody>{ordenes.map(o => <tr key={o.id_orden_compra}>
      <td><strong>{o.codigo}</strong><small className="ops-row-note">Emitida · {o.proveedor || 'Proveedor'}</small></td>
      <td><span className={`recep-state ${o.lote_verificado ? 'recep-state-ok' : ''}`}>{o.lote_verificado ? 'Recibida' : 'En tránsito'}</span></td>
      <td>{o.lote_verificado ? <><span className="recep-verified">● Lote verificado y recibido por Almacén</span><small className="ops-row-note">{o.usuario_almacen} · {o.fecha_recepcion ? fecha.format(new Date(o.fecha_recepcion)) : ''}</small></> : <span className="ops-muted">Pendiente de recepción física</span>}</td>
      <td>{o.fecha_confirmacion ? <><span className="recep-verified">Confirmada</span><small className="ops-row-note">{o.usuario_confirma} · {fecha.format(new Date(o.fecha_confirmacion))}</small></> : <button type="button" className="ops-btn ops-btn-small" disabled={!o.lote_verificado || ocupada !== null} aria-label={`Confirmar comercialmente ${o.codigo}`} onClick={() => void confirmar(o)}>Confirmar comercialmente</button>}</td>
      <td><div className="compra-cierre-acciones"><a className="ops-btn ops-btn-small" href={`/api/ordenes-compra/${o.id_orden_compra}/pdf`} aria-label={`Descargar ${o.codigo} PDF`}>PDF</a><button type="button" className="ops-btn ops-btn-primary ops-btn-small" disabled={!o.lote_verificado || !o.fecha_confirmacion || ocupada !== null} aria-label={`Cerrar orden ${o.codigo}`} onClick={() => { setError(''); setSeleccionada(o) }}>Cerrar orden</button></div>{(!o.lote_verificado || !o.fecha_confirmacion) && <small className="ops-row-note">Requiere recepción y confirmación</small>}</td>
    </tr>)}</tbody></table></div>
    {seleccionada && <ConfirmacionCierre orden={seleccionada} ocupado={ocupada !== null} error={error} volver={() => { if (!ejecutando.current) setSeleccionada(null) }} confirmar={() => void cerrar()} />}
  </section>
}

function ConfirmacionCierre({ orden, ocupado, error, volver, confirmar }: { orden: OrdenEmitida; ocupado: boolean; error: string; volver: () => void; confirmar: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    contenedor.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => anterior?.focus()
  }, [])
  return <div className="ops-dialog-backdrop"><div ref={contenedor} className="ops-dialog compra-cierre-dialog" role="dialog" aria-modal="true" aria-labelledby="titulo-cierre" onKeyDown={e => {
    if (e.key === 'Escape' && !ocupado) volver()
    if (e.key === 'Tab') {
      const botones = Array.from(contenedor.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      if (!botones.length) { e.preventDefault(); return }
      const primero = botones[0], ultimo = botones[botones.length - 1]
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }
  }}>
    <div className="ops-dialog-body"><h2 id="titulo-cierre">Cerrar {orden.codigo}</h2><p>Almacén verificó el lote y Compras confirmó su recepción.</p><p>La orden pasará al Histórico con estado Cerrado. Se conservarán el documento y su trazabilidad.</p><p className="ops-muted">El cierre no modifica el stock ni los importes.</p>{error && <p className="ops-alert ops-alert-error" role="alert">{error}</p>}</div>
    <div className="ops-card-actions"><button type="button" className="ops-btn" disabled={ocupado} onClick={volver}>Volver</button><button type="button" className="ops-btn ops-btn-primary" disabled={ocupado} onClick={confirmar}>{ocupado ? 'Cerrando…' : 'Cerrar y archivar'}</button></div>
  </div></div>
}
