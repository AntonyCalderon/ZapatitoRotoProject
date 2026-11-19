import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function ComprasRoute() {
  const user = useAuthStore((state) => state.user)

  // RN-02: solo el Encargado de Compras puede entrar a esta sección.
  const esCompras = user?.roles.includes('Compras') ?? false

  if (!esCompras) {
    return <Navigate to="/inicio" replace />
  }

  return <Outlet />
}
