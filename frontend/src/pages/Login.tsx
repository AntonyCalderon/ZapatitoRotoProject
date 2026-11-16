
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { iniciarSesion } from '../services/authApi'
import { useAuthStore } from '../store/authStore'

// Validamos los datos antes de enviarlos al backend.
const schema = z.object({
  email: z.email('Ingresa un correo válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.')
})

type LoginValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginValues>({
    resolver: zodResolver(schema)
  })

  // Enviamos las credenciales a nuestra API de Express.
  const mutation = useMutation({
    mutationFn: (values: LoginValues) =>
      iniciarSesion(values.email, values.password),

    onSuccess: (respuesta) => {
      // Conservamos los datos del usuario en el estado de React.
      // La sesión real permanece en el backend.
      setUser(respuesta.usuario)

      navigate('/inicio', { replace: true })
    }
  })

  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : 'No se pudo iniciar sesión.'
    : ''

  const onSubmit = (values: LoginValues) => {
    mutation.mutate(values)
  }

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Ingresa con tu correo y contraseña"
    >
      <form
        className="space-y-5"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
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
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  )
}

