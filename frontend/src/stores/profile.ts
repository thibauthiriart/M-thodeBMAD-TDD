import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User, UpdateProfileForm, ValidationErrors } from '@/types/auth'
import { profileService } from '@/services/profileService'

export const useProfileStore = defineStore('profile', () => {
  // --- State ---
  const profile = ref<User | null>(null)
  const originalName = ref<string>('')
  const isLoading = ref(false)
  const isSaving = ref(false)
  const generalError = ref('')
  const successMessage = ref('')

  // Timer for auto-hiding success message
  let successTimerId: ReturnType<typeof setTimeout> | null = null

  // --- Form state ---
  const formName = ref('')

  // --- Computed ---
  const roleLabel = computed<string>(() => {
    if (!profile.value) return ''
    switch (profile.value.role) {
      case 'acheteur':
        return 'Acheteur'
      case 'vendeur':
        return 'Vendeur'
      default:
        return profile.value.role
    }
  })

  // --- Actions ---

  /**
   * Fetch the current user's profile from the API.
   */
  async function fetchProfile(): Promise<void> {
    const token = localStorage.getItem('token')
    if (!token) return

    isLoading.value = true
    generalError.value = ''
    successMessage.value = ''

    try {
      const user = await profileService.fetchProfile(token)
      profile.value = user
      originalName.value = user.name
      formName.value = user.name
    } catch (error: unknown) {
      const err = error as Error
      generalError.value = err.message || 'Impossible de charger le profil.'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update the user's profile (name only).
   * Returns true on success, false on failure.
   */
  async function updateProfile(): Promise<boolean> {
    const token = localStorage.getItem('token')
    if (!token) return false

    // Trim whitespace before validation
    formName.value = formName.value.trim()

    // Client-side validation: empty or whitespace-only name
    if (!formName.value) {
      generalError.value = 'Le nom est obligatoire.'
      successMessage.value = ''
      return false
    }

    isSaving.value = true
    generalError.value = ''
    successMessage.value = ''

    try {
      const form: UpdateProfileForm = { name: formName.value }
      const updatedUser = await profileService.updateProfile(token, form)

      profile.value = updatedUser
      originalName.value = updatedUser.name
      formName.value = updatedUser.name
      successMessage.value = 'Profil mis à jour avec succès.'

      // Auto-hide success message after 4 seconds
      if (successTimerId) {
        clearTimeout(successTimerId)
      }
      successTimerId = setTimeout(() => {
        successMessage.value = ''
        successTimerId = null
      }, 4000)

      return true
    } catch (error: unknown) {
      const err = error as Error & { validationErrors?: ValidationErrors }
      if (err.validationErrors) {
        // Extract first validation error message
        const firstField = Object.keys(err.validationErrors)[0]
        if (firstField && err.validationErrors[firstField].length > 0) {
          generalError.value = err.validationErrors[firstField][0]
        } else {
          generalError.value = err.message || 'Erreur de validation.'
        }
      } else {
        generalError.value = err.message || 'Une erreur est survenue.'
      }
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Reset the form to the original values from the server.
   */
  function resetForm(): void {
    formName.value = originalName.value
    generalError.value = ''
    successMessage.value = ''
  }

  return {
    profile,
    originalName,
    isLoading,
    isSaving,
    generalError,
    successMessage,
    formName,
    roleLabel,
    fetchProfile,
    updateProfile,
    resetForm,
  }
})
