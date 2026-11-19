import { useEffect, useRef, useState } from 'react'
import ModeloCombobox from './ModeloCombobox'
import { OpIcon, soles } from './OperacionUI'
import { obtenerCatalogoCompra, type CatalogoCompra } from '../services/lineaCompraService'
import { formatearTalla, type LineaSolicitud } from '../utils/lineasCompra'

interface Fila { clave: number; modelo: string; talla: string; color: string; cantidad: string }
const vacia = (clave: number): Fila => ({ clave, modelo: '', talla: '', color: '', cantidad: '' })
const normalizar = (texto: string) => texto.trim().toLocaleLowerCase('es')

export default function AgregarProductosDialog({ cerrar, agregar }: { cerrar: () => void; agregar: (lineas: LineaSolicitud[]) => string | undefined }) {
  const [catalogo, setCatalogo] = useState<CatalogoCompra | null>(null)
  const [filas, setFilas] = useState<Fila[]>([vacia(1)])
  const [cargando, setCargando] = useState(true)
  const [errorConsulta, setErrorConsulta] = useState('')
  const [errorSeleccion, setErrorSeleccion] = useState('')
  const [intento, setIntento] = useState(0)
  const siguiente = useRef(2)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('button')?.focus()
    return () => { document.body.style.overflow = overflow; anterior?.focus() }
  }, [])
  useEffect(() => {
    let activo = true
    setCargando(true); setErrorConsulta('')
    obtenerCatalogoCompra().then(datos => { if (activo) setCatalogo(datos) })
      .catch(e => { if (activo) setErrorConsulta(e instanceof Error ? e.message : 'No se pudo consultar el catálogo.') })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [intento])
  const etiquetaModelo = (modelo: NonNullable<typeof catalogo>['modelos'][number]) => {
    const repetidos = catalogo?.modelos.filter(m => normalizar(m.nombre_modelo) === normalizar(modelo.nombre_modelo)).length ?? 0
    return repetidos > 1 ? `${modelo.nombre_modelo} · #${modelo.id_modelo}` : modelo.nombre_modelo
  }
  const analizar = (fila: Fila) => {
    const usado = Boolean(fila.modelo || fila.talla || fila.color || fila.cantidad)
    const modelo = catalogo?.modelos.find(m => normalizar(etiquetaModelo(m)) === normalizar(fila.modelo))
    const variante = catalogo?.variantes.find(v => v.id_modelo === modelo?.id_modelo && v.id_talla === Number(fila.talla) && v.id_color === Number(fila.color))
    const referencia = catalogo?.variantes.find(v => v.id_modelo === modelo?.id_modelo && v.id_talla === Number(fila.talla))
    const cantidad = Number(fila.cantidad)
    const cantidadValida = /^\d+$/.test(fila.cantidad) && Number.isSafeInteger(cantidad) && cantidad > 0 && cantidad <= 100000
    let problema = ''
    if (fila.modelo.trim() && !modelo) problema = 'Selecciona un modelo del catálogo.'
    else if (modelo && fila.talla && fila.color && !variante) problema = 'Esta combinación no tiene un SKU disponible.'
    else if (fila.cantidad && !cantidadValida) problema = 'Cantidad: entero entre 1 y 100000.'
    return { usado, variante, referencia, cantidad, problema, valido: Boolean(variante && cantidadValida) }
  }
  const estados = filas.map(analizar)
  const validas = estados.filter(e => e.valido)
  const incompletas = estados.some(e => e.usado && !e.valido)
  const bloqueado = cargando || Boolean(errorConsulta) || !catalogo?.variantes.length
  const cambiar = (clave: number, campo: keyof Omit<Fila, 'clave'>, valor: string) => {
    setFilas(actuales => actuales.map(f => f.clave === clave ? { ...f, [campo]: valor } : f))
    setErrorSeleccion('')
  }
  const seleccionar = () => {
    if (!validas.length || incompletas || bloqueado) return
    const nuevas = estados.filter(e => e.valido).map(e => ({
      id_sku: e.variante!.id_sku, codigo_sku: e.variante!.codigo_sku,
      nombre_modelo: e.variante!.nombre_modelo, nombre_color: e.variante!.nombre_color,
      numero_talla: e.variante!.numero_talla, cantidad: e.cantidad
    }))
    const problema = agregar(nuevas)
    if (problema) setErrorSeleccion(problema)
    else cerrar()
  }
  return <div className="ops-dialog-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="agregar-titulo" className="ops-dialog ops-variants-dialog" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar() }
    if (e.key === 'Tab') {
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled])')
      if (!items?.length) return
      const primero = items[0], ultimo = items[items.length - 1]
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }
  }}>
    <div className="ops-card-heading"><div><h2 id="agregar-titulo">Agregar productos</h2><p>Selecciona modelo, talla y color en el orden que prefieras.</p></div><button type="button" className="ops-icon-button" aria-label="Cerrar selección de productos" onClick={cerrar}><OpIcon name="cerrar" /></button></div>
    <div className="ops-dialog-body">
      {cargando && <p className="ops-catalog-status" role="status">Consultando catálogo y costos base…</p>}
      {errorConsulta && <div className="ops-alert ops-alert-error" role="alert">{errorConsulta}<button type="button" className="ops-text-button" onClick={() => setIntento(n => n + 1)}>Reintentar consulta</button></div>}
      {errorSeleccion && <p className="ops-alert ops-alert-error" role="alert">{errorSeleccion}</p>}
      {!cargando && !errorConsulta && !catalogo?.variantes.length && <p className="ops-catalog-status">No hay productos disponibles. Revisa las variantes activas en Productos SKU.</p>}
      <div className="ops-table-scroll"><table className="ops-variant-table" aria-label="Productos por agregar"><thead><tr><th>Modelo</th><th>Talla</th><th>Color</th><th className="ops-number">Cantidad</th><th className="ops-number">Costo base / par</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {filas.map((fila, index) => {
          const estado = estados[index]
          const costo = estado.referencia?.costo_base_vigente
          return <tr key={fila.clave}>
            <td><ModeloCombobox etiqueta={`Modelo de la fila ${index + 1}`} valor={fila.modelo} opciones={catalogo?.modelos.map(etiquetaModelo) ?? []} disabled={bloqueado} cambiar={valor => cambiar(fila.clave, 'modelo', valor)} descripcion={estado.problema ? `problema-fila-${fila.clave}` : undefined} />{estado.problema && <span id={`problema-fila-${fila.clave}`} className="ops-variant-error" role="alert">{estado.problema}</span>}</td>
            <td><select aria-label={`Talla de la fila ${index + 1}`} value={fila.talla} disabled={bloqueado} onChange={e => cambiar(fila.clave, 'talla', e.target.value)}><option value="">Elegir</option>{catalogo?.tallas.map(t => <option key={t.id_talla} value={t.id_talla}>{formatearTalla(t.numero_talla)}</option>)}</select></td>
            <td><select aria-label={`Color de la fila ${index + 1}`} value={fila.color} disabled={bloqueado} onChange={e => cambiar(fila.clave, 'color', e.target.value)}><option value="">Elegir color</option>{catalogo?.colores.map(c => <option key={c.id_color} value={c.id_color}>{c.nombre_color}</option>)}</select></td>
            <td><input aria-label={`Cantidad de la fila ${index + 1}`} type="number" min={1} max={100000} step={1} value={fila.cantidad} placeholder="0" disabled={bloqueado} onChange={e => cambiar(fila.clave, 'cantidad', e.target.value)} /></td>
            <td><span className={`ops-variant-cost ${costo == null ? 'is-pending' : ''}`}>{!fila.modelo || !fila.talla ? 'Por seleccionar' : estado.referencia ? costo == null ? 'Sin costo registrado' : soles(costo) : 'No disponible'}</span></td>
            <td><button type="button" className="ops-icon-button" aria-label={`Quitar fila ${index + 1}`} disabled={filas.length === 1} onClick={() => { setFilas(fs => fs.filter(f => f.clave !== fila.clave)); setErrorSeleccion('') }}><OpIcon name="quitar" /></button></td>
          </tr>
        })}
      </tbody></table></div>
      <button type="button" className="ops-btn ops-btn-accent ops-add-variant" disabled={bloqueado} onClick={() => setFilas(fs => [...fs, vacia(siguiente.current++)])}><OpIcon name="mas" />Agregar otra fila</button>
      {incompletas && <p className="ops-variant-help">Completa modelo, talla, color y cantidad en cada fila utilizada.</p>}
      <div className="ops-variants-summary"><span>Costo base de consulta · Solo lectura</span><span aria-live="polite">{validas.length} {validas.length === 1 ? 'línea' : 'líneas'} · {validas.reduce((suma, e) => suma + e.cantidad, 0)} pares</span></div>
    </div>
    <div className="ops-card-actions"><button type="button" className="ops-btn" onClick={cerrar}>Volver al borrador</button><button type="button" className="ops-btn ops-btn-primary" disabled={bloqueado || !validas.length || incompletas} onClick={seleccionar}><OpIcon name="mas" />Agregar a la solicitud</button></div>
  </div></div>
}
