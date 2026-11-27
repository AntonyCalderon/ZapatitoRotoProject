import type { ReactNode } from 'react'
import logo from '../assets/login/cat-logo.png'
import './LoginLayout.css'

type Props = { title: string; subtitle: string; children: ReactNode }

export default function LoginLayout({ title, subtitle, children }: Props) {
  return (
    <main className="cat-login">
      <section className="cat-login-card" aria-labelledby="cat-login-title">
        <img className="cat-login-logo" src={logo} alt="CAT Caterpillar" />
        <h1 id="cat-login-title">{title === 'Bienvenido de nuevo' ? <>Bienvenido <span>de nuevo</span></> : title}</h1>
        <p className="cat-login-subtitle">{subtitle}</p>
        {children}
        <footer className="cat-login-footer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <ellipse cx="12" cy="16.3" rx="5.2" ry="4.4" />
            <ellipse cx="4.8" cy="11.3" rx="2.1" ry="2.8" />
            <ellipse cx="9" cy="6.4" rx="2.1" ry="2.9" />
            <ellipse cx="15" cy="6.4" rx="2.1" ry="2.9" />
            <ellipse cx="19.2" cy="11.3" rx="2.1" ry="2.8" />
          </svg>
          Pasos más fuertes,<br /><span>en cada camino</span>
        </footer>
      </section>
    </main>
  )
}
