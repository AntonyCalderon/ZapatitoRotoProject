import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { cerrarSesion } from '../services/authApi'

export default function Home() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  // Solo el Encargado de Compras ve el acceso a solicitudes de compra.
  const esCompras = user?.roles.includes('Compras') ?? false

  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [errorSalida, setErrorSalida] = useState('')

  // Cerramos la sesión tanto en Express como en React.
  const handleLogout = async () => {
    setCerrandoSesion(true)
    setErrorSalida('')

    try {
      await cerrarSesion()
      logout()
      navigate('/login', { replace: true })
    } catch {
      setErrorSalida('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    } finally {
      setCerrandoSesion(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Encabezado principal */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-lg font-bold text-slate-900">
            AyM Shafety
          </span>

          <button
            onClick={handleLogout}
            disabled={cerrandoSesion}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </header>

      {/* Todo el contenido comparte el mismo ancho */}
      <div className="mx-auto max-w-5xl px-5 py-12">

        {/* Bienvenida al trabajador */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Inicio
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            ¡Hola, {user?.nombre}!
          </h1>

          <p className="mt-3 text-slate-600">
            Has iniciado sesión con{' '}
            <span className="font-medium">{user?.correo}</span>.
          </p>

          {/* Mostramos los roles asignados a la cuenta */}
          <div className="mt-4 flex flex-wrap gap-2">
            {user?.roles.map((rol) => (
              <span
                key={rol}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
              >
                {rol}
              </span>
            ))}
          </div>

          {errorSalida && (
            <p role="alert" className="mt-4 text-sm text-rose-600">
              {errorSalida}
            </p>
          )}
        </section>

        {/* Información de la sesión */}
        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <span className="text-xl">✓</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Tu sesión está activa
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Has ingresado correctamente al sistema AyM Shafety.
                Tu acceso está protegido mediante una sesión autenticada.
              </p>
            </div>
          </div>
        </section>

        {/* HU01: acceso del Encargado de Compras a sus borradores. */}
        {esCompras && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Compras
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Prepara tus solicitudes de compra en estado borrador.
            </p>

            <Link
              to="/compras"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Solicitudes de compra
            </Link>
          </section>
        )}

      </div>
    </main>
  )
}