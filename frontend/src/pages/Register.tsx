import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { registerUser } from '../services/authService'
import { useAuthStore } from '../store/authStore'

const schema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  email: z.email('Ingresa un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Las contraseñas no coinciden.', path: ['confirmPassword'],
})
type RegisterValues = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [serviceError, setServiceError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(schema) })
  const onSubmit = (values: RegisterValues) => {
    setServiceError('')
    try {
      const user = registerUser({ name: values.name.trim(), email: values.email.trim(), password: values.password })
      setUser(user)
      navigate('/inicio')
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.')
    }
  }
  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Regístrate para comenzar">
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Nombre" autoComplete="name" placeholder="Tu nombre" {...register('name')} error={errors.name?.message} />
        <FormField label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" {...register('email')} error={errors.email?.message} />
        <FormField label="Contraseña" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...register('password')} error={errors.password?.message} />
        <FormField label="Confirmar contraseña" type="password" autoComplete="new-password" placeholder="Repite tu contraseña" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
        {serviceError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{serviceError}</p>}
        <button disabled={isSubmitting} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">¿Ya tienes cuenta? <Link className="font-semibold text-indigo-600 hover:text-indigo-700" to="/login">Inicia sesión</Link></p>
    </AuthLayout>
  )
}
