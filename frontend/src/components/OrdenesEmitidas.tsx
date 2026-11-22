import { useState } from 'react'
import { confirmarCompraComercialmente,type OrdenEmitida } from '../services/ordenCompraService'
import '../recepcion.css'
const fecha=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})
export default function OrdenesEmitidas({ordenes,actualizar}:{ordenes:OrdenEmitida[];actualizar:()=>void}) {
  const [confirmando,setConfirmando]=useState<number|null>(null),[error,setError]=useState(''),[mensaje,setMensaje]=useState('')
  async function confirmar(o:OrdenEmitida) {
    if(confirmando!==null||!o.lote_verificado||o.fecha_confirmacion)return
    if(!window.confirm(`¿Confirmar comercialmente ${o.codigo}? Almacén ya verificó el lote. Esta acción no modifica las existencias.`))return
    setConfirmando(o.id_orden_compra);setError('');setMensaje('')
    try{await confirmarCompraComercialmente(o.id_orden_compra);setMensaje(`Confirmación comercial registrada para ${o.codigo}.`);actualizar()}
    catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar la compra.');actualizar()}
    finally{setConfirmando(null)}
  }
  return <section className="ops-card recep-card">
    <div className="ops-card-heading"><div><h2>Órdenes emitidas</h2><p>Seguimiento logístico y verificación física de Almacén.</p></div><button type="button" className="ops-btn ops-btn-small" onClick={actualizar} disabled={confirmando!==null}>Actualizar emitidas</button></div>
    {error&&<p className="ops-alert ops-alert-error" role="alert">{error}</p>}{mensaje&&<p className="ops-alert ops-alert-success" role="status">{mensaje}</p>}
    <div className="ops-table-scroll"><table className="ops-table recep-commercial" aria-label="Órdenes emitidas y recepción"><thead><tr><th>Orden</th><th>Situación logística</th><th>Verificación de Almacén</th><th>Confirmación comercial</th><th>Documento</th></tr></thead><tbody>{ordenes.map(o=><tr key={o.id_orden_compra}>
      <td><strong>{o.codigo}</strong><small className="ops-row-note">Emitida · {o.proveedor||'Proveedor'}</small></td>
      <td><span className={`recep-state ${o.lote_verificado?'recep-state-ok':''}`}>{o.lote_verificado?'Recibida':'En tránsito'}</span></td>
      <td>{o.lote_verificado?<><span className="recep-verified">● Lote verificado y recibido por Almacén</span><small className="ops-row-note">{o.usuario_almacen} · {o.fecha_recepcion?fecha.format(new Date(o.fecha_recepcion)):''}</small></>:<span className="ops-muted">Pendiente de recepción física</span>}</td>
      <td>{o.fecha_confirmacion?<><span className="recep-verified">Confirmada</span><small className="ops-row-note">{o.usuario_confirma} · {fecha.format(new Date(o.fecha_confirmacion))}</small></>:<button type="button" className="ops-btn ops-btn-small" disabled={!o.lote_verificado||confirmando!==null} title={!o.lote_verificado?'Primero Almacén debe verificar y recibir el lote.':undefined} aria-label={`Confirmar comercialmente ${o.codigo}`} onClick={()=>void confirmar(o)}>{confirmando===o.id_orden_compra?'Confirmando…':'Confirmar comercialmente'}</button>}</td>
      <td><a className="ops-btn ops-btn-small" href={`/api/ordenes-compra/${o.id_orden_compra}/pdf`} aria-label={`Descargar ${o.codigo} PDF`}>Descargar PDF</a></td>
    </tr>)}</tbody></table></div>
  </section>
}
