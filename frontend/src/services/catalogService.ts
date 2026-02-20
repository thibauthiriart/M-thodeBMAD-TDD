import type { CatalogProduct, CategoryInfo, ProductDetailResource } from '@/types/product'
import { API_BASE } from '@/config/api'

/**
 * Response shape for paginated products endpoint.
 * GET /api/categories/{slug}/products returns Laravel pagination.
 */
export interface PaginatedProductsResponse {
  data: CatalogProduct[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  links?: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}

/**
 * Product detail response shape.
 * GET /api/products/{id}
 */
export interface ProductDetailResponse {
  data: ProductDetailResource
}

/**
 * Fetch all 8 fixed categories from the backend.
 * GET /api/categories
 * Public route (no auth required).
 */
export async function fetchCategories(): Promise<CategoryInfo[]> {
  const response = await fetch(`${API_BASE}/categories`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Impossible de charger les catégories.')
  }

  const json = await response.json()
  const categories = json.data || json
  return categories as CategoryInfo[]
}

/**
 * Fetch all active products for a given category slug.
 * GET /api/categories/{slug}/products?per_page=1000
 * Public route (no auth required).
 *
 * Returns all products at once (large per_page) so the frontend
 * ProductGrid component can handle client-side pagination.
 *
 * Returns notFound=true if the category slug is invalid (404).
 */
export async function fetchProductsByCategory(
  slug: string,
  _page: number = 1
): Promise<{ products: CatalogProduct[]; notFound: boolean }> {
  const response = await fetch(`${API_BASE}/categories/${slug}/products?per_page=100`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status === 404) {
    return { products: [], notFound: true }
  }

  if (!response.ok) {
    throw new Error('Impossible de charger les produits.')
  }

  const json = await response.json()
  const products = json.data || json
  return { products: products as CatalogProduct[], notFound: false }
}

/**
 * Fetch a single product detail by ID.
 * GET /api/products/{id}
 * Public route (no auth required).
 *
 * Returns null if the product doesn't exist or is inactive (404).
 * Story 3.4: Returns full detail including specs, restock_date, seller_name.
 */
export async function fetchProductDetail(
  id: number | string
): Promise<ProductDetailResource | null> {
  const response = await fetch(`${API_BASE}/products/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Impossible de charger le produit.')
  }

  const json = await response.json()
  return (json.data || json) as ProductDetailResource
}

/**
 * Filter parameters for the product catalogue.
 * Story 3.3: Category, price range, and search filters.
 */
export interface ProductFiltersParams {
  category?: string
  price_min?: string
  price_max?: string
  search?: string
}

/**
 * Fetch filtered products from the public catalogue.
 * GET /api/products?category=...&price_min=...&price_max=...&search=...
 * Public route (no auth required).
 *
 * Story 3.3: Supports category, price_min, price_max, search query params.
 * All filters use AND logic. Search uses LIKE %term% on product name.
 */
export async function fetchFilteredProducts(
  filters: ProductFiltersParams = {}
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams()

  if (filters.category) {
    params.set('category', filters.category)
  }
  if (filters.price_min) {
    params.set('price_min', filters.price_min)
  }
  if (filters.price_max) {
    params.set('price_max', filters.price_max)
  }
  if (filters.search) {
    params.set('search', filters.search)
  }

  const queryString = params.toString()
  const url = `${API_BASE}/products${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Impossible de charger les produits.')
  }

  const json = await response.json()
  const products = json.data || json
  return products as CatalogProduct[]
}

export const catalogService = {
  fetchCategories,
  fetchProductsByCategory,
  fetchProductDetail,
  fetchFilteredProducts,
}
