/**
 * Cart types for Story 4.1: Add to Cart.
 *
 * Matches the expected backend CartResource / CartItemResource responses.
 * NFR18: cart persisted in DB (not session).
 */

/** A single item within the cart */
export interface CartItem {
  id: number
  product_id: number
  product_name: string
  product_photo_url: string | null
  price: number
  quantity: number
}

/** Full cart resource returned by the API */
export interface CartResource {
  id: number
  items: CartItem[]
  total_items: number
  total_price: number
}

/** Payload sent when adding an item to the cart */
export interface AddToCartPayload {
  product_id: number
  quantity?: number
}

/** API response wrapper for cart operations */
export interface CartResponse {
  data: CartResource
}
