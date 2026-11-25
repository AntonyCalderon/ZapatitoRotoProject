import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fechaCompra, OpIcon, soles } from '../components/OperacionUI'
import {
  agregarLineaVenta, consultarPreciosBorrador, listarBorradoresVenta, listarProductosVenta, quitarLineaVenta,
  type PreciosBorrador, type ProductoParaVenta,
} from '../services/precioVentaService'
import { useAuthStore } from '../store/authStore'
import { formatearTalla } from '../utils/lineasCompra'

const rutaPrecios = '/ventas/precios'
const campo = 'mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700'

function BandejaPrecios({ vendedor }: { vendedor: number | undefined }) {
  const consulta = useQuery({
    queryKey: ['ventas', vendedor, 'borradores'],
    queryFn: ({ signal }) => listarBorradoresVenta(signal),
  })

  return <>
    <div className="ops-page-heading"><h1>Precios de venta</h1></div>
    <section className="ops-card" aria-labelledby="borradores-venta">
      <div className="ops-card-heading">
        <div className="ops-section-title">
          <span className="ops-section-icon"><OpIcon name="documento" /></span>
          <h2 id="borradores-venta">Borradores de venta</h2>
        </div>
      </div>
      {consulta.isPending && <p role="status" className="ops-loading">Cargando borradores…</p>}
      {consulta.isError && <p role="alert" className="ops-alert ops-alert-error">{consulta.error.message}
        <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button>
      </p>}
      {consulta.data?.length === 0 && <div className="ops-empty-state">
        <OpIcon name="documento" /><h3>Aún no tienes borradores de venta</h3>
        <p>Para agregar productos, primero inicia una venta con un cliente.</p>
      </div>}
      {!!consulta.data?.length && <div className="ops-table-scroll">
        <table className="ops-table" aria-label="Borradores de venta">
          <thead><tr><th>Borrador</th><th>Cliente</th><th>Segmento</th><th>Creado</th><th>Acción</th></tr></thead>
          <tbody>{consulta.data.map(venta => <tr key={venta.id_orden_venta}>
            <td>#{venta.id_orden_venta}</td><td>{venta.cliente}</td><td>{venta.segmento}</td>
            <td>{fechaCompra(venta.fecha_creacion)}</td>
            <td><Link className="ops-btn ops-btn-small" aria-label={`Abrir venta ${venta.id_orden_venta}`}
              to={`${rutaPrecios}/${venta.id_orden_venta}`}>Abrir</Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>
}

function SelectorProducto({ productos, ocupado, agregar }: {
  productos: ProductoParaVenta[]
  ocupado: boolean
  agregar: (idSku: number, cantidad: number) => Promise<PreciosBorrador>
}) {
  const [modelo, setModelo] = useState('')
  const [color, setColor] = useState('')
  const [sku, setSku] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [error, setError] = useState('')
  const modelos = new Map(productos.map(p => [p.id_modelo, p.modelo]))
  const delModelo = productos.filter(p => String(p.id_modelo) === modelo)
  const colores = new Map(delModelo.map(p => [p.id_color, p.color]))
  const tallas = delModelo.filter(p => String(p.id_color) === color)
  const seleccion = tallas.find(p => String(p.id_sku) === sku)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!seleccion || ocupado) return
    setError('')
    try {
      await agregar(seleccion.id_sku, Number(cantidad))
      setSku('')
      setCantidad('1')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return <form className="border-b border-slate-200 px-6 py-5" onSubmit={enviar}>
    <fieldset disabled={ocupado} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <legend className="sr-only">Producto a agregar</legend>
      <label className="text-sm font-medium">Modelo
        <select className={campo} value={modelo} onChange={e => { setModelo(e.target.value); setColor(''); setSku(''); setError('') }} required>
          <option value="">Seleccionar modelo</option>
          {Array.from(modelos, ([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Color
        <select className={campo} value={color} onChange={e => { setColor(e.target.value); setSku(''); setError('') }} disabled={!modelo} required>
          <option value="">Seleccionar color</option>
          {Array.from(colores, ([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Talla
        <select className={campo} value={sku} onChange={e => { setSku(e.target.value); setError('') }} disabled={!color} required>
          <option value="">Seleccionar talla</option>
          {tallas.map(p => <option key={p.id_sku} value={p.id_sku}>{formatearTalla(p.talla)}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Cantidad
        <input className={campo} type="number" inputMode="numeric" min={1} step={1}
          value={cantidad} onChange={e => { setCantidad(e.target.value); setError('') }} required />
      </label>
      <button className="ops-btn ops-btn-primary" disabled={!seleccion || seleccion.disponible === 0}>
        <OpIcon name="mas" />Agregar producto
      </button>
    </fieldset>
    {seleccion && <p className="mt-3 text-sm text-slate-600" role="status">
      {seleccion.disponible ? `Disponibles: ${seleccion.disponible} pares` : 'Sin stock'}
    </p>}
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
  </form>
}

function EditorPrecios({ vendedor, idOrden }: { vendedor: number | undefined; idOrden: string }) {
  const client = useQueryClient()
  const claveBorrador = ['ventas', vendedor, 'precios', idOrden]
  const productos = useQuery({
    queryKey: ['ventas', vendedor, 'productos'],
    queryFn: ({ signal }) => listarProductosVenta(signal),
  })
  const consulta = useQuery({
    queryKey: claveBorrador,
    queryFn: ({ signal }) => consultarPreciosBorrador(idOrden, signal),
  })
  const cambio = useMutation({
    mutationFn: (operacion: { idSku: number; cantidad?: number }) => operacion.cantidad === undefined
      ? quitarLineaVenta(idOrden, operacion.idSku)
      : agregarLineaVenta(idOrden, operacion.idSku, operacion.cantidad),
    onMutate: () => client.cancelQueries({ queryKey: claveBorrador }),
    onSuccess: borrador => client.setQueryData(claveBorrador, borrador),
    onSettled: () => { void productos.refetch() },
  })
  const venta = consulta.data

  return <>
    <div className="ops-page-heading">
      <h1>Precios del borrador #{idOrden}</h1>
      <Link className="ops-btn" to={`/ventas/borradores/${idOrden}/cliente`}>Cambiar cliente</Link>
      <Link className="ops-btn" to={rutaPrecios}>Volver a borradores</Link>
    </div>
    {consulta.isPending && <p role="status" className="ops-loading">Cargando venta…</p>}
    {consulta.isError && <p role="alert" className="ops-alert ops-alert-error">{consulta.error.message}
      <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button>
    </p>}
    {venta && !consulta.isError && <section className="ops-card" aria-labelledby="detalle-venta">
      <div className="ops-card-heading">
        <div className="ops-section-title">
          <span className="ops-section-icon"><OpIcon name="ventas" /></span>
          <div><h2 id="detalle-venta">Productos de la venta</h2><p>{venta.cliente} · {venta.segmento}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ops-badge ops-badge-draft">Borrador</span>
          <button className="ops-btn ops-btn-small" disabled={cambio.isPending || consulta.isFetching}
            onClick={() => { void consulta.refetch(); void productos.refetch() }}>Actualizar precios</button>
        </div>
      </div>
      {productos.isPending && <p className="ops-loading" role="status">Cargando productos…</p>}
      {productos.isError && <p className="ops-alert ops-alert-error" role="alert">{productos.error.message}
        <button className="ops-text-button" onClick={() => void productos.refetch()}>Reintentar</button>
      </p>}
      {productos.data && <SelectorProducto productos={productos.data} ocupado={cambio.isPending}
        agregar={(idSku, cantidad) => cambio.mutateAsync({ idSku, cantidad })} />}
      {cambio.isError && cambio.variables?.cantidad === undefined &&
        <p className="ops-alert ops-alert-error" role="alert">{cambio.error.message}</p>}
      {venta.lineas.length === 0 ? <div className="ops-empty-state"><p>Agrega un producto para calcular su precio.</p></div> :
        <div className="ops-table-scroll">
          <table className="ops-table ops-product-table" aria-label="Productos de la venta">
            <thead><tr><th>Modelo</th><th>Color</th><th>Talla</th><th>Pares</th><th>Precio por par con IGV</th>
              <th>Importe sin IGV</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{venta.lineas.map(linea => <tr key={linea.id_sku}>
              <td><strong>{linea.modelo}</strong><small className="ops-row-note">{linea.codigo_sku}</small>
                {linea.motivo && <small className="block text-red-700">{linea.motivo}</small>}</td>
              <td>{linea.color}</td><td>{formatearTalla(linea.talla)}</td><td>{linea.cantidad}</td>
              <td>{soles(linea.precio_con_igv)}</td><td>{soles(linea.importe)}</td>
              <td><button className="ops-btn ops-btn-small" disabled={cambio.isPending}
                aria-label={`Quitar ${linea.codigo_sku}`} onClick={() => cambio.mutate({ idSku: linea.id_sku })}>
                <OpIcon name="quitar" />Quitar
              </button></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <div className="flex justify-end border-t border-slate-200 p-6">
        <div className="ops-order-summary w-full sm:w-72" aria-label="Totales de la venta">
          <div>Subtotal <strong>{soles(venta.subtotal)}</strong></div>
          <div>IGV <strong>{soles(venta.igv)}</strong></div>
          <div className="ops-grand-total">Total <strong>{soles(venta.total)}</strong></div>
        </div>
      </div>
    </section>}
  </>
}

export default function VentaPreciosPage() {
  const vendedor = useAuthStore(s => s.user?.id_usuario)
  const { idOrden } = useParams()
  return idOrden
    ? <EditorPrecios key={idOrden} vendedor={vendedor} idOrden={idOrden} />
    : <BandejaPrecios vendedor={vendedor} />
}
