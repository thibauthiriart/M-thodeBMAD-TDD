import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { User, LoginForm, RegisterForm, ValidationErrors } from '@/types/auth'
import { authService, AuthenticationError } from '@/services/authService'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isLoading = ref(false)
  const isHydrating = ref(!!localStorage.getItem('token'))
  const serverErrors = ref<ValidationErrors>({})
  const generalError = ref('')

  const isAuthenticated = ref(!!token.value)

  function setAuth(userData: User, authToken: string): void {
    user.value = userData
    token.value = authToken
    isAuthenticated.value = true
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function clearAuth(): void {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function register(form: RegisterForm): Promise<boolean> {
    isLoading.value = true
    serverErrors.value = {}
    generalError.value = ''

    try {
      const response = await authService.register(form)
      setAuth(response.user, response.token)
      return true
    } catch (error: unknown) {
      const err = error as Error & { validationErrors?: ValidationErrors }
      if (err.validationErrors) {
        serverErrors.value = err.validationErrors
      } else {
        generalError.value = err.message || 'Une erreur est survenue.'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function login(form: LoginForm): Promise<boolean> {
    isLoading.value = true
    serverErrors.value = {}
    generalError.value = ''

    try {
      const response = await authService.login(form)
      setAuth(response.user, response.token)
      return true
    } catch (error: unknown) {
      const err = error as Error
      generalError.value = err.message || 'Identifiants invalides.'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    const currentToken = token.value

    if (currentToken) {
      try {
        await authService.logout(currentToken)
      } catch {
        // Token revocation failed silently — user is already logged out client-side
      }
    }

    clearAuth()
  }

  /**
   * Hydrate user data from the server using the stored token.
   * Called on app init when a token exists in localStorage.
   */
  async function hydrate(): Promise<void> {
    if (!token.value) return

    isHydrating.value = true
    try {
      const userData = await authService.fetchCurrentUser(token.value)
      user.value = userData
      isAuthenticated.value = true
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error: unknown) {
      // Only clear auth if the server explicitly rejected the token (401/403).
      // Network errors or aborted requests (e.g. page navigation) should NOT
      // clear the token from localStorage — it may still be valid.
      if (error instanceof AuthenticationError) {
        clearAuth()
      }
    } finally {
      isHydrating.value = false
    }
  }

  return {
    user,
    token,
    isLoading,
    isHydrating,
    serverErrors,
    generalError,
    isAuthenticated,
    register,
    login,
    logout,
    hydrate,
    setAuth,
    clearAuth,
  }
})
