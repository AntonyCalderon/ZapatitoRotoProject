import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { loginUser } from '../services/authService'
import { useAuthStore } from '../store/authStore'

const schema = z.object({ email: z.email('Ingresa un correo válido.'), password: z.string().min(1, 'Ingresa tu contraseña.') })
type LoginValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  
  const { register, handleSubmit, formState: { errors} } = useForm<LoginValues>({ resolver: zodResolver(schema) })
  const mutation = useMutation({
  mutationFn: async (values: LoginValues) => loginUser(values.email, values.password),
  onSuccess: (user) => {
    setUser(user)
    navigate('/inicio')
  },
})
const error = mutation.isError
  ? mutation.error instanceof Error ? mutation.error.message : 'No se pudo iniciar sesión.'
  : ''
const onSubmit = (values: LoginValues) => mutation.mutate(values)
  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Ingresa con tu correo y contraseña">
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" {...register('email')} error={errors.email?.message} />
        <FormField label="Contraseña" type="password" autoComplete="current-password" placeholder="Tu contraseña" {...register('password')} error={errors.password?.message} />
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={mutation.isPending} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700">Iniciar sesión</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">¿Aún no tienes cuenta? <Link className="font-semibold text-indigo-600 hover:text-indigo-700" to="/registro">Regístrate</Link></p>
    </AuthLayout>
  )
}
