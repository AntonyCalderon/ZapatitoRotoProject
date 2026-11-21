import { useState } from 'react'
import OperacionLayout from './OperacionLayout'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cerrarSesion } from '../services/authApi'
import { useAuthStore } from '../store/authStore'

type Icono = 'inicio' | 'modelos' | 'tallas' | 'colores' | 'sku' | 'costos' | 'perfil' | 'usuarios'

function Icon({ tipo, className = 'h-5 w-5' }: { tipo: Icono; className?: string }) {
  const trazos: Record<Icono, React.ReactNode> = {
    inicio: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    modelos: <><path d="m12 2 8 4.5v11L12 22l-8-4.5v-11L12 2Z" /><path d="m4 6.5 8 4.5 8-4.5M12 11v11" /></>,
    tallas: <><path d="M4 3 3 7l14 14 4-4L7 3 4 3Z" /><path d="m7 7 2-2m1 5 2-2m1 5 2-2m1 5 2-2" /></>,
    colores: <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" /><circle cx="7.5" cy="10" r=".7" /><circle cx="11" cy="6.5" r=".7" /><circle cx="16" cy="8" r=".7" /></>,
    sku: <><path d="m12 2 4 2.3v4.6L12 11l-4-2.1V4.3L12 2Zm-6 9 4 2.3v4.6L6 20l-4-2.1v-4.6L6 11Zm12 0 4 2.3v4.6L18 20l-4-2.1v-4.6L18 11Z" /><path d="M12 11v3m-2 2 4 2" /></>,
    costos: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18m-5 5h5" /></>,
    perfil: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="2.5" /><path d="M7.5 18c.5-2.2 2-3.5 4.5-3.5s4 1.3 4.5 3.5" /></>,
    usuarios: <><circle cx="9" cy="8" r="3" /><path d="M3 19v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" /></>
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{trazos[tipo]}</svg>
}

const enlaces: { ruta: string; texto: string; icono: Icono }[] = [
  { ruta: '/inicio', texto: 'Inicio', icono: 'inicio' },
  { ruta: '/modelos', texto: 'Modelos', icono: 'modelos' },
  { ruta: '/tallas', texto: 'Tallas', icono: 'tallas' },
  { ruta: '/colores', texto: 'Colores', icono: 'colores' },
  { ruta: '/productos-sku', texto: 'Productos SKU', icono: 'sku' },
  { ruta: '/costos-base', texto: 'Costos base', icono: 'costos' },
  { ruta: '/usuarios', texto: 'Gestión de Usuarios', icono: 'usuarios' },
  { ruta: '/margenes', texto: 'Márgenes de utilidad', icono: 'costos' } // NUEVO
]

const titulos: Record<string, string> = {
  '/inicio': 'Bienvenido',
  '/modelos': 'Modelos',
  '/tallas': 'Tallas',
  '/colores': 'Colores',
  '/productos-sku': 'Productos SKU',
  '/costos-base': 'Costos base',
  '/margenes': 'Márgenes de utilidad', // NUEVO
  '/usuarios': 'Gestión de Usuarios'
}

export default function AdminLayout() {
  const usuario = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [errorSalida, setErrorSalida] = useState('')

  // El inicio de otros roles conserva su pantalla sin menú administrativo.
  if (!usuario?.roles.includes('Administrador') || /^\/(compras|ventas|almacen)(\/|$)/.test(pathname)) return <OperacionLayout />

  const cerrar = async () => {
    setCerrandoSesion(true)
    setErrorSalida('')
    try {
      await cerrarSesion()
      logout()
      navigate('/login', { replace: true })
    } catch {
      setErrorSalida('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    } finally {
      setCerrandoSesion(false)
    }
  }

  const enlace = ({ ruta, texto, icono }: (typeof enlaces)[number]) => (
    <NavLink
      key={ruta}
      to={ruta}
      end
      onClick={() => setMenuAbierto(false)}
      className={({ isActive }) => `flex h-12 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors ${isActive ? 'bg-[#3730A3] font-semibold text-white' : 'text-[#F3F3FA] hover:bg-white/10'}`}
    >
      <Icon tipo={icono} className="h-[19px] w-[19px] shrink-0 text-[#C8D0FF]" />
      {texto}
    </NavLink>
  )

  return (
    <div className="min-h-screen bg-white p-3 sm:px-8 sm:py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1500px] overflow-hidden rounded-[20px] border border-[#ECEDEF] bg-[#F7F7F8] md:grid md:grid-cols-[330px_minmax(0,1fr)]">
        {/* En móvil, el menú se despliega debajo de este encabezado. */}
        <div className="flex items-center justify-between bg-[#191D42] px-4 py-3 text-white md:hidden">
          <span className="text-lg font-semibold">AyM Shafety</span>
          <button type="button" aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} aria-controls="admin-navigation" onClick={() => setMenuAbierto(!menuAbierto)} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium">
            Menú
          </button>
        </div>

        <aside id="admin-navigation" className={`${menuAbierto ? 'block' : 'hidden'} bg-[#191D42] px-4 pb-6 pt-4 text-white md:block md:min-h-full md:px-[15px] md:pt-[17px]`}>
          <div className="hidden items-center gap-3 px-1 text-[17px] font-bold tracking-tight md:flex">
            <svg className="h-7 w-5 text-[#AEB9FF]" viewBox="0 0 22 30" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 2c2 0 3 2 2 5L6 13c-.4 2-3 2-4 0L1 8c0-3 1-6 4-6Zm11 13c2 0 3 2 3 5l1 5c0 2-2 3-4 2l-3-5c-2-3 0-7 3-7ZM4 16l2 4m10-9 2-3" /></svg>
            AyM Shafety
          </div>
          <div className="mb-6 mt-[25px] hidden border-t border-white/15 md:block" />
          <nav aria-label="Navegación administrativa" className="space-y-1">
            {enlace(enlaces[0])}
            <p className="px-1 pb-1 pt-[13px] text-xs font-semibold text-[#ABB7EF]">CATÁLOGO</p>
            {enlaces.slice(1, 5).map(enlace)}
            <p className="px-1 pb-1 pt-[13px] text-xs font-semibold text-[#ABB7EF]">COSTOS</p>
            {enlace(enlaces[5])}
            {enlace(enlaces[7])} {/* NUEVO */}
            <p className="px-1 pb-1 pt-[13px] text-xs font-semibold text-[#ABB7EF]">ADMINISTRACIÓN</p>
            {enlace(enlaces[6])}
          </nav>
        </aside>

        <div className="min-w-0 bg-[#F7F7F8] px-4 pb-4 pt-[14px] sm:px-5 md:px-4">
          <header className="relative mb-[18px] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] leading-5 text-[#6E6E73]">Panel de Administración</p>
              <h1 className="truncate text-[18px] font-semibold leading-7 text-[#25262B]">{titulos[pathname] ?? 'Administración'}</h1>
            </div>
            <div className="relative shrink-0">
              <button type="button" aria-label="Abrir perfil" aria-expanded={perfilAbierto} onClick={() => setPerfilAbierto(!perfilAbierto)} className="rounded-full p-1 text-[#676C70] hover:bg-slate-200/70">
                <Icon tipo="perfil" className="h-6 w-6" />
              </button>
              {perfilAbierto && (
                <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="truncate text-sm font-semibold text-slate-900">{usuario.nombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Administrador</p>
                  <button type="button" disabled={cerrandoSesion} onClick={() => void cerrar()} className="mt-3 w-full rounded-lg bg-[#3730A3] px-3 py-2 text-left text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50">
                    {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
                  </button>
                </div>
              )}
            </div>
          </header>
          {errorSalida && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorSalida}</p>}
          <div className="min-w-0"><Outlet /></div>
        </div>
      </div>
    </div>
  )
}