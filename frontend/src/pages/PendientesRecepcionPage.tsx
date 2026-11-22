import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

interface Orden { id_orden_compra: number; codigo: string; proveedor: string; pares: string }
interface Linea { modelo: string; color: string; talla: string; cantidad: number }
interface Detalle { codigo: string; proveedor: string; lineas: Linea[] }

async function consultar<T>(ruta: string, signal: AbortSignal): Promise<T> {
  const res = await fetch('/api/almacen/pendientes' + ruta, { credentials: 'include', signal })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.mensaje || 'No se pudo consultar la recepción.')
  }
  return res.json()
}

export default function PendientesRecepcionPage() {
  const { id } = useParams()
  const lista = useQuery({ queryKey: ['recepcion', 'pendientes'], enabled: !id,
    queryFn: ({ signal }) => consultar<Orden[]>('', signal), retry: false })
  const detalle = useQuery({ queryKey: ['recepcion', 'orden', id], enabled: Boolean(id),
    queryFn: ({ signal }) => consultar<Detalle>('/' + id, signal), retry: false })
  const consulta = id ? detalle : lista
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">Almacén</p>
      <h1>{id ? detalle.data?.codigo ?? 'Detalle de orden' : 'Pendientes de recepción'}</h1>
      {id && detalle.data && <p>{detalle.data.proveedor}</p>}
    </div>{id && <Link className="ops-btn" to="/almacen">Volver a pendientes</Link>}</div>
    {consulta.isPending ? <p role="status">Consultando órdenes…</p> :
      consulta.isError ? <div className="ops-alert ops-alert-error" role="alert">{consulta.error.message}
        <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button></div> :
      <section className="ops-card"><div className="ops-table-scroll">
        {id && detalle.data ? <table className="ops-table"><thead><tr>
          <th>Modelo</th><th>Color</th><th>Talla</th><th>Pares esperados</th></tr></thead><tbody>
          {detalle.data.lineas.map(l => <tr key={JSON.stringify([l.modelo,l.color,l.talla])}>
            <td>{l.modelo}</td><td>{l.color}</td><td>{Number(l.talla)}</td><td>{l.cantidad}</td></tr>)}
        </tbody></table> : lista.data?.length ? <table className="ops-table"><thead><tr>
          <th>Orden</th><th>Proveedor</th><th>Pares esperados</th></tr></thead><tbody>
          {lista.data.map(o => <tr key={o.id_orden_compra}>
            <td><Link className="ops-order-link" to={'/almacen/pendientes/' + o.id_orden_compra}>{o.codigo}</Link></td>
            <td>{o.proveedor}</td><td>{o.pares}</td></tr>)}
        </tbody></table> : <p className="ops-table-empty">No hay órdenes pendientes de recepción.</p>}
      </div></section>}
  </>
}
