import { useEffect, useState } from 'react'
import { cambiarEstadoUsuario, crearUsuario, obtenerRoles, obtenerUsuarios, type Rol, type Usuario } from '../services/usuarioService'
import { useAuthStore } from '../store/authStore'

const campo = 'w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export default function UsuariosPage() {
  const idActual = useAuthStore(state => state.user?.id_usuario)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [cargando, setCargando] = useState(true)
  const [rolesCargados, setRolesCargados] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cambiando, setCambiando] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [temporal, setTemporal] = useState<{ nombre: string; password: string } | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [copia, setCopia] = useState('')

  useEffect(() => {
    let vigente = true
    void Promise.allSettled([obtenerUsuarios(), obtenerRoles()]).then(([lista, disponibles]) => {
      if (!vigente) return
      if (lista.status === 'fulfilled') setUsuarios(lista.value)
      else setError(lista.reason instanceof Error ? lista.reason.message : 'No se pudieron cargar los usuarios.')
      if (disponibles.status === 'fulfilled') { setRoles(disponibles.value); setRolesCargados(true) }
      else setError(disponibles.reason instanceof Error ? disponibles.reason.message : 'No se pudieron cargar los roles.')
      setCargando(false)
    })
    return () => { vigente = false }
  }, [])

  const guardar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(''); setMensaje('')
    if (!nombre.trim() || nombre.trim().length > 100) return setError('Ingresa un nombre de hasta 100 caracteres.')
    if (correo.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return setError('Ingresa un correo electrónico válido.')
    if (!seleccion.length) return setError('Selecciona al menos un rol.')
    setGuardando(true)
    try {
      const resultado = await crearUsuario({ nombre: nombre.trim(), correo: correo.trim(), roles: seleccion })
      // La contraseña se conserva solo mientras el diálogo está abierto.
      setTemporal({ nombre: resultado.usuario.nombre, password: resultado.passwordTemporal })
      setConfirmado(false); setCopia('')
      setUsuarios(actuales => [...actuales, resultado.usuario])
      setNombre(''); setCorreo(''); setSeleccion([])
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.') }
    finally { setGuardando(false) }
  }

  const cambiarEstado = async (usuario: Usuario) => {
    if (usuario.activo && usuario.id_usuario === idActual) return
    if (usuario.activo && !window.confirm(`¿Deseas desactivar la cuenta de ${usuario.nombre}?`)) return
    setError(''); setMensaje(''); setCambiando(usuario.id_usuario)
    try {
      const respuesta = await cambiarEstadoUsuario(usuario.id_usuario, !usuario.activo)
      setUsuarios(actuales => actuales.map(item => item.id_usuario === usuario.id_usuario ? { ...item, ...respuesta.usuario } : item))
      setMensaje(respuesta.usuario.activo ? 'Cuenta activada.' : 'Cuenta desactivada.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.') }
    finally { setCambiando(null) }
  }

  const copiar = async () => {
    if (!temporal) return
    try { await navigator.clipboard.writeText(temporal.password); setCopia('Contraseña copiada.'); setConfirmado(true) }
    catch { setCopia('No se pudo copiar. Selecciona y copia la contraseña manualmente.') }
  }

  return <div className="min-w-0 space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">Crear usuario</h2>
      <p className="mt-1 text-sm text-slate-600">Registra un trabajador y asigna sus roles.</p>
      <form className="mt-6 space-y-5" onSubmit={guardar} noValidate>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">Nombre completo<input className={`${campo} mt-2 font-normal`} value={nombre} maxLength={100} onChange={e => setNombre(e.target.value)} autoComplete="name" /></label>
          <label className="block text-sm font-semibold text-slate-800">Correo electrónico<input className={`${campo} mt-2 font-normal`} type="email" value={correo} maxLength={150} onChange={e => setCorreo(e.target.value)} autoComplete="email" /></label>
        </div>
        <fieldset><legend className="text-sm font-semibold text-slate-800">Roles</legend>
          {cargando ? <p className="mt-2 text-sm text-slate-500">Cargando roles...</p> : !rolesCargados ? <p className="mt-2 text-sm text-rose-700">No se pudieron cargar los roles.</p> : roles.length === 0 ? <p className="mt-2 text-sm text-slate-500">No hay roles disponibles.</p> :
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">{roles.map(rol => <label key={rol.id_rol} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={seleccion.includes(rol.id_rol)} onChange={e => setSeleccion(actuales => e.target.checked ? [...actuales, rol.id_rol] : actuales.filter(id => id !== rol.id_rol))} />{rol.nombre_rol}</label>)}</div>}
        </fieldset>
        <div className="flex justify-end"><button type="submit" disabled={guardando || !rolesCargados || roles.length === 0 || temporal !== null} className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{guardando ? 'Creando...' : 'Crear usuario'}</button></div>
      </form>
    </section>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {mensaje && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensaje}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6"><h2 className="text-xl font-bold text-slate-900">Trabajadores registrados</h2></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-indigo-50 text-slate-700"><tr>{['Nombre', 'Correo', 'Roles', 'Estado', 'Acción'].map(titulo => <th key={titulo} scope="col" className="px-6 py-4 font-semibold">{titulo}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{cargando ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Cargando usuarios...</td></tr> : usuarios.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No hay usuarios registrados.</td></tr> : usuarios.map(usuario => <tr key={usuario.id_usuario}>
          <td className="px-6 py-4 font-semibold text-slate-900">{usuario.nombre}</td><td className="px-6 py-4 text-slate-600">{usuario.correo}</td><td className="px-6 py-4 text-slate-600">{usuario.roles.join(', ') || 'Sin roles activos'}</td><td className="px-6 py-4">{usuario.activo ? 'Activo' : 'Inactivo'}</td>
          <td className="px-6 py-4"><button type="button" onClick={() => void cambiarEstado(usuario)} disabled={cambiando !== null || (usuario.activo && usuario.id_usuario === idActual)} title={usuario.activo && usuario.id_usuario === idActual ? 'No puedes desactivar tu propia cuenta' : undefined} className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{cambiando === usuario.id_usuario ? 'Procesando...' : usuario.activo ? 'Desactivar' : 'Activar'}</button></td>
        </tr>)}</tbody></table></div>
    </section>
    {temporal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="titulo-temporal" aria-describedby="aviso-temporal" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="titulo-temporal" className="text-xl font-bold text-slate-900">Contraseña temporal</h2><p className="mt-3 text-sm text-slate-700">Cuenta creada para <strong>{temporal.nombre}</strong>.</p>
      <p id="aviso-temporal" className="mt-3 text-sm font-semibold text-amber-800">Esta contraseña se mostrará una sola vez. Guárdala antes de cerrar.</p>
      <p className="mt-4 break-all rounded-lg bg-slate-100 p-3 font-mono text-slate-900">{temporal.password}</p>
      <button type="button" onClick={() => void copiar()} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Copiar contraseña</button>
      {copia && <p role="status" className="mt-2 text-sm text-slate-600">{copia}</p>}
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />He guardado la contraseña y entiendo que no se volverá a mostrar.</label>
      <button type="button" disabled={!confirmado} onClick={() => { setTemporal(null); setCopia(''); setConfirmado(false) }} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-50">Cerrar</button>
    </div></div>}
  </div>
}
