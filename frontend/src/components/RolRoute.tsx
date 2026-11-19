import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RolRoute({ rol }: { rol: string }) {
  const permitido = useAuthStore(s => s.user?.roles.includes(rol))
  return permitido ? <Outlet /> : <Navigate to="/inicio" replace />
}
