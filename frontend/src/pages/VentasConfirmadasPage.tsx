import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fechaCompra, OpIcon, soles } from '../components/OperacionUI'
import {
  anularComprobante, codigoComprobante, consultarVentaConfirmada, emitirComprobante, enviarADespacho,
  listarVentasConfirmadas, MOTIVOS_NOTA_CREDITO, pdfComprobante, pdfNotaCredito,
  type EstadoVentaConfirmada, type MotivoNotaCredito,
} from '../services/ventaConfirmadaService'
import { useAuthStore } from '../store/authStore'
import { formatearTalla } from '../utils/lineasCompra'

// HU14 (PROYEC-25) emitir comprobante y HU15 (PROYEC-26) enviar a despacho.
const rutaBase = '/ventas/confirmadas'
const campo = 'mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700'

function EstadoVenta({ estado }: { estado: EstadoVentaConfirmada }) {
  return <span className={`ops-badge ${estado === 'Pendiente' ? 'ops-badge-draft' : ''}`}>{estado}</span>
}

function Dialogo({ titulo, children, ocupado, error, textoConfirmar, textoOcupado, puedeConfirmar = true, alConfirmar, alVolver }: {
  titulo: string
  children: ReactNode
  ocupado: boolean
  error: string
  textoConfirmar: string
  textoOcupado: string
  puedeConfirmar?: boolean
  alConfirmar: () => void
  alVolver: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    contenedor.current?.querySelector<HTMLElement>('select, textarea, button')?.focus()
    return () => anterior?.focus()
  }, [])
  function teclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' && !ocupado) alVolver()
    if (evento.key !== 'Tab') return
    const enfocables = Array.from(contenedor.current!.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'))
    if (!enfocables.length) { evento.preventDefault(); return }
    const primero = enfocables[0], ultimo = enfocables[enfocables.length - 1]
    if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus() }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus() }
  }
  return <div className="ops-dialog-backdrop"><div ref={contenedor} className="ops-dialog" role="dialog" aria-modal="true"
    aria-labelledby={idTitulo} onKeyDown={teclado}>
    <div className="ops-dialog-body space-y-3 text-sm text-slate-600">
      <h2 id={idTitulo} className="text-lg font-bold text-slate-900">{titulo}</h2>
      {children}
      {error && <p className="ops-alert ops-alert-error" role="alert">{error}</p>}
    </div>
    <div className="ops-card-actions">
      <button type="button" className="ops-btn" disabled={ocupado} onClick={alVolver}>Volver</button>
      <button type="button" className="ops-btn ops-btn-primary" disabled={ocupado || !puedeConfirmar} onClick={alConfirmar}>
        {ocupado ? textoOcupado : textoConfirmar}
      </button>
    </div>
  </div></div>
}

function Bandeja({ vendedor }: { vendedor: number | undefined }) {
  const consulta = useQuery({
    queryKey: ['ventas', vendedor, 'confirmadas'],
    queryFn: ({ signal }) => listarVentasConfirmadas(signal),
  })
  return <>
    <div className="ops-page-heading"><div>
      <p className="ops-eyebrow">VENTAS CONFIRMADAS</p><h1>Comprobantes y despacho</h1>
      <p>Emite el comprobante de cada venta confirmada y envíala a Almacén.</p>
    </div></div>
    <section className="ops-card" aria-labelledby="titulo-ventas-confirmadas">
      <div className="ops-card-heading"><div className="ops-section-title">
        <span className="ops-section-icon"><OpIcon name="documento" /></span>
        <div><h2 id="titulo-ventas-confirmadas">Ventas confirmadas
          {!!consulta.data?.length && <span className="ops-count">{consulta.data.length}</span>}</h2>
          <p>Primero las que esperan comprobante o envío.</p></div>
      </div></div>
      {consulta.isPending && <p role="status" className="ops-loading">Cargando ventas…</p>}
      {consulta.isError && <p role="alert" className="ops-alert ops-alert-error">{consulta.error.message}
        <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button></p>}
      {consulta.data?.length === 0 && <div className="ops-empty-state">
        <OpIcon name="documento" /><h3>Aún no tienes ventas confirmadas</h3>
        <p>Cuando confirmes una venta aparecerá aquí para emitir su comprobante.</p>
      </div>}
      {!!consulta.data?.length && <div className="ops-table-scroll">
        <table className="ops-table" aria-label="Ventas confirmadas">
          <thead><tr><th>Venta</th><th>Cliente</th><th className="ops-number">Pares</th><th className="ops-number">Total</th>
            <th>Comprobante</th><th>Despacho</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>{consulta.data.map(venta => <tr key={venta.id_orden_venta}>
            <td><strong>#{venta.id_orden_venta}</strong></td>
            <td>{venta.cliente}<small className="ops-row-note">{venta.tipo_cliente} · {venta.tipo_documento}</small></td>
            <td className="ops-number">{venta.pares}</td>
            <td className="ops-number">{soles(venta.total)}</td>
            <td>{venta.serie_comprobante && venta.numero_comprobante
              ? `${venta.tipo_comprobante} ${venta.serie_comprobante}-${venta.numero_comprobante}`
              : <span className="ops-muted">Por emitir</span>}</td>
            <td>{venta.codigo_despacho ?? <span className="ops-muted">{venta.serie_comprobante ? 'Por enviar' : '—'}</span>}</td>
            <td><EstadoVenta estado={venta.estado} /></td>
            <td><Link className="ops-btn ops-btn-small" to={`${rutaBase}/${venta.id_orden_venta}`}
              aria-label={`Abrir venta ${venta.id_orden_venta}`}>{venta.estado === 'Pendiente' ? 'Abrir' : 'Ver'}</Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>
}

type Accion = 'emitir' | 'anular' | 'enviar' | null

function Detalle({ vendedor, idVenta }: { vendedor: number | undefined; idVenta: string }) {
  const client = useQueryClient()
  const clave = ['ventas', vendedor, 'confirmadas', idVenta]
  const consulta = useQuery({ queryKey: clave, queryFn: ({ signal }) => consultarVentaConfirmada(idVenta, signal) })
  const [accion, setAccion] = useState<Accion>(null)
  const [mensaje, setMensaje] = useState<{ titulo: string; detalle?: string } | null>(null)
  const [direccion, setDireccion] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<MotivoNotaCredito>('01')
  const [sustento, setSustento] = useState('')

  const actualizar = (titulo: string, detalle?: string) => {
    setMensaje({ titulo, detalle })
    setAccion(null)
    void client.invalidateQueries({ queryKey: ['ventas', vendedor, 'confirmadas'] })
  }
  const datos = consulta.data
  const id = datos?.venta.id_orden_venta ?? 0
  const direccionActual = direccion ?? datos?.venta.direccion ?? ''

  const emision = useMutation({
    mutationFn: () => emitirComprobante(id, direccionActual),
    onSuccess: ({ comprobante }) => {
      setDireccion(null)
      actualizar(`${comprobante.tipo} ${codigoComprobante(comprobante)} emitida`,
        `${fechaCompra(comprobante.fecha_emision)} · ${soles(comprobante.total)}`)
    },
  })
  const anulacion = useMutation({
    mutationFn: () => anularComprobante(id, motivo, sustento),
    onSuccess: ({ nota_credito, comprobante_anulado }) => {
      setSustento('')
      actualizar(`${comprobante_anulado.tipo} ${codigoComprobante(comprobante_anulado)} anulada`,
        `Nota de crédito ${codigoComprobante(nota_credito)}. Ya puedes emitir un nuevo comprobante.`)
    },
  })
  const envio = useMutation({
    mutationFn: () => enviarADespacho(id),
    onSuccess: ({ despacho }) => actualizar(`Orden ${despacho.codigo} enviada a Almacén`, 'La venta pasó a En Almacén.'),
  })

  const encabezado = <div className="ops-page-heading">
    <div><p className="ops-eyebrow">VENTAS CONFIRMADAS</p>
      <h1>Venta <span className="ops-heading-id">#{idVenta}</span></h1>
      {datos && <p>{datos.venta.razon_social_nombre} · {datos.venta.segmento}</p>}</div>
    <Link className="ops-btn" to={rutaBase}>Volver a ventas confirmadas</Link>
  </div>

  if (consulta.isPending) return <>{encabezado}<p role="status" className="ops-card ops-loading">Cargando venta…</p></>
  if (consulta.isError || !datos) return <>{encabezado}<p role="alert" className="ops-alert ops-alert-error">
    {consulta.error?.message ?? 'No se pudo cargar la venta.'}
    <button className="ops-text-button" onClick={() => void consulta.refetch()}>Reintentar</button></p></>

  const { venta, lineas, comprobantes, notas_credito: notas, despacho, comprobante_propuesto: propuesto } = datos
  const vigente = comprobantes.find(c => c.estado === 'Emitido') ?? null
  const pendiente = venta.estado === 'Pendiente'
  const pares = lineas.reduce((total, linea) => total + linea.cantidad, 0)
  const ocupado = emision.isPending || anulacion.isPending || envio.isPending
  const direccionValida = direccionActual.replace(/\s+/g, ' ').trim().length >= 5
  const documentos = [
    ...comprobantes.map(c => ({ clave: 'c' + c.id_comprobante, fecha: c.fecha_emision, titulo: `${c.tipo} ${codigoComprobante(c)}`,
      nota: null as string | null, estado: c.estado === 'Emitido' ? 'Emitida' : 'Anulada', total: c.total,
      pdf: pdfComprobante(venta.id_orden_venta, c.id_comprobante) })),
    ...notas.map(n => {
      const origen = comprobantes.find(c => c.id_comprobante === n.id_comprobante)
      return { clave: 'n' + n.id_nota_credito, fecha: n.fecha_emision, titulo: `Nota de crédito ${codigoComprobante(n)}`,
        nota: `${n.motivo} · ${MOTIVOS_NOTA_CREDITO[n.motivo]}${origen ? ` · ref. ${codigoComprobante(origen)}` : ''}`,
        estado: 'Emitida', total: n.total, pdf: pdfNotaCredito(venta.id_orden_venta, n.id_nota_credito) }
    }),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const motivoEnvio = despacho ? null : !pendiente ? 'La venta ya no está pendiente.'
    : !vigente ? 'Disponible cuando la venta tenga comprobante.' : null
  const abrir = (siguiente: Accion) => {
    emision.reset(); anulacion.reset(); envio.reset(); setMensaje(null); setAccion(siguiente)
  }

  return <>
    {encabezado}
    {mensaje && <div className="ops-alert ops-alert-success" role="status"><OpIcon name="check" />
      <div><strong>{mensaje.titulo}</strong>{mensaje.detalle && <p>{mensaje.detalle}</p>}</div></div>}

    <section className="ops-card" aria-labelledby="titulo-datos-venta">
      <div className="ops-card-heading">
        <div className="ops-section-title"><span className="ops-section-icon"><OpIcon name="documento" /></span>
          <div><h2 id="titulo-datos-venta">Datos de la venta</h2>
            {venta.fecha_confirmacion && <p>Confirmada el {fechaCompra(venta.fecha_confirmacion)}</p>}</div></div>
        <EstadoVenta estado={venta.estado} />
      </div>
      <dl className="ops-order-meta">
        <div><dt>Cliente</dt><dd>{venta.razon_social_nombre}</dd></div>
        <div><dt>{venta.tipo_documento}</dt><dd>{venta.numero_documento}</dd></div>
        <div><dt>Documento de respaldo</dt><dd>{venta.numero_documento_cliente
          ? `${venta.tipo_documento_cliente ?? ''} ${venta.numero_documento_cliente}`.trim()
          : <span className="ops-muted">No registrado</span>}</dd></div>
        <div><dt>Comprobante</dt><dd>{vigente ? `${vigente.tipo} ${codigoComprobante(vigente)}`
          : <span className="ops-muted">Pendiente de emisión</span>}</dd></div>
      </dl>
    </section>

    {pendiente && !vigente && <section className="ops-card ops-emission-card" aria-label="Emitir comprobante">
      {propuesto.motivo
        ? <p className="ops-alert ops-alert-error" role="alert">{propuesto.motivo}</p>
        : <div className="ops-emission-main">
          <label className="ops-field">Dirección fiscal y de entrega
            <input className={campo} value={direccionActual} maxLength={255} disabled={ocupado}
              placeholder="Av., número, distrito, provincia" onChange={e => setDireccion(e.target.value)} />
          </label>
          <button type="button" className="ops-btn ops-btn-primary" disabled={ocupado || !direccionValida}
            onClick={() => abrir('emitir')}>Revisar y emitir comprobante</button>
        </div>}
      {!propuesto.motivo && <p className="mt-3 text-sm text-slate-600">
        Comprobante: <strong>{propuesto.tipo} · serie {propuesto.serie}</strong>
        <span className="ops-muted"> ({venta.tipo_documento === 'RUC' ? 'el cliente tiene RUC' : 'el cliente tiene DNI'})</span>
      </p>}
    </section>}

    {documentos.length > 0 && <section className="ops-card" aria-labelledby="titulo-comprobantes">
      <div className="ops-card-heading">
        <div><h2 id="titulo-comprobantes">Comprobantes <span className="ops-count">{documentos.length}</span></h2>
          <p>{vigente ? `Vigente: ${vigente.tipo} ${codigoComprobante(vigente)}` : 'La venta no tiene un comprobante vigente.'}</p></div>
        {pendiente && vigente && <button type="button" className="ops-btn ops-btn-small ops-btn-cancel" disabled={ocupado}
          onClick={() => abrir('anular')}>Anular comprobante</button>}
      </div>
      <div className="ops-table-scroll"><table className="ops-table" aria-label="Comprobantes de la venta">
        <thead><tr><th>Documento</th><th>Estado</th><th>Fecha</th><th className="ops-number">Total</th><th>Acción</th></tr></thead>
        <tbody>{documentos.map(d => <tr key={d.clave}>
          <td><strong>{d.titulo}</strong>{d.nota && <small className="ops-row-note">{d.nota}</small>}</td>
          <td><span className="ops-badge">{d.estado}</span></td>
          <td className="ops-nowrap">{fechaCompra(d.fecha)}</td>
          <td className="ops-number">{soles(d.total)}</td>
          <td><a className="ops-btn ops-btn-small" href={d.pdf} aria-label={`Descargar ${d.titulo} PDF`}>PDF</a></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    <section className="ops-card" aria-labelledby="titulo-productos-venta">
      <div className="ops-card-heading"><div>
        <h2 id="titulo-productos-venta">Productos de la venta <span className="ops-count">{lineas.length}</span></h2>
        <p>Precios congelados al confirmar la venta.</p></div></div>
      <div className="ops-table-scroll"><table className="ops-table ops-product-table" aria-label="Productos de la venta">
        <thead><tr><th>Modelo</th><th>Color</th><th>Talla</th><th className="ops-number">Pares</th>
          <th className="ops-number">Precio por par con IGV</th><th className="ops-number">Importe sin IGV</th></tr></thead>
        <tbody>{lineas.map(linea => <tr key={linea.id_sku}>
          <td><strong>{linea.modelo}</strong><small className="ops-row-note">{linea.codigo_sku}</small></td>
          <td>{linea.color}</td><td><span className="ops-size-badge">{formatearTalla(linea.talla)}</span></td>
          <td className="ops-number"><strong>{linea.cantidad}</strong></td>
          <td className="ops-number">{soles(linea.precio_con_igv)}</td><td className="ops-number">{soles(linea.importe)}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="flex justify-end border-t border-slate-200 p-6">
        <div className="ops-order-summary w-full sm:w-72" aria-label="Totales de la venta">
          <div>Subtotal <strong>{soles(venta.subtotal)}</strong></div>
          <div>IGV{venta.tasa_igv && ` (${Math.round(Number(venta.tasa_igv) * 100)} %)`} <strong>{soles(venta.igv)}</strong></div>
          <div className="ops-grand-total">Total <strong>{soles(venta.total)}</strong></div>
        </div>
      </div>
    </section>

    <section className="ops-card" aria-labelledby="titulo-envio-almacen">
      <div className="ops-card-heading">
        <div className="ops-section-title"><span className="ops-section-icon"><OpIcon name="caja" /></span>
          <div><h2 id="titulo-envio-almacen">Envío a Almacén</h2>
            <p>{despacho ? `Orden ${despacho.codigo} · ${despacho.estado}`
              : motivoEnvio ?? `Almacén recibirá el comprobante, el cliente, la dirección y ${pares} ${pares === 1 ? 'par' : 'pares'}, sin precios ni costos.`}</p></div></div>
        {!despacho && <button type="button" className={`ops-btn ${motivoEnvio ? '' : 'ops-btn-primary'}`}
          disabled={ocupado || Boolean(motivoEnvio)} onClick={() => abrir('enviar')}>Enviar a despacho</button>}
      </div>
    </section>

    {accion === 'emitir' && <Dialogo titulo={`Emitir ${propuesto.tipo?.toLowerCase()} ${propuesto.serie}`}
      ocupado={emision.isPending} error={emision.isError ? emision.error.message : ''}
      textoConfirmar={`Emitir ${propuesto.tipo?.toLowerCase()}`} textoOcupado="Emitiendo…"
      alConfirmar={() => emision.mutate()} alVolver={() => setAccion(null)}>
      <p>Se emitirá una {propuesto.tipo?.toLowerCase()} para <strong>{venta.razon_social_nombre}</strong> ({venta.tipo_documento} {venta.numero_documento}) por <strong>{soles(venta.total)}</strong>.</p>
      <p>Dirección: {direccionActual.replace(/\s+/g, ' ').trim()}</p>
      <p>El número se asigna al confirmar. Los importes son los de la venta confirmada y no se pueden editar.</p>
      <p className="ops-muted">Emitir el comprobante no modifica el stock.</p>
    </Dialogo>}

    {accion === 'anular' && vigente && <Dialogo titulo={`Anular ${vigente.tipo.toLowerCase()} ${codigoComprobante(vigente)}`}
      ocupado={anulacion.isPending} error={anulacion.isError ? anulacion.error.message : ''}
      textoConfirmar="Anular con nota de crédito" textoOcupado="Anulando…"
      puedeConfirmar={sustento.replace(/\s+/g, ' ').trim().length >= 5}
      alConfirmar={() => anulacion.mutate()} alVolver={() => setAccion(null)}>
      <p>Se registrará una nota de crédito por <strong>{soles(vigente.total)}</strong>. El número {codigoComprobante(vigente)} no se vuelve a usar.</p>
      <label className="ops-field">Motivo
        <select value={motivo} disabled={anulacion.isPending} onChange={e => setMotivo(e.target.value as MotivoNotaCredito)}>
          {(Object.keys(MOTIVOS_NOTA_CREDITO) as MotivoNotaCredito[]).map(codigo =>
            <option key={codigo} value={codigo}>{codigo} · {MOTIVOS_NOTA_CREDITO[codigo]}</option>)}
        </select>
      </label>
      <label className="ops-field">Sustento
        <textarea value={sustento} maxLength={250} disabled={anulacion.isPending}
          placeholder="Explica qué se corrige" onChange={e => setSustento(e.target.value)} />
      </label>
      <p className="ops-muted">Después podrás emitir un nuevo comprobante para esta venta.</p>
    </Dialogo>}

    {accion === 'enviar' && vigente && <Dialogo titulo="Enviar a Almacén"
      ocupado={envio.isPending} error={envio.isError ? envio.error.message : ''}
      textoConfirmar="Enviar a Almacén" textoOcupado="Enviando…"
      alConfirmar={() => envio.mutate()} alVolver={() => setAccion(null)}>
      <p>Se creará la orden de despacho con la {vigente.tipo.toLowerCase()} <strong>{codigoComprobante(vigente)}</strong>, el cliente, la dirección <strong>{venta.direccion}</strong> y {pares} {pares === 1 ? 'par' : 'pares'}.</p>
      <p>La venta pasará a <strong>En Almacén</strong>. Almacén no verá precios ni costos.</p>
      <p className="ops-muted">El stock no cambia hasta que Almacén registre la salida física.</p>
    </Dialogo>}
  </>
}

export default function VentasConfirmadasPage() {
  const vendedor = useAuthStore(s => s.user?.id_usuario)
  const { idVenta } = useParams()
  return idVenta ? <Detalle key={idVenta} vendedor={vendedor} idVenta={idVenta} /> : <Bandeja vendedor={vendedor} />
}
