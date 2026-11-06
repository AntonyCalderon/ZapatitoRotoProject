import type { InputHTMLAttributes } from 'react'
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
export default function FormField({ label, error, id, ...inputProps }: Props) {
  const inputId = id ?? inputProps.name
  return <div><label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label><input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 aria-[invalid=true]:border-rose-400" {...inputProps} />{error && <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-rose-600">{error}</p>}</div>
}
