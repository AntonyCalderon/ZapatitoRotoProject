import { useEffect,useRef,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { Link,useParams } from 'react-router-dom'
import { listarPendientesRecepcion,consultarRecepcion,confirmarRecepcionCompleta,type ResultadoRecepcion } from '../services/recepcionService'
import { formatearTalla } from '../utils/lineasCompra'
import { OpIcon } from '../components/OperacionUI'
import '../recepcion.css'

const fecha=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'})
export default function PendientesRecepcionPage() {
  const {id}=useParams(),client=useQueryClient()
  const [verificadas,setVerificadas]=useState<number[]>([]),[registrando,setRegistrando]=useState(false)
  const [resultado,setResultado]=useState<ResultadoRecepcion|null>(null),[error,setError]=useState('')
  const clave=useRef<string|null>(null),enviando=useRef(false)
  const lista=useQuery({queryKey:['recepcion','pendientes'],enabled:!id,queryFn:({signal})=>listarPendientesRecepcion(signal),retry:false})
  const detalle=useQuery({queryKey:['recepcion','orden',id],enabled:Boolean(id)&&!resultado,queryFn:({signal})=>consultarRecepcion(id!,signal),retry:false})
  useEffect(()=>{setVerificadas([]);clave.current=null},[detalle.data])
  useEffect(()=>{setResultado(null);setError('');setVerificadas([]);clave.current=null},[id])
  const consulta=id?detalle:lista,lineas=detalle.data?.lineas??[]
  const pares=lineas.reduce((a,l)=>a+l.cantidad,0)
  const todas=lineas.length>0&&lineas.every(l=>verificadas.includes(l.id_detalle_compra))
  async function confirmar() {
    if(!id||!detalle.data||!todas||enviando.current||resultado)return
    if(!window.confirm(`Confirmar recepción de ${detalle.data.codigo}: ${pares} pares. Se registrará la entrada al inventario. ¿Verificaste los códigos y todas las cantidades físicas?`))return
    enviando.current=true;setRegistrando(true);setError('');clave.current??=crypto.randomUUID()
    try {
      const recibido=await confirmarRecepcionCompleta(id,lineas,clave.current);setResultado(recibido)
      void client.invalidateQueries({queryKey:['recepcion','pendientes']})
      void client.invalidateQueries({queryKey:['inventario']})
    }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar la recepción.')}
    finally{enviando.current=false;setRegistrando(false)}
  }
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">ALMACÉN</p><h1>{id?detalle.data?.codigo??'Detalle de recepción':'Recepciones de compras'}</h1><p>{id?detalle.data?.proveedor:'Consulta y verifica las compras pendientes de recepción.'}</p></div>{id&&<Link className="ops-btn" to="/almacen">Volver a pendientes</Link>}</div>
    {resultado&&<div className="ops-alert ops-alert-success" role="status"><OpIcon name="check" /><div><strong>Lote verificado y recibido por Almacén</strong><p>{resultado.recepcion.pares} pares ingresados · {resultado.recepcion.usuario_almacen} · {fecha.format(new Date(resultado.recepcion.fecha_recepcion))}</p></div></div>}
    {error&&<div className="ops-alert ops-alert-error" role="alert">{error}</div>}
    {consulta.isPending?<div className="ops-card ops-loading" role="status">Consultando órdenes…</div>:consulta.isError?<div className="ops-alert ops-alert-error" role="alert">{consulta.error.message}<button className="ops-text-button" onClick={()=>void consulta.refetch()}>Reintentar</button></div>:
      <section className="ops-card recep-card">
        <div className="ops-card-heading"><div><h2>{id?'Verificación del lote':'Pendientes de recepción'}</h2><p>{id?'Comprueba el código SKU y todos los pares indicados antes de confirmar.':'Las compras emitidas aparecen aquí hasta su recepción física completa.'}</p></div><span className={`recep-state ${resultado?'recep-state-ok':''}`}>{resultado?'Recibida':id?'En tránsito':'Pendientes de recepción'}</span></div>
        <div className="ops-table-scroll">
        {id&&detalle.data?<table className="ops-table recep-lines" aria-label="Productos por verificar"><thead><tr><th>Código SKU</th><th>Modelo</th><th>Color</th><th>Talla</th><th className="ops-number">Pares esperados</th><th>Verificación física</th></tr></thead><tbody>
          {lineas.map(l=><tr key={l.id_detalle_compra}><th scope="row" className="recep-sku">{l.codigo_sku}</th><td>{l.modelo}</td><td>{l.color}</td><td>{formatearTalla(l.talla)}</td><td className="ops-number"><strong>{l.cantidad}</strong></td><td><label className="recep-check"><input type="checkbox" aria-label={`Verificar SKU ${l.codigo_sku}`} checked={verificadas.includes(l.id_detalle_compra)} disabled={registrando||Boolean(resultado)||detalle.isFetching} onChange={e=>{clave.current=null;setError('');setVerificadas(actual=>e.target.checked?[...actual,l.id_detalle_compra]:actual.filter(v=>v!==l.id_detalle_compra))}} />Verificado</label></td></tr>)}
        </tbody></table>:lista.data?.length?<table className="ops-table" aria-label="Compras pendientes de recepción"><thead><tr><th>Orden</th><th>Proveedor</th><th className="ops-number">Pares esperados</th><th>Situación</th><th>Acción</th></tr></thead><tbody>{lista.data.map(o=><tr key={o.id_orden_compra}><th scope="row" className="recep-sku">{o.codigo}</th><td>{o.proveedor}</td><td className="ops-number">{o.pares}</td><td><span className="recep-state">Pendiente de recepción</span></td><td><Link className="ops-btn ops-btn-small" aria-label={`Abrir recepción ${o.codigo}`} to={'/almacen/pendientes/'+o.id_orden_compra}>Abrir</Link></td></tr>)}</tbody></table>:<p className="ops-table-empty">No hay órdenes pendientes de recepción.</p>}
        </div>
        {id&&detalle.data&&!resultado&&<div className="ops-card-actions recep-actions"><div><strong>{pares} pares esperados</strong><p>Marca cada línea cuando el SKU y la cantidad física coincidan. La recepción es completa.</p></div><button type="button" className="ops-btn ops-btn-primary" disabled={!todas||registrando||detalle.isFetching} onClick={()=>void confirmar()}><OpIcon name="check" />{registrando?'Registrando recepción…':'Confirmar recepción completa'}</button></div>}
      </section>}
  </>
}
