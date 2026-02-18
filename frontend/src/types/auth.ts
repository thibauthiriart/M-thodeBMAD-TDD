export type UserRole = 'acheteur' | 'vendeur' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface RegisterForm {
  email: string
  password: string
  password_confirmation: string
  role: UserRole | ''
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginForm {
  email: string
  password: string
}

export interface ValidationErrors {
  [field: string]: string[]
}

export interface UpdateProfileForm {
  name: string
}

export interface ProfileResponse {
  id: number
  name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}
