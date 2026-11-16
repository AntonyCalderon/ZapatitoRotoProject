
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { obtenerSesion } from '../services/authApi'

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)

  const [cargando, setCargando] = useState(true)
  const { pathname } = useLocation()

  useEffect(() => {
    let activo = true

    // Al entrar o recargar, preguntamos a Express si la sesión sigue activa.
    obtenerSesion()
      .then(({ usuario }) => {
        if (activo) setUser(usuario)
      })
      .catch(() => {
        // Si la sesión ya no existe, quitamos el usuario de Zustand.
        if (activo) logout()
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    // Evitamos actualizar el componente si ya se desmontó.
    return () => {
      activo = false
    }
  }, [setUser, logout])

  // Esperamos la respuesta del backend antes de decidir la ruta.
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Verificando sesión...</p>
      </div>
    )
  }

  // Sin sesión válida, regresamos al login.
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.debe_cambiar_password && pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />
  }
  if (!user.debe_cambiar_password && pathname === '/cambiar-password') {
    return <Navigate to="/inicio" replace />
  }

  // Con sesión válida, mostramos la página solicitada.
  return <Outlet />
}
