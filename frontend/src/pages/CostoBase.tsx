import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

export default function CostoBase() {
  return (
    <AuthLayout title="Costo base" subtitle="Solo visible para administradores">
      <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
        Aquí se registrará el costo base de Lima por modelo y talla.
      </p>
      <Link className="mt-6 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700" to="/inicio">
        Volver al inicio
      </Link>
    </AuthLayout>
  )
}