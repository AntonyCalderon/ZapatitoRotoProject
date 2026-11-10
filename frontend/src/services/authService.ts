export type Role = 'admin' | 'vendedor' | 'cliente'
export interface User { name: string; email: string; password: string; role: Role }
export type NewUser = Omit<User, 'role'>

const USERS_KEY = 'registro-login-users'

// Cuentas de prueba (mock). No se guardan en localStorage y nadie puede registrarse con estos correos.
const ADMIN: User = {
  name: 'Administrador',
  email: 'admin@zapatito.com',
  password: 'Admin12345',
  role: 'admin',
}
const VENDEDOR: User = {
  name: 'Vendedor',
  email: 'vendedor@zapatito.com',
  password: 'Vendedor123',
  role: 'vendedor',
}
const RESERVED_EMAILS = [ADMIN.email, VENDEDOR.email]

function getUsers(): User[] {
  try {
    const stored = localStorage.getItem(USERS_KEY)
    const users = stored ? (JSON.parse(stored) as User[]) : []
    // Usuarios guardados antes de los roles quedan como cliente
    return users.map((item) => ({ ...item, role: item.role ?? 'cliente' }))
  } catch { return [] }
}

export function registerUser(user: NewUser): User {
  const users = getUsers()
  const email = user.email.trim().toLowerCase()
  if (RESERVED_EMAILS.includes(email) || users.some((item) => item.email.toLowerCase() === email)) {
    throw new Error('Ya existe una cuenta con este correo.')
  }
  // Todo registro nuevo nace como cliente
  const registered: User = { ...user, email, role: 'cliente' }
  users.push(registered)
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return registered
}

export function loginUser(email: string, password: string): User {
  const normalized = email.trim().toLowerCase()
  const user = [ADMIN, VENDEDOR, ...getUsers()].find(
    (item) => item.email.toLowerCase() === normalized && item.password === password,
  )
  if (!user) throw new Error('Correo o contraseña incorrectos.')
  return user
}