export interface User { name: string; email: string; password: string }
const USERS_KEY = 'registro-login-users'

function getUsers(): User[] {
  try {
    const stored = localStorage.getItem(USERS_KEY)
    return stored ? JSON.parse(stored) as User[] : []
  } catch { return [] }
}

export function registerUser(user: User): User {
  const users = getUsers()
  if (users.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) throw new Error('Ya existe una cuenta con este correo.')
  const registered = { ...user, email: user.email.trim().toLowerCase() }
  users.push(registered)
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return registered
}

export function loginUser(email: string, password: string): User {
  const user = getUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password)
  if (!user) throw new Error('Correo o contraseña incorrectos.')
  return user
}
