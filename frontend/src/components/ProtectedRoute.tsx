import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../services/authService'
import { useAuthStore } from '../store/authStore'

type Props = { allowedRoles?: Role[]; children?: ReactNode }

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const user = useAuthStore((state) => state.user)

  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/inicio" replace state={{ denied: true }} />
  }
  return children ?? <Outlet />
}
