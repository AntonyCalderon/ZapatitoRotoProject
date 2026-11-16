import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { cambiarPassword } from '../services/authApi'
import { useAuthStore } from '../store/authStore'

const schema = z.object({
  actual: z.string().min(1, 'Ingresa tu contraseña actual.'),
  nueva: z.string().min(12, 'Usa al menos 12 caracteres.').max(128, 'Usa como máximo 128 caracteres.').refine(value => Boolean(value.trim()), 'Ingresa una contraseña válida.'),
  confirmacion: z.string().min(1, 'Confirma la nueva contraseña.')
}).refine(values => values.nueva === values.confirmacion, { path: ['confirmacion'], message: 'Las contraseñas no coinciden.' })
  .refine(values => values.actual !== values.nueva, { path: ['nueva'], message: 'La nueva contraseña debe ser diferente.' })
type Valores = z.infer<typeof schema>

export default function CambiarPasswordPage() {
  const setUser = useAuthStore(state => state.setUser)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Valores>({ resolver: zodResolver(schema) })
  const guardar = async ({ actual, nueva }: Valores) => {
    setError('')
    try {
      const respuesta = await cambiarPassword(actual, nueva)
      setUser(respuesta.usuario)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.')
    }
  }
  return (
    <AuthLayout title="Cambiar contraseña" subtitle="Establece una contraseña personal para continuar">
      <form className="space-y-5" onSubmit={handleSubmit(guardar)} noValidate>
        <FormField label="Contraseña temporal o actual" type="password" autoComplete="current-password" {...register('actual')} error={errors.actual?.message} />
        <FormField label="Nueva contraseña" type="password" autoComplete="new-password" {...register('nueva')} error={errors.nueva?.message} />
        <FormField label="Confirmar nueva contraseña" type="password" autoComplete="new-password" {...register('confirmacion')} error={errors.confirmacion?.message} />
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{isSubmitting ? 'Guardando...' : 'Guardar cambio'}</button>
      </form>
    </AuthLayout>
  )
}
