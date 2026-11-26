import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { cerrarSesion } from '../services/authApi'
import { OpIcon } from './OperacionUI'
import '../operaciones.css'

const CambiosContext = createContext<(valor: boolean) => void>(() => {})
export const useCambiosOperacion = () => useContext(CambiosContext)
const modulos = [
  { rol: 'Compras', ruta: '/compras', titulo: 'Compras', icono: 'bolsa' },
  { rol: 'Ventas', ruta: '/ventas', titulo: 'Ventas', icono: 'ventas' },
  { rol: 'Almacen', ruta: '/almacen', titulo: 'Almacén', icono: 'caja' }
] as const

export default function OperacionLayout() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const [menu, setMenu] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState('')
  const disponibles = modulos.filter(m => user?.roles.includes(m.rol))
  const actual = disponibles.find(m => pathname.startsWith(m.ruta)) ?? disponibles[0]
  const enOtraSeccionAlmacen = /^\/almacen\/(?:pendientes-despacho|kardex)(?:\/|$)/i.test(pathname)
  const confirmar = () => !dirty || window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?')
  const navegar = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!confirmar()) {
      e.preventDefault()
      return
    }
    setMenu(false)
    setDirty(false)
  }
  const salir = async () => {
    if (!confirmar()) return
    setSaliendo(true); setError('')
    try { await cerrarSesion(); logout(); navigate('/login', { replace: true }) }
    catch { setError('No se pudo cerrar la sesión. Inténtalo nuevamente.') }
    finally { setSaliendo(false) }
  }
  const initials = user?.nombre.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('') ?? 'AY'
  return <div className="ops-shell">
    <a className="ops-skip" href="#contenido-operacion">Ir al contenido</a>
    <div className="ops-mobile-brand"><strong>AyM Shafety</strong><button className="ops-btn ops-btn-dark" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} aria-controls="operacion-nav" onClick={() => setMenu(!menu)}><OpIcon name="menu" /> Menú</button></div>
    <aside id="operacion-nav" className={`ops-sidebar ${menu ? 'is-open' : ''}`}>
      <div className="ops-brand"><span className="ops-brand-mark"><OpIcon name="bolsa" /></span><div>AyM Shafety<small>GESTIÓN COMERCIAL</small></div></div>
      <p className="ops-nav-caption">ESPACIO DE TRABAJO</p>
      <nav aria-label="Navegación de operaciones">
        {disponibles.map(m => (
          <NavLink
            key={m.ruta} to={m.ruta} end={m.rol === 'Compras' && /^\/compras\/(?:emitidas|historico)(?:\/|$)/.test(pathname) || m.rol === 'Almacen' && enOtraSeccionAlmacen || m.rol === 'Ventas'} onClick={navegar}
            className={({ isActive }) => `ops-nav-link ${isActive || pathname === '/inicio' && actual === m ? 'is-active' : ''}`}
          >
            <OpIcon name={m.icono} />{m.rol === 'Almacen' ? 'Pendientes de recepción' : m.titulo}
          </NavLink>
        ))}
        {user?.roles.includes('Compras') && <>
          <NavLink to="/compras/emitidas" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}><OpIcon name="documento" />Órdenes emitidas</NavLink>
          <NavLink to="/compras/historico" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}><OpIcon name="reloj" />Histórico</NavLink>
        </>}
        {user?.roles.includes('Ventas') && <>
          <NavLink to="/ventas/disponibilidad" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}>
            <OpIcon name="buscar" />Disponibilidad
          </NavLink>
          <NavLink to="/ventas/precios" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}>
            <OpIcon name="documento" />Precios de venta
          </NavLink>
          <NavLink to="/ventas/confirmadas" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}>
            <OpIcon name="documento" />Ventas confirmadas
          </NavLink>
        </>}
        {user?.roles.includes('Almacen') && <>
          <NavLink
            to="/almacen/pendientes-despacho"
            onClick={navegar}
            className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}
          >
            <OpIcon name="documento" />Pendientes de despacho
          </NavLink>
          <NavLink to="/almacen/kardex" onClick={navegar} className={({ isActive }) => `ops-nav-link ${isActive ? 'is-active' : ''}`}><OpIcon name="documento" />Kardex</NavLink>
        </>}
      </nav>
      <div className="ops-sidebar-bottom"><span className="ops-avatar">{initials}</span><div><strong>{user?.nombre}</strong><small>{actual?.titulo ?? 'Operaciones'}</small></div><button className="ops-icon-button" aria-label="Cerrar sesión" disabled={saliendo} onClick={() => void salir()}><OpIcon name="salir" /></button></div>
    </aside>
    <div className="ops-main">
      <header className="ops-topbar"><div className="ops-breadcrumb">AyM Shafety <span>/</span> <strong>{actual?.titulo ?? 'Operaciones'}</strong></div><div className="ops-identity"><div><strong>{user?.nombre}</strong><small>{actual ? `Área de ${actual.titulo}` : 'Operaciones'}</small></div><span className="ops-avatar ops-avatar-light">{initials}</span></div></header>
      <main id="contenido-operacion" className="ops-content">
        {error && <p className="ops-alert ops-alert-error" role="alert">{error}</p>}
        <CambiosContext.Provider value={setDirty}><Outlet /></CambiosContext.Provider>
      </main>
    </div>
  </div>
}
