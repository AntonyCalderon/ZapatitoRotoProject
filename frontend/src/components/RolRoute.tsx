import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RolRoute({ rol, permiteAdministrador = false }: { rol: string; permiteAdministrador?: boolean }) {
  const permitido = useAuthStore(s => s.user?.roles.includes(rol) || (permiteAdministrador && s.user?.roles.includes('Administrador')))
  return permitido ? <Outlet /> : <Navigate to="/inicio" replace />
}
