import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OpIcon } from '../components/OperacionUI'
import { consultarDisponibilidadVenta, listarProductosVenta } from '../services/precioVentaService'
import { useAuthStore } from '../store/authStore'
import { formatearTalla } from '../utils/lineasCompra'

export default function DisponibilidadVentaPage() {
  const vendedor = useAuthStore(s => s.user?.id_usuario)
  const [idSku, setIdSku] = useState('')
  const catalogo = useQuery({
    queryKey: ['ventas', vendedor, 'productos'],
    queryFn: ({ signal }) => listarProductosVenta(signal),
  })
  const consulta = useQuery({
    queryKey: ['ventas', vendedor, 'disponibilidad', idSku],
    queryFn: ({ signal }) => consultarDisponibilidadVenta(idSku, signal),
    enabled: Boolean(idSku),
    retry: false,
  })
  const producto = consulta.data

  return <>
    <div className="ops-page-heading"><h1>Disponibilidad de productos</h1></div>
    <section className="ops-card" aria-labelledby="consultar-stock">
      <div className="ops-card-heading">
        <div className="ops-section-title">
          <span className="ops-section-icon"><OpIcon name="buscar" /></span>
          <h2 id="consultar-stock">Consultar stock por SKU</h2>
        </div>
      </div>
      <div className="grid gap-4 p-6">
        {catalogo.isPending && <p role="status">Cargando catálogo…</p>}
        {catalogo.isError && <p role="alert" className="ops-alert ops-alert-error">{catalogo.error.message}
          <button type="button" className="ops-text-button" onClick={() => void catalogo.refetch()}>Reintentar</button>
        </p>}
        {catalogo.data?.length === 0 && <p>No hay productos activos en el catálogo.</p>}
        {!!catalogo.data?.length && <div className="flex flex-wrap items-end gap-3">
          <label className="ops-field min-w-0 grow">Producto (SKU)
            <select value={idSku} onChange={e => setIdSku(e.target.value)}>
              <option value="">Elegir un producto</option>
              {catalogo.data.map(p => <option value={p.id_sku} key={p.id_sku}>
                {p.codigo_sku} · {p.modelo} · {p.color} · {formatearTalla(p.talla)}
              </option>)}
            </select>
          </label>
          <button className="ops-btn ops-btn-primary" type="button" disabled={!idSku || consulta.isFetching}
            onClick={() => void consulta.refetch()}>Consultar disponibilidad</button>
        </div>}
        {idSku && consulta.isFetching && <p role="status">Consultando disponibilidad…</p>}
        {consulta.isError && !consulta.isFetching && <p role="alert" className="ops-alert ops-alert-error">{consulta.error.message}</p>}
        {producto && !consulta.isError && !consulta.isFetching &&
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4" role="status">
            <p className="text-sm text-slate-700">{producto.codigo_sku}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {producto.disponible > 0 ? `Disponible: ${producto.disponible} ${producto.disponible === 1 ? 'par' : 'pares'}` : 'Sin stock'}
            </p>
          </div>}
      </div>
    </section>
  </>
}
