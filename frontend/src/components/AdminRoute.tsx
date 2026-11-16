
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function AdminRoute() {
  const user = useAuthStore((state) => state.user)

  // Solo un usuario con rol Administrador puede abrir esta página.
  const esAdministrador = user?.roles.includes('Administrador') ?? false

  if (!esAdministrador) {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}
