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
   * Internal promise to prevent concurrent hydration calls.
   * When the router guard and App.vue both call hydrate(),
   * only one API request is made.
   */
  let hydratePromise: Promise<void> | null = null

  /**
   * Hydrate user data from the server using the stored token.
   * Called on app init when a token exists in localStorage.
   * Safe to call multiple times — concurrent calls share the same promise.
   */
  async function hydrate(): Promise<void> {
    // Read token from localStorage directly in case the store
    // was created before the token was set (e.g. by e2e loginAs helper)
    const currentToken = token.value || localStorage.getItem('token')
    if (!currentToken) return

    // If user is already hydrated, skip
    if (user.value) return

    // If hydration is already in progress, wait for it
    if (hydratePromise) return hydratePromise

    token.value = currentToken
    isHydrating.value = true

    hydratePromise = (async () => {
      try {
        const userData = await authService.fetchCurrentUser(currentToken)
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
        hydratePromise = null
      }
    })()

    return hydratePromise
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
