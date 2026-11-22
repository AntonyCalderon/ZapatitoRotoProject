import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import { listarExistencias, obtenerCatalogoInventario, type CatalogoInventario, type FiltrosExistencias, type SituacionStock } from '../services/inventarioService'
import { CatalogoInventarioBadge, ErrorInventario, PaginacionInventario, SituacionInventario, paginaInventario } from '../components/InventarioUI'
import { OpIcon } from '../components/OperacionUI'
import { formatearTalla } from '../utils/lineasCompra'
import '../inventario.css'

const situaciones = [['todos', 'Todos'], ['disponible', 'Disponible'], ['stock_bajo', 'Stock bajo'], ['agotado', 'Agotado']] as const
const catalogos = [['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']] as const

export default function ExistenciasPage() {
  const [params, setParams] = useSearchParams()
  const catalogo = params.get('catalogo') as CatalogoInventario | null
  const situacion = params.get('situacion') as SituacionStock | 'todos' | null
  const filtros: FiltrosExistencias = {
    q: params.get('q') ?? '', id_modelo: params.get('id_modelo') ?? '', id_color: params.get('id_color') ?? '', id_talla: params.get('id_talla') ?? '',
    catalogo: catalogo && ['activos', 'inactivos', 'todos'].includes(catalogo) ? catalogo : 'activos',
    situacion: situacion && ['todos', 'disponible', 'stock_bajo', 'agotado', 'sin_minimo'].includes(situacion) ? situacion : 'todos',
    pagina: paginaInventario(params.get('pagina')), tamano: 20,
  }
  const opciones = useQuery({ queryKey: ['inventario', 'catalogo'], queryFn: ({ signal }) => obtenerCatalogoInventario(signal), retry: false })
  const consulta = useQuery({ queryKey: ['inventario', 'existencias', filtros], queryFn: ({ signal }) => listarExistencias(filtros, signal), placeholderData: keepPreviousData, retry: false })

  function cambiar(campo: string, valor: string) {
    const nuevos = new URLSearchParams(params)
    if (valor) nuevos.set(campo, valor); else nuevos.delete(campo)
    if (campo !== 'pagina') nuevos.delete('pagina')
    setParams(nuevos)
  }
  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    cambiar('q', String(new FormData(e.currentTarget).get('q') ?? '').trim())
  }

  return <div className="inv-page">
    <div className="ops-page-heading inv-heading"><div><p className="ops-eyebrow">ESPACIO DE TRABAJO</p><h1>Existencias y Kardex</h1><p>Consulta el stock actual y los movimientos de cada producto.</p></div>
      <button type="button" className="ops-btn inv-refresh" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}><OpIcon name="reloj" />Actualizar</button>
    </div>
    <section className="ops-card inv-filters" aria-label="Filtros de existencias">
      <div className="inv-filter-grid">
        <form onSubmit={buscar} className="inv-search-form"><label className="inv-label" htmlFor="inventario-buscar">Búsqueda rápida</label><div className="inv-search-input"><OpIcon name="buscar" /><input key={filtros.q} id="inventario-buscar" name="q" defaultValue={filtros.q} maxLength={100} placeholder="Buscar por código SKU o modelo…" /><button type="submit" aria-label="Buscar productos">Buscar</button></div></form>
        <label className="inv-label">Modelo<select value={filtros.id_modelo} onChange={e => cambiar('id_modelo', e.target.value)} disabled={!opciones.data}><option value="">Todos los modelos</option>{opciones.data?.modelos.map(m => <option key={m.id_modelo} value={m.id_modelo}>{m.nombre_modelo}</option>)}</select></label>
        <label className="inv-label">Color<select value={filtros.id_color} onChange={e => cambiar('id_color', e.target.value)} disabled={!opciones.data}><option value="">Todos los colores</option>{opciones.data?.colores.map(c => <option key={c.id_color} value={c.id_color}>{c.nombre_color}</option>)}</select></label>
        <label className="inv-label">Talla<select value={filtros.id_talla} onChange={e => cambiar('id_talla', e.target.value)} disabled={!opciones.data}><option value="">Todas las tallas</option>{opciones.data?.tallas.map(t => <option key={t.id_talla} value={t.id_talla}>{formatearTalla(t.numero_talla)}</option>)}</select></label>
        <button type="button" className="ops-btn inv-clear" onClick={() => setParams({})}>Limpiar filtros</button>
      </div>
      <div className="inv-filter-bottom">
        <div className="inv-filter-group" role="group" aria-label="Situación de stock"><span>Situación de stock:</span><div className="inv-segmented">{situaciones.map(([value, label]) => <button key={value} type="button" aria-pressed={filtros.situacion === value} onClick={() => cambiar('situacion', value)}>{label}</button>)}</div></div>
        <div className="inv-filter-group" role="group" aria-label="Estado del catálogo"><span>Catálogo:</span><div className="inv-segmented">{catalogos.map(([value, label]) => <button key={value} type="button" aria-pressed={filtros.catalogo === value} onClick={() => cambiar('catalogo', value)}>{label}</button>)}</div></div>
      </div>
      {opciones.isError && <div className="inv-filter-error"><ErrorInventario error={opciones.error} reintentar={() => void opciones.refetch()} /></div>}
    </section>
    {consulta.isError ? <ErrorInventario error={consulta.error} reintentar={() => void consulta.refetch()} /> : <section className="ops-card inv-table-card" aria-label="Existencias por SKU" aria-busy={consulta.isFetching}>
      {consulta.isFetching && <p className="inv-query-status" role="status">{consulta.data ? 'Actualizando existencias…' : 'Cargando existencias…'}</p>}
      <div className="ops-table-scroll"><table className="ops-table inv-stock-table" aria-label="Existencias por SKU"><thead><tr><th>Código SKU</th><th>Modelo</th><th>Color</th><th>Talla</th><th className="ops-number">Stock actual</th><th className="ops-number">Stock mínimo</th><th>Situación</th><th>Catálogo</th><th className="ops-center">Acción</th></tr></thead><tbody>
        {consulta.data?.items.map(p => <tr key={p.id_sku}>
          <th scope="row" className="inv-sku">{p.codigo_sku}</th><td>{p.modelo}</td><td>{p.color}</td><td>{formatearTalla(p.talla)}</td>
          <td className={`ops-number inv-stock inv-stock-${p.situacion}`}>{p.cantidad_actual} <span>pares</span></td>
          <td className="ops-number">{p.stock_minimo === null ? <span className="inv-undefined">No definido</span> : `${p.stock_minimo} pares`}</td>
          <td><SituacionInventario situacion={p.situacion} /></td><td><CatalogoInventarioBadge activo={p.catalogo_activo} /></td>
          <td className="ops-center"><Link className="ops-btn ops-btn-primary inv-detail-link" to={`/almacen/kardex/${p.id_sku}`} state={{ volverA: '/almacen/kardex' + (params.size ? '?' + params.toString() : '') }} aria-label={`Ver Kardex de ${p.codigo_sku}`}>Ver Kardex <span aria-hidden="true">›</span></Link></td>
        </tr>)}
        {!consulta.isPending && !consulta.data?.items.length && <tr><td colSpan={9} className="ops-table-empty"><strong>No hay productos que coincidan con los filtros.</strong><p>Prueba otra búsqueda o limpia los filtros para ver las existencias.</p></td></tr>}
      </tbody></table></div>
      {consulta.data && <PaginacionInventario {...consulta.data} ocupado={consulta.isFetching} cambiar={pagina => cambiar('pagina', String(pagina))} />}
    </section>}
  </div>
}
