import type { AuthResponse, LoginForm, RegisterForm, User, ValidationErrors } from '@/types/auth'
import { API_BASE } from '@/config/api'

export interface ApiValidationError {
  message: string
  errors: ValidationErrors
}

/**
 * Error thrown when the server explicitly rejects authentication
 * (e.g. 401/403 response). Distinguished from network/abort errors.
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Register a new user.
 * Returns the auth response on success, or throws with validation errors.
 */
export async function register(form: RegisterForm): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: form.email,
      password: form.password,
      password_confirmation: form.password_confirmation,
      role: form.role,
    }),
  })

  if (!response.ok) {
    if (response.status === 422) {
      const errorData: ApiValidationError = await response.json()
      const error = new Error(errorData.message) as Error & {
        validationErrors: ValidationErrors
      }
      error.validationErrors = errorData.errors
      throw error
    }
    throw new Error('Une erreur est survenue lors de l\'inscription.')
  }

  const json = await response.json()
  return json.data as AuthResponse
}

/**
 * Login with email and password.
 * Returns the auth response on success, or throws with a generic error message.
 */
export async function login(form: LoginForm): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: form.email,
      password: form.password,
    }),
  })

  if (!response.ok) {
    if (response.status === 422) {
      const errorData: ApiValidationError = await response.json()
      throw new Error(errorData.message)
    }
    if (response.status === 401) {
      const errorData = await response.json() as { message: string }
      throw new Error(errorData.message)
    }
    throw new Error('Identifiants invalides.')
  }

  const json = await response.json()
  return json.data as AuthResponse
}

/**
 * Logout the current user.
 * Sends a POST to revoke the current token on the server.
 */
export async function logout(authToken: string): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })
}

/**
 * Fetch the currently authenticated user's profile.
 */
export async function fetchCurrentUser(authToken: string): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new AuthenticationError('Non authentifié.')
  }

  const json = await response.json()
  return json.data as User
}

export const authService = {
  register,
  login,
  logout,
  fetchCurrentUser,
}
