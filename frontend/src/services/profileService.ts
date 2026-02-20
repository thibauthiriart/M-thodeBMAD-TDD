import type { User, UpdateProfileForm, ValidationErrors } from '@/types/auth'
import { API_BASE } from '@/config/api'

export interface ApiValidationError {
  message: string
  errors: ValidationErrors
}

/**
 * Fetch the authenticated user's profile.
 * GET /api/profile
 */
export async function fetchProfile(authToken: string): Promise<User> {
  const response = await fetch(`${API_BASE}/profile`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Impossible de charger le profil.')
  }

  const json = await response.json()
  return json.data as User
}

/**
 * Update the authenticated user's profile.
 * PUT /api/profile
 *
 * Returns the updated user on success.
 * Throws with validationErrors on 422.
 */
export async function updateProfile(
  authToken: string,
  form: UpdateProfileForm
): Promise<User> {
  const response = await fetch(`${API_BASE}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name: form.name }),
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
    throw new Error('Une erreur est survenue lors de la mise à jour du profil.')
  }

  const json = await response.json()
  return json.data as User
}

export const profileService = {
  fetchProfile,
  updateProfile,
}
