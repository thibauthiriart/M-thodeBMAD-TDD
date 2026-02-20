/**
 * Product types matching the backend ProductResource response.
 *
 * Fields returned by GET /api/seller/products:
 *   id, name, photo_url, price, stock_quantity, is_active
 */

export interface SellerProduct {
  id: number
  name: string
  photo_url: string | null
  price: number
  stock_quantity: number
  is_active: boolean
}

export interface SellerProductsResponse {
  data: SellerProduct[]
}

/**
 * Product category enum matching backend PHP enum.
 * Categories: cpu, gpu, ram, stockage, cm, alimentation, boitier, peripheriques
 */
export type ProductCategory =
  | 'cpu'
  | 'gpu'
  | 'ram'
  | 'stockage'
  | 'cm'
  | 'alimentation'
  | 'boitier'
  | 'peripheriques'

/** Label map for displaying category names in the UI */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  stockage: 'Stockage',
  cm: 'Carte Mère',
  alimentation: 'Alimentation',
  boitier: 'Boîtier',
  peripheriques: 'Périphériques',
}

/** All available product categories */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'cpu',
  'gpu',
  'ram',
  'stockage',
  'cm',
  'alimentation',
  'boitier',
  'peripheriques',
]

/** A single spec key/value pair */
export interface ProductSpec {
  key: string
  value: string
}

/** Form data for creating/editing a product */
export interface ProductForm {
  name: string
  description: string
  specs: ProductSpec[]
  price: string
  stock_quantity: string
  category: ProductCategory | ''
  photo: File | null
}

/** Validation errors for product form fields */
export interface ProductFormErrors {
  [field: string]: string[]
}

/** Full product resource returned by the API (POST /api/seller/products response) */
export interface ProductResource {
  id: number
  name: string
  description: string
  category: ProductCategory
  price: number
  stock_quantity: number
  is_active: boolean
  photo_url: string | null
  specs?: ProductSpec[]
}

/** Wrapper for the API response */
export interface CreateProductResponse {
  data: ProductResource
}

/** Server 422 validation error response */
export interface ProductValidationError {
  message: string
  errors: ProductFormErrors
}

/** Category info for catalog navigation */
export interface CategoryInfo {
  slug: ProductCategory
  label: string
  icon: string
  description: string
}

/** Public product listing item (returned by GET /api/categories/{slug}/products) */
export interface CatalogProduct {
  id: number
  name: string
  description: string
  category: ProductCategory
  price: number
  stock_quantity: number
  photo_url: string | null
  seller_name: string
}

/**
 * Full product detail resource returned by GET /api/products/{id}.
 * Story 3.4: Includes all fields needed for the product detail page:
 * photo, name, description, specs, price, seller name, stock_quantity, restock_date
 */
export interface ProductDetailResource {
  id: number
  name: string
  description: string
  category: ProductCategory
  price: number
  stock_quantity: number
  photo_url: string | null
  seller_name: string
  specs: ProductSpec[]
  restock_date: string | null
}

/** All 8 categories with display info */
export const CATEGORY_CATALOG: CategoryInfo[] = [
  { slug: 'cpu', label: 'CPU', icon: '🔲', description: 'Processeurs pour tous les usages' },
  { slug: 'gpu', label: 'GPU', icon: '🎮', description: 'Cartes graphiques pour le gaming et le calcul' },
  { slug: 'ram', label: 'RAM', icon: '💾', description: 'Mémoire vive pour booster les performances' },
  { slug: 'stockage', label: 'Stockage', icon: '💿', description: 'SSD, HDD et stockage NVMe' },
  { slug: 'cm', label: 'Carte Mère', icon: '🖥️', description: 'Cartes mères pour tous les formats' },
  { slug: 'alimentation', label: 'Alimentation', icon: '⚡', description: 'Blocs d\'alimentation certifiés' },
  { slug: 'boitier', label: 'Boîtier', icon: '📦', description: 'Boîtiers PC de toutes tailles' },
  { slug: 'peripheriques', label: 'Périphériques', icon: '🖱️', description: 'Claviers, souris et accessoires' },
]
