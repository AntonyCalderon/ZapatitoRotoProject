import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Cliente { tipo: string; nombre: string; documento: string }
const tipos = ['Gobierno Regional', 'Municipio', 'Privado', 'Particular']
const campo = 'mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700'

async function consultar<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch('/api/ventas/' + ruta, { credentials: 'include', ...opciones })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos) throw new Error(datos?.mensaje || 'No se pudo completar la operación.')
  return datos
}

function Formulario({ inicial, id, vendedor }: { inicial?: Cliente; id?: string; vendedor?: number }) {
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [tipo, setTipo] = useState(tipos.includes(inicial?.tipo ?? '') ? inicial!.tipo : '')
  const [documento, setDocumento] = useState(inicial?.documento ?? '')
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const particular = tipo === 'Particular'
  const etiqueta = particular ? 'Nombre' : tipo === 'Privado' ? 'Razón social' : 'Entidad estatal'
  const valido = Boolean(tipo) && (particular ? /^\d{8}$/ : /^\d{11}$/).test(documento)
  const busqueda = useQuery({
    queryKey: ['ventas', vendedor, 'cliente', documento],
    queryFn: ({ signal }) => consultar<{ cliente: Cliente | null }>('clientes/' + documento, { signal }),
    enabled: valido, retry: false
  })
  const existente = valido ? busqueda.data?.cliente : null
  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    if (!tipo) return setError('Selecciona el tipo de cliente.')
    if (!valido) return setError(particular ? 'Ingresa un DNI de 8 dígitos.' : 'Ingresa un RUC de 11 dígitos.')
    if (!busqueda.isSuccess) return
    const nombreCliente = (existente?.nombre ?? nombre).trim()
    if (!nombreCliente) return setError(
      particular ? 'Ingresa el nombre.' : tipo === 'Privado' ? 'Ingresa la razón social.' : 'Ingresa la entidad estatal.'
    )
    setError('')
    setOcupado(true)
    try {
      const orden = await consultar<{ id_orden_venta: number }>(id ? 'borradores/' + id + '/cliente' : 'borradores', {
        method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, documento, nombre: nombreCliente })
      })
      await cache.invalidateQueries({ queryKey: ['ventas'] })
      navigate('/ventas/precios/' + orden.id_orden_venta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el borrador.')
    } finally { setOcupado(false) }
  }
  return <><div className="ops-page-heading"><div><p className="ops-eyebrow">Ventas</p>
    <h1>{id ? 'Cliente del borrador #' + id : 'Nueva venta'}</h1></div>
    <Link className="ops-btn" to="/ventas/precios">Ver borradores</Link></div>
    <form className="ops-card" onSubmit={guardar} noValidate><div className="ops-card-heading"><h2>Datos del cliente</h2></div>
      <fieldset className="grid gap-4 p-6" disabled={ocupado}>
        <label className="ops-field">Tipo de cliente<select required value={tipo} onChange={e => { setTipo(e.target.value); setError('') }}>
          <option value="">Seleccionar tipo</option>{tipos.map(t => <option key={t}>{t}</option>)}</select></label>
        {tipo && <><label className="ops-field">{particular ? 'DNI (8 dígitos)' : 'RUC (11 dígitos)'}
          <input className={campo} required inputMode="numeric" pattern={particular ? '[0-9]{8}' : '[0-9]{11}'} value={documento}
            onChange={e => { setDocumento(e.target.value); setNombre(''); setError('') }} /></label>
          {valido && busqueda.isFetching && <p role="status">Buscando cliente…</p>}
          {valido && busqueda.isError && <div role="alert">No se pudo buscar el documento. <button type="button" onClick={() => void busqueda.refetch()}>Reintentar</button></div>}
          {valido && busqueda.isSuccess && <><p role="status">{existente ? `Cliente registrado · ${existente.tipo}` : 'Cliente nuevo'}</p>
            <label className="ops-field">{etiqueta}<input className={campo} required maxLength={180} value={existente?.nombre ?? nombre}
              readOnly={Boolean(existente)} onChange={e => { setNombre(e.target.value); setError('') }} /></label></>}
        </>}
        {error && <p className="ops-alert ops-alert-error" role="alert">{error}</p>}
        <button className="ops-btn ops-btn-primary" disabled={ocupado || (valido && !busqueda.isSuccess)}>
          {ocupado ? 'Guardando…' : 'Guardar y continuar a precios'}</button>
      </fieldset></form></>
}

export default function VentaClientePage() {
  const { id } = useParams()
  const vendedor = useAuthStore(s => s.user?.id_usuario)
  const consulta = useQuery({
    queryKey: ['ventas', vendedor, 'cliente-borrador', id],
    queryFn: ({ signal }) => consultar<Cliente>('borradores/' + id + '/cliente', { signal }),
    enabled: Boolean(id), retry: false
  })
  if (id && consulta.isPending) return <p role="status">Cargando cliente…</p>
  if (id && consulta.isError) return <p role="alert">{consulta.error.message} <Link to="/ventas/precios">Volver a borradores</Link></p>
  return <Formulario key={id ?? 'nueva'} inicial={id ? consulta.data : undefined} id={id} vendedor={vendedor} />
}
