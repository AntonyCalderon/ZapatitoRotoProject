import type { ReactNode } from 'react'

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-10"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">A</div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</section></main>
}
