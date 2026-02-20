import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { CartItem } from '@/types/cart'
import { cartService } from '@/services/cartService'

/**
 * Cart store — Story 4.1: Add to Cart.
 *
 * Calls POST /api/cart/items via cartService.
 * Tracks cart items and total count for UI binding.
 * NFR18: cart persisted in DB (not in session).
 */
export const useCartStore = defineStore('cart', () => {
  // ── State ──────────────────────────────────────────────────────
  const items = ref<CartItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastAddedProductName = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────
  const totalItems = computed<number>(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0),
  )

  const totalPrice = computed<number>(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  )

  // ── Actions ────────────────────────────────────────────────────

  /**
   * Add an item to the cart via API.
   * AC#1: product added with quantity 1
   * AC#2: if product already in cart, quantity incremented by 1
   *
   * Calls POST /api/cart/items and updates local state from the response.
   * Returns true on success, false on failure.
   */
  async function addItem(
    productId: number,
    productName: string,
    price: number,
    photoUrl: string | null,
  ): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await cartService.addToCart({
        product_id: productId,
        quantity: 1,
      })

      // Update local state from the API response
      syncFromApiResponse(response.data.items, price, photoUrl)
      lastAddedProductName.value = productName

      return true
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Erreur lors de l\'ajout au panier.'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch the current cart from API and sync local state.
   * Called on login/hydration to restore the badge count.
   */
  async function fetchCart(): Promise<void> {
    try {
      const response = await cartService.getCart()
      if (response && response.data && response.data.items) {
        syncFromApiResponse(response.data.items)
      } else {
        items.value = []
      }
    } catch {
      // Silently fail — cart fetch is not critical
      items.value = []
    }
  }

  /**
   * Sync local items array from the API response items.
   * The API returns items with product info embedded.
   */
  function syncFromApiResponse(
    apiItems: Array<{
      id: number
      product_id: number
      quantity: number
      product?: {
        id: number
        name: string
        price: number
        stock_quantity: number
        photo_url?: string | null
      } | null
    }>,
    defaultPrice?: number,
    defaultPhotoUrl?: string | null,
  ): void {
    items.value = apiItems.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.name ?? '',
      product_photo_url: item.product?.photo_url ?? defaultPhotoUrl ?? null,
      price: item.product?.price ?? defaultPrice ?? 0,
      quantity: item.quantity,
    }))
  }

  function clearLastAdded(): void {
    lastAddedProductName.value = null
  }

  function clearError(): void {
    error.value = null
  }

  /**
   * Reset cart state (e.g. on logout).
   */
  function reset(): void {
    items.value = []
    isLoading.value = false
    error.value = null
    lastAddedProductName.value = null
  }

  return {
    // state
    items,
    isLoading,
    error,
    lastAddedProductName,
    // computed
    totalItems,
    totalPrice,
    // actions
    addItem,
    fetchCart,
    clearLastAdded,
    clearError,
    reset,
  }
})
