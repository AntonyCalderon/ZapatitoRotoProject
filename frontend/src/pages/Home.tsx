import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { OpIcon } from '../components/OperacionUI'

export default function Home() {
  const user = useAuthStore(s => s.user)
  const { pathname } = useLocation()
  const almacen = pathname.startsWith('/almacen') || !pathname.startsWith('/ventas') && user?.roles.includes('Almacen') && !user.roles.includes('Ventas')
  const titulo = almacen ? 'Almacén' : 'Ventas'
  return <>
    <div className="ops-page-heading"><div><p className="ops-eyebrow">ESPACIO DE TRABAJO</p><h1>{titulo}</h1><p>¡Hola, {user?.nombre}!</p></div></div>
    <section className="ops-card ops-placeholder"><span className="ops-empty-icon"><OpIcon name={almacen ? 'caja' : 'ventas'} /></span><span className="ops-badge">En preparación</span><h2>Tu espacio de {titulo.toLowerCase()}</h2><p>Aquí se incorporarán las herramientas de {almacen ? 'almacén' : 'ventas'}.</p></section>
  </>
}
