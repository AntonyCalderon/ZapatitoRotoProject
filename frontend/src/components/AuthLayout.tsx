import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

type Props = { title: string; subtitle: string; children: ReactNode }
type Panel = { image: string; lead: string; highlight: string; features: { icon: ReactNode; text: string }[] }

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
}

const ShieldIcon = () => (
  <svg {...svgProps} className="h-8 w-8 text-cat">
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </svg>
)
const TruckIcon = () => (
  <svg {...svgProps} className="h-8 w-8 text-cat">
    <path d="M3 6h11v10H3z" />
    <path d="M14 9h4l3 3v4h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
)
const StarIcon = () => (
  <svg {...svgProps} className="h-8 w-8 text-cat">
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
  </svg>
)
const ShoeIcon = () => (
  <svg {...svgProps} className="h-8 w-8">
    <path d="M2 17c0-1.4.9-2.3 2.2-2.5l3-.5L9 9.5l2.6 1.6c1.2.8 2.3 1.3 3.9 1.9 2 .7 4.5 1 6.5 2.1V18H2z" />
  </svg>
)

const panels: Record<'login' | 'registro', Panel> = {
  login: {
    image: '/hero-login.jpg',
    lead: 'Pasos más fuertes,',
    highlight: 'en cada camino',
    features: [],
  },
  registro: {
    image: '/hero-registro.jpg',
    lead: 'Únete a nuestra',
    highlight: 'comunidad',
    features: [
      { icon: <ShieldIcon />, text: 'Compra segura' },
      { icon: <TruckIcon />, text: 'Envíos a todo el Perú' },
      { icon: <StarIcon />, text: 'Ofertas exclusivas' },
    ],
  },
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  const { pathname } = useLocation()
  const panel = pathname === '/registro' ? panels.registro : panels.login

  // Las dos últimas palabras del título van en amarillo
  const words = title.split(' ')
  const head = words.slice(0, -2).join(' ')
  const tail = words.slice(-2).join(' ')

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-200 px-4 py-8">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/20 md:grid-cols-2">
        {/* Panel izquierdo (solo en pantallas medianas y grandes) */}
        <aside
          className="relative hidden min-h-[580px] flex-col justify-between overflow-hidden bg-neutral-900 p-10 text-white md:flex"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0.88), rgba(10,10,10,0.55)), url(${panel.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="pointer-events-none absolute -left-20 top-8 h-8 w-80 -rotate-45 bg-cat" />
          <div className="pointer-events-none absolute -left-20 top-20 h-3 w-80 -rotate-45 bg-black/70" />

          <div className="relative z-10 pt-12">
            <p className="font-display text-7xl font-extrabold leading-none tracking-tight">CAT</p>
            <p className="font-display text-2xl font-bold tracking-wide">CATERPILLAR</p>
          </div>

          <div className="relative z-10">
            <h2 className="font-display text-4xl font-bold leading-tight">
              {panel.lead} <span className="text-cat">{panel.highlight}</span>
            </h2>
            <div className="mt-3 h-1 w-28 -skew-x-12 rounded bg-cat" />
            {panel.features.length > 0 && (
              <ul className="mt-6 space-y-4">
                {panel.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3 text-sm font-medium">
                    {feature.icon}
                    {feature.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Panel derecho: formulario */}
        <div className="relative flex flex-col justify-center overflow-hidden p-8 sm:p-10">
          <p className="mb-6 text-center font-display text-3xl font-extrabold tracking-wide text-neutral-900 md:hidden">
            CATERPILLAR
          </p>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cat text-black shadow-lg shadow-amber-300/50">
              <ShoeIcon />
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-neutral-900">
              {head} <span className="text-amber-500">{tail}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
          <div className="pointer-events-none absolute -bottom-5 -right-10 h-8 w-56 -rotate-12 bg-cat" />
          <div className="pointer-events-none absolute -bottom-9 -right-10 h-6 w-56 -rotate-12 bg-neutral-900" />
        </div>
      </section>
    </main>
  )
}