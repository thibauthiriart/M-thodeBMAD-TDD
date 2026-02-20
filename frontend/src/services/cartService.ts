import type { CartResponse, AddToCartPayload } from '@/types/cart'
import { API_BASE } from '@/config/api'

/**
 * Get the current auth token from localStorage.
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Add a product to the authenticated buyer's cart.
 * POST /api/cart/items
 *
 * Story 4.1:
 * - AC1: Adds product with quantity 1
 * - AC2: Increments quantity if product already in cart
 * - Returns the full cart resource
 *
 * @throws Error on network failure or server error
 */
export async function addToCart(payload: AddToCartPayload): Promise<CartResponse> {
  const response = await fetch(`${API_BASE}/cart/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Non authentifié. Veuillez vous connecter.')
    }
    if (response.status === 422) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Données invalides.')
    }
    throw new Error('Impossible d\'ajouter le produit au panier.')
  }

  const json = await response.json()
  return json as CartResponse
}

/**
 * Get the authenticated buyer's cart.
 * GET /api/cart
 *
 * Returns null if no cart exists yet.
 *
 * @throws Error on network failure
 */
export async function getCart(): Promise<CartResponse | null> {
  const response = await fetch(`${API_BASE}/cart`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    if (response.status === 401) {
      return null
    }
    throw new Error('Impossible de charger le panier.')
  }

  const json = await response.json()
  return json as CartResponse
}

export const cartService = {
  addToCart,
  getCart,
}
