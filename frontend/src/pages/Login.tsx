import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SubmitButton from '../components/SubmitButton'
import { loginUser } from '../services/authService'
import { useAuthStore } from '../store/authStore'

const schema = z.object({
  email: z.email('Ingresa un correo válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})
type LoginValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: async (values: LoginValues) => loginUser(values.email, values.password),
    onSuccess: (user) => {
      setUser(user)
      navigate('/inicio')
    },
  })

  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : 'No se pudo iniciar sesión.'
    : ''

  const onSubmit = (values: LoginValues) => mutation.mutate(values)

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Inicia sesión en tu cuenta">
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          {...register('email')}
          error={errors.email?.message}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          {...register('password')}
          error={errors.password?.message}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <SubmitButton pending={mutation.isPending} idle="Iniciar sesión" busy="Ingresando..." />
      </form>
      <div className="my-6 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />o<span className="h-px flex-1 bg-slate-200" />
      </div>
      <p className="text-center text-sm text-slate-600">
        ¿No tienes cuenta?{' '}
        <Link className="font-bold text-neutral-900 hover:text-amber-600" to="/registro">
          Regístrate
        </Link>
      </p>
    </AuthLayout>
  )
}