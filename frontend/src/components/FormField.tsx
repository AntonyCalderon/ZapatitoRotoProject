import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  className: 'h-4 w-4 shrink-0',
}

const MailIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
)
const LockIcon = () => (
  <svg {...svgProps}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
const UserIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
  </svg>
)
const EyeIcon = ({ off }: { off: boolean }) => (
  <svg {...svgProps} className="h-5 w-5">
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

export default function FormField({ label, error, id, type, ...inputProps }: Props) {
  const [show, setShow] = useState(false)
  const inputId = id ?? inputProps.name
  const isPassword = type === 'password'

  let icon = null
  if (type === 'email') icon = <MailIcon />
  else if (isPassword) icon = <LockIcon />
  else if (inputProps.name === 'name') icon = <UserIcon />

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {icon}
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && show ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cat focus:ring-4 focus:ring-cat/30 aria-[invalid=true]:border-rose-400 ${isPassword ? 'pr-12' : ''}`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-neutral-900"
          >
            <EyeIcon off={!show} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}