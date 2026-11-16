
import { create } from 'zustand'
import type { UsuarioAutenticado } from '../services/authApi'

// Guardamos los datos públicos del usuario autenticado.
// La sesión real se mantiene en el backend.
interface AuthState {
  user: UsuarioAutenticado | null
  setUser: (user: UsuarioAutenticado) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  // Actualizamos el usuario después de iniciar sesión.
  setUser: (user) => set({ user }),

  // Limpiamos los datos del usuario en React.
  logout: () => set({ user: null })
}))
