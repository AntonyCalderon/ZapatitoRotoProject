import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Role, User } from '../services/authService'

interface SessionUser { name: string; email: string; role: Role }
interface AuthState {
  user: SessionUser | null
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user: { name: user.name, email: user.email, role: user.role } }),
      logout: () => set({ user: null }),
    }),
    { name: 'registro-login-session', storage: createJSONStorage(() => localStorage) },
  ),
)