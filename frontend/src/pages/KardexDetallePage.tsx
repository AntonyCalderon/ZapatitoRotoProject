import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { obtenerKardexInventario, type FiltrosKardex, type TipoMovimiento } from '../services/inventarioService'
import { ErrorInventario, PaginacionInventario, SituacionInventario, paginaInventario } from '../components/InventarioUI'
import { OpIcon } from '../components/OperacionUI'
import { formatearTalla } from '../utils/lineasCompra'
import '../inventario.css'

const tipos: Record<TipoMovimiento, string> = { APERTURA: 'Apertura de inventario', ENTRADA_COMPRA: 'Entrada por compra', SALIDA_VENTA: 'Salida por venta' }
const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

export default function KardexDetallePage() {
  const { skuId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [errorFiltro, setErrorFiltro] = useState('')
  const tipo = params.get('tipo_movimiento') as TipoMovimiento | 'todos' | null
  const filtros: FiltrosKardex = {
    desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '',
    tipo_movimiento: tipo && ['todos', 'APERTURA', 'ENTRADA_COMPRA', 'SALIDA_VENTA'].includes(tipo) ? tipo : 'todos',
    pagina: paginaInventario(params.get('pagina')), tamano: 20,
  }
  const consulta = useQuery({ queryKey: ['inventario', 'kardex', skuId, filtros], queryFn: ({ signal }) => obtenerKardexInventario(skuId, filtros, signal),
    placeholderData: (anterior, consultaAnterior) => consultaAnterior?.queryKey[2] === skuId ? anterior : undefined, retry: false })
  const datos = consulta.data
  const retorno = location.state?.volverA
  const volverA = typeof retorno === 'string' && (retorno === '/almacen/kardex' || retorno.startsWith('/almacen/kardex?')) ? retorno : '/almacen/kardex'

  function filtrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const desde = String(form.get('desde') ?? ''), hasta = String(form.get('hasta') ?? '')
    if (desde && hasta && desde > hasta) { setErrorFiltro('La fecha desde no puede ser posterior a la fecha hasta.'); return }
    setErrorFiltro('')
    const nuevos = new URLSearchParams()
    if (desde) nuevos.set('desde', desde)
    if (hasta) nuevos.set('hasta', hasta)
    nuevos.set('tipo_movimiento', String(form.get('tipo_movimiento') ?? 'todos'))
    setParams(nuevos)
  }

  return <div className="inv-page">
    <Link className="inv-back" to={volverA}><span aria-hidden="true">←</span> Volver a existencias</Link>
    <div className="ops-page-heading inv-heading"><div><h1>Kardex físico del producto</h1><p>Historial de entradas y salidas físicas registradas.</p></div><span className="inv-location">● Almacén principal</span></div>
    {datos && <section className="ops-card inv-product-summary" aria-label="Producto consultado">
      <div><span>Código SKU</span><strong>{datos.producto.codigo_sku}</strong></div><div><span>Modelo</span><strong>{datos.producto.modelo}</strong></div>
      <div><span>Color y talla</span><strong>{datos.producto.color} · Talla {formatearTalla(datos.producto.talla)}</strong></div>
      <div className="inv-summary-stock"><span>Stock actual en almacén</span><strong>{datos.cantidad_actual} <small>pares físicos</small></strong><SituacionInventario situacion={datos.producto.situacion} /></div>
    </section>}
    <form className="ops-card inv-history-filters" onSubmit={filtrar} key={skuId + params.toString()} aria-label="Filtros del Kardex">
      <label className="inv-label">Fecha desde<input type="date" name="desde" defaultValue={filtros.desde} /></label>
      <label className="inv-label">Fecha hasta<input type="date" name="hasta" defaultValue={filtros.hasta} /></label>
      <label className="inv-label">Tipo de movimiento<select name="tipo_movimiento" defaultValue={filtros.tipo_movimiento}><option value="todos">Todos los movimientos</option>{Object.entries(tipos).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className="ops-btn ops-btn-primary" disabled={consulta.isFetching}><OpIcon name="buscar" />Consultar</button>
      <button type="button" className="ops-btn inv-refresh" disabled={consulta.isFetching} onClick={() => { if (params.size) setParams({}); else void consulta.refetch(); setErrorFiltro('') }}>Limpiar filtros</button>
    </form>
    {errorFiltro && <p className="ops-alert ops-alert-error" role="alert">{errorFiltro}</p>}
    {consulta.isError ? <ErrorInventario error={consulta.error} reintentar={() => void consulta.refetch()} /> : <section className="ops-card inv-table-card" aria-busy={consulta.isFetching}>
      {consulta.isFetching && <p className="inv-query-status" role="status">{datos ? 'Actualizando movimientos…' : 'Consultando Kardex…'}</p>}
      <div className="ops-table-scroll"><table className="ops-table inv-history-table" aria-label="Movimientos físicos del SKU"><thead><tr><th>Fecha y hora</th><th>Movimiento</th><th>Documento de origen</th><th className="ops-number">Entrada</th><th className="ops-number">Salida</th><th className="ops-number">Stock posterior</th><th>Responsable</th></tr></thead><tbody>
        {datos?.items.map(m => <tr key={m.id_movimiento}><td className="inv-movement-date"><time dateTime={m.fecha}>{fecha.format(new Date(m.fecha))}</time></td>
          <td><span className={`inv-badge ${m.salida ? 'inv-movement-out' : 'inv-movement-in'}`}><span aria-hidden="true">{m.salida ? '↑' : '↓'}</span>{tipos[m.tipo_movimiento]}</span></td>
          <td className="inv-document">{m.documento_origen.codigo || (m.tipo_movimiento === 'APERTURA' ? 'Apertura inicial' : 'Sin código')}</td>
          <td className="ops-number inv-entry">{m.entrada ? `+${m.entrada}` : '—'}</td><td className="ops-number inv-exit">{m.salida ? `−${m.salida}` : '—'}</td>
          <td className="ops-number"><strong>{m.saldo_posterior} pares</strong></td><td>{m.responsable}</td></tr>)}
        {!consulta.isPending && !datos?.items.length && <tr><td colSpan={7} className="ops-table-empty"><strong>No hay movimientos para esta consulta.</strong><p>{filtros.desde || filtros.hasta || filtros.tipo_movimiento !== 'todos' ? 'Prueba otras fechas o consulta todos los movimientos.' : 'Las recepciones y salidas confirmadas aparecerán aquí.'}</p></td></tr>}
      </tbody></table></div>
      {datos && <PaginacionInventario {...datos} unidad="movimientos" ocupado={consulta.isFetching} cambiar={pagina => { const nuevos = new URLSearchParams(params); nuevos.set('pagina', String(pagina)); setParams(nuevos) }} />}
    </section>}
    <p className="inv-trace-note"><OpIcon name="documento" /><span>El stock cambia al confirmar la recepción o salida física. Los filtros conservan el stock histórico de cada movimiento. Fechas en hora de Perú.</span></p>
  </div>
}
