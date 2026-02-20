import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CatalogProduct, CategoryInfo, ProductDetailResource } from '@/types/product'
import { catalogService } from '@/services/catalogService'
import type { ProductFiltersParams } from '@/services/catalogService'

/**
 * Store for the public catalogue.
 * Manages categories (homepage), products by category (category page),
 * and product detail (product detail page).
 *
 * Story 3.1: Category Navigation
 * Story 3.2: Product Grid + Product Detail
 */
export const useCatalogStore = defineStore('catalog', () => {
  // --- Categories state ---
  const categories = ref<CategoryInfo[]>([])
  const isCategoriesLoading = ref(false)
  const categoriesError = ref<string | null>(null)

  // --- Products state ---
  const products = ref<CatalogProduct[]>([])
  const isProductsLoading = ref(false)
  const productsError = ref<string | null>(null)
  const productsNotFound = ref(false)

  // --- Product detail state ---
  const productDetail = ref<ProductDetailResource | null>(null)
  const isProductDetailLoading = ref(false)
  const productDetailError = ref<string | null>(null)

  // --- Actions ---

  /**
   * Fetch all 8 categories from the API.
   * GET /api/categories
   */
  async function fetchCategories(): Promise<void> {
    isCategoriesLoading.value = true
    categoriesError.value = null

    try {
      categories.value = await catalogService.fetchCategories()
    } catch (err: unknown) {
      const e = err as Error
      categoriesError.value = e.message || 'Impossible de charger les catégories.'
      categories.value = []
    } finally {
      isCategoriesLoading.value = false
    }
  }

  /**
   * Fetch all products for a given category slug.
   * GET /api/categories/{slug}/products
   *
   * Sets productsNotFound = true if the slug is invalid (404).
   */
  async function fetchProductsByCategory(slug: string, page: number = 1): Promise<void> {
    isProductsLoading.value = true
    productsError.value = null
    productsNotFound.value = false
    products.value = []

    try {
      const result = await catalogService.fetchProductsByCategory(slug, page)

      if (result.notFound) {
        productsNotFound.value = true
        products.value = []
      } else {
        products.value = result.products
      }
    } catch (err: unknown) {
      const e = err as Error
      productsError.value = e.message || 'Impossible de charger les produits.'
      products.value = []
    } finally {
      isProductsLoading.value = false
    }
  }

  /**
   * Fetch a single product detail by ID.
   * GET /api/products/{id}
   *
   * Story 3.2 AC3: Product detail page.
   */
  async function fetchProductDetail(id: number | string): Promise<void> {
    isProductDetailLoading.value = true
    productDetailError.value = null
    productDetail.value = null

    try {
      productDetail.value = await catalogService.fetchProductDetail(id)
    } catch (err: unknown) {
      const e = err as Error
      productDetailError.value = e.message || 'Impossible de charger le produit.'
      productDetail.value = null
    } finally {
      isProductDetailLoading.value = false
    }
  }

  // --- Filtered products state (Story 3.3) ---
  const filteredProducts = ref<CatalogProduct[]>([])
  const isFilteredProductsLoading = ref(false)
  const filteredProductsError = ref<string | null>(null)

  /**
   * Fetch filtered products from the API.
   * GET /api/products?category=...&price_min=...&price_max=...&search=...
   *
   * Story 3.3: Supports category, price_min, price_max, search filters.
   */
  async function fetchFilteredProducts(filters: ProductFiltersParams = {}): Promise<void> {
    isFilteredProductsLoading.value = true
    filteredProductsError.value = null

    try {
      filteredProducts.value = await catalogService.fetchFilteredProducts(filters)
    } catch (err: unknown) {
      const e = err as Error
      filteredProductsError.value = e.message || 'Impossible de charger les produits.'
      filteredProducts.value = []
    } finally {
      isFilteredProductsLoading.value = false
    }
  }

  /**
   * Reset filtered products state.
   */
  function resetFilteredProducts(): void {
    filteredProducts.value = []
    isFilteredProductsLoading.value = false
    filteredProductsError.value = null
  }

  /**
   * Reset products state (useful when navigating away from a category page).
   */
  function resetProducts(): void {
    products.value = []
    isProductsLoading.value = false
    productsError.value = null
    productsNotFound.value = false
  }

  /**
   * Reset product detail state.
   */
  function resetProductDetail(): void {
    productDetail.value = null
    isProductDetailLoading.value = false
    productDetailError.value = null
  }

  return {
    // Categories
    categories,
    isCategoriesLoading,
    categoriesError,
    fetchCategories,
    // Products
    products,
    isProductsLoading,
    productsError,
    productsNotFound,
    fetchProductsByCategory,
    resetProducts,
    // Filtered products (Story 3.3)
    filteredProducts,
    isFilteredProductsLoading,
    filteredProductsError,
    fetchFilteredProducts,
    resetFilteredProducts,
    // Product detail
    productDetail,
    isProductDetailLoading,
    productDetailError,
    fetchProductDetail,
    resetProductDetail,
  }
})
