import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { User } from '../services/authService'

interface AuthState { user: Omit<User, 'password'> | null; setUser: (user: User) => void; logout: () => void }

export const useAuthStore = create<AuthState>()(persist((set) => ({
  user: null,
  setUser: (user) => set({ user: { name: user.name, email: user.email } }),
  logout: () => set({ user: null }),
}), { name: 'registro-login-session', storage: createJSONStorage(() => localStorage) }))
