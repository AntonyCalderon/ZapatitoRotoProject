import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Home() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <span className="font-bold text-slate-900">Mi espacio</span>
        <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cerrar sesión</button>
      </div></header>
      <section className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Inicio</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">¡Hola, {user?.name}!</h1>
        <p className="mt-3 text-slate-600">Has iniciado sesión con <span className="font-medium">{user?.email}</span>.</p>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Tu sesión está activa</h2><p className="mt-2 text-slate-600">Esta página está protegida y se conserva al recargar.</p></div>
      </section>
    </main>
  )
}
