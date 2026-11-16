import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SubmitButton from '../components/SubmitButton'
import { registerUser } from '../services/authService'
import type { User } from '../services/authService'
import { useAuthStore } from '../store/authStore'

const schema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
    email: z.email('Ingresa un correo válido.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
type RegisterValues = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const registerMutation = useMutation<User, Error, RegisterValues>({
    mutationFn: async (values) =>
      registerUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      }),
    onSuccess: (user) => {
      setUser(user)
      navigate('/inicio')
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(schema) })

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Regístrate para comenzar">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => registerMutation.mutate(values))}
        noValidate
      >
        <FormField
          label="Nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          {...register('name')}
          error={errors.name?.message}
        />
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
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          {...register('password')}
          error={errors.password?.message}
        />
        <FormField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        {registerMutation.isError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {registerMutation.error.message}
          </p>
        )}
        <SubmitButton pending={registerMutation.isPending} idle="Crear cuenta" busy="Creando cuenta..." />
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link className="font-bold text-neutral-900 hover:text-amber-600" to="/login">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}