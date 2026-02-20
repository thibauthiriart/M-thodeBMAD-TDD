import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SellerProduct, ProductResource, ProductFormErrors, ProductSpec } from '@/types/product'
import { sellerProductService, ProductValidationException } from '@/services/sellerProductService'
import { useAuthStore } from '@/stores/auth'

/**
 * Store for seller products.
 * Fetches products from GET /api/seller/products and manages loading/error states.
 * Creates products via POST /api/seller/products.
 */
export const useSellerProductStore = defineStore('sellerProduct', () => {
  // --- State ---
  const products = ref<SellerProduct[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // --- Single product state (edit mode) ---
  const currentProduct = ref<ProductResource | null>(null)
  const isFetchingProduct = ref(false)
  const fetchProductError = ref<string | null>(null)

  // --- Update product state ---
  const isUpdating = ref(false)
  const updateError = ref<string | null>(null)
  const updateServerErrors = ref<ProductFormErrors>({})

  // --- Delete product state ---
  const isDeleting = ref(false)
  const deleteError = ref<string | null>(null)

  // --- Toggle status state ---
  const isToggling = ref(false)
  const toggleError = ref<string | null>(null)

  // --- Create product state ---
  const isCreating = ref(false)
  const createError = ref<string | null>(null)
  const createServerErrors = ref<ProductFormErrors>({})

  // --- Actions ---
  async function fetchProducts(): Promise<void> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      error.value = 'Non authentifié.'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      products.value = await sellerProductService.fetchSellerProducts(token)
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Une erreur est survenue.'
      products.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new product via the API.
   * Returns the created ProductResource on success, or null on failure.
   * Sets createServerErrors for 422 validation errors.
   */
  async function createProduct(data: {
    name: string
    description: string
    category: string
    price: string
    stock_quantity: string
    specs: ProductSpec[]
    photo: File
  }): Promise<ProductResource | null> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      createError.value = 'Non authentifié.'
      return null
    }

    isCreating.value = true
    createError.value = null
    createServerErrors.value = {}

    try {
      const result = await sellerProductService.createProduct(token, data)
      return result
    } catch (err: unknown) {
      if (err instanceof ProductValidationException) {
        createServerErrors.value = err.fieldErrors
        createError.value = err.message
      } else {
        const e = err as Error
        createError.value = e.message || 'Une erreur est survenue.'
      }
      return null
    } finally {
      isCreating.value = false
    }
  }

  /**
   * Fetch a single product by ID for editing.
   * GET /api/seller/products/{id}
   */
  async function fetchProduct(productId: number): Promise<ProductResource | null> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      fetchProductError.value = 'Non authentifié.'
      return null
    }

    isFetchingProduct.value = true
    fetchProductError.value = null
    currentProduct.value = null

    try {
      const result = await sellerProductService.fetchSellerProduct(token, productId)
      currentProduct.value = result
      return result
    } catch (err: unknown) {
      const e = err as Error
      fetchProductError.value = e.message || 'Impossible de charger le produit.'
      return null
    } finally {
      isFetchingProduct.value = false
    }
  }

  /**
   * Update an existing product via the API.
   * PUT /api/seller/products/{id}
   * Returns the updated ProductResource on success, or null on failure.
   * Sets updateServerErrors for 422 validation errors.
   */
  async function updateProduct(
    productId: number,
    data: {
      name: string
      description: string
      category: string
      price: string
      stock_quantity: string
      specs: ProductSpec[]
      photo?: File | null
    }
  ): Promise<ProductResource | null> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      updateError.value = 'Non authentifié.'
      return null
    }

    isUpdating.value = true
    updateError.value = null
    updateServerErrors.value = {}

    try {
      const result = await sellerProductService.updateProduct(token, productId, data)
      currentProduct.value = result
      return result
    } catch (err: unknown) {
      if (err instanceof ProductValidationException) {
        updateServerErrors.value = err.fieldErrors
        updateError.value = err.message
      } else {
        const e = err as Error
        updateError.value = e.message || 'Une erreur est survenue.'
      }
      return null
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * Toggle the is_active status of a product.
   * PATCH /api/seller/products/{id}/toggle-status
   * Waits for API response before updating the UI to ensure DB consistency.
   */
  async function toggleProductStatus(productId: number): Promise<boolean> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      toggleError.value = 'Non authentifié.'
      return false
    }

    // Find the product in the local list
    const product = products.value.find((p) => p.id === productId)
    if (!product) {
      toggleError.value = 'Produit introuvable.'
      return false
    }

    isToggling.value = true
    toggleError.value = null

    try {
      const updatedProduct = await sellerProductService.toggleProductStatus(token, productId)
      // Update the product in the list with the API response
      product.is_active = updatedProduct.is_active
      return true
    } catch (err: unknown) {
      const e = err as Error
      toggleError.value = e.message || 'Une erreur est survenue.'
      return false
    } finally {
      isToggling.value = false
    }
  }

  /**
   * Delete a product permanently via the API.
   * DELETE /api/seller/products/{id}
   * Removes the product from the local list on success.
   * Returns true on success, false on failure.
   */
  async function deleteProduct(productId: number): Promise<boolean> {
    const authStore = useAuthStore()
    const token = authStore.token || localStorage.getItem('token')

    if (!token) {
      deleteError.value = 'Non authentifié.'
      return false
    }

    isDeleting.value = true
    deleteError.value = null

    try {
      await sellerProductService.deleteProduct(token, productId)
      // Remove the product from the local list
      products.value = products.value.filter((p) => p.id !== productId)
      return true
    } catch (err: unknown) {
      const e = err as Error
      deleteError.value = e.message || 'Une erreur est survenue lors de la suppression.'
      return false
    } finally {
      isDeleting.value = false
    }
  }

  function clearCreateErrors(): void {
    createError.value = null
    createServerErrors.value = {}
  }

  function clearUpdateErrors(): void {
    updateError.value = null
    updateServerErrors.value = {}
  }

  return {
    products,
    isLoading,
    error,
    fetchProducts,
    // Delete
    isDeleting,
    deleteError,
    deleteProduct,
    // Toggle status
    isToggling,
    toggleError,
    toggleProductStatus,
    // Create
    isCreating,
    createError,
    createServerErrors,
    createProduct,
    clearCreateErrors,
    // Edit mode
    currentProduct,
    isFetchingProduct,
    fetchProductError,
    fetchProduct,
    // Update
    isUpdating,
    updateError,
    updateServerErrors,
    updateProduct,
    clearUpdateErrors,
  }
})
