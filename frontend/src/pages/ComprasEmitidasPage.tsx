import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import OrdenesEmitidas from '../components/OrdenesEmitidas'
import { obtenerEmitidas } from '../services/ordenCompraService'

export default function ComprasEmitidasPage() {
  const navigate = useNavigate()
  const consulta = useQuery({ queryKey: ['compras', 'emitidas'], queryFn: obtenerEmitidas, staleTime: 0 })
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">COMPRAS</p><h1>Órdenes emitidas</h1><p>Consulta la recepción, confirma y cierra las compras completadas.</p></div></div>
    {consulta.isPending ? <p role="status">Cargando órdenes emitidas…</p> : consulta.isError ?
      <div role="alert" className="ops-alert ops-alert-error">{consulta.error.message} <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button></div> :
      consulta.data.length === 0 ? <section className="ops-card ops-empty-state"><h2>No hay órdenes emitidas pendientes</h2><p>Las compras cerradas se conservan en Histórico.</p></section> :
      <OrdenesEmitidas ordenes={consulta.data} actualizar={() => void consulta.refetch()} alCerrar={codigo => navigate('/compras/historico', { state: { mensaje: `${codigo} cerrada y archivada.` } })} />}
  </>
}
