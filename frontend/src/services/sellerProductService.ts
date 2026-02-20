import type {
  SellerProduct,
  SellerProductsResponse,
  ProductResource,
  CreateProductResponse,
  ProductFormErrors,
  ProductValidationError,
  ProductSpec,
} from '@/types/product'
import { API_BASE } from '@/config/api'

/**
 * Error thrown when the server returns a 422 validation error.
 * Carries the per-field errors from the server.
 */
export class ProductValidationException extends Error {
  public readonly fieldErrors: ProductFormErrors

  constructor(message: string, fieldErrors: ProductFormErrors) {
    super(message)
    this.name = 'ProductValidationException'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Fetch all products belonging to the authenticated seller.
 * GET /api/seller/products
 */
export async function fetchSellerProducts(authToken: string): Promise<SellerProduct[]> {
  const response = await fetch(`${API_BASE}/seller/products`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Accès interdit.')
    }
    throw new Error('Impossible de charger les produits.')
  }

  const json: SellerProductsResponse = await response.json()
  return json.data
}

/**
 * Create a new product.
 * POST /api/seller/products (multipart/form-data)
 */
export async function createProduct(
  authToken: string,
  data: {
    name: string
    description: string
    category: string
    price: string
    stock_quantity: string
    specs: ProductSpec[]
    photo: File
  }
): Promise<ProductResource> {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('description', data.description)
  formData.append('category', data.category)
  formData.append('price', data.price)
  formData.append('stock_quantity', data.stock_quantity)
  formData.append('specs', JSON.stringify(data.specs.filter((s) => s.key.trim() || s.value.trim())))
  formData.append('photo', data.photo)

  const response = await fetch(`${API_BASE}/seller/products`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  })

  if (!response.ok) {
    if (response.status === 422) {
      const errorData: ProductValidationError = await response.json()
      throw new ProductValidationException(
        errorData.message || 'Données invalides.',
        errorData.errors
      )
    }
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Accès interdit.')
    }
    throw new Error('Une erreur est survenue lors de la création du produit.')
  }

  const json: CreateProductResponse = await response.json()
  return json.data
}

/**
 * Fetch a single product by ID belonging to the authenticated seller.
 * GET /api/seller/products/{id}
 */
export async function fetchSellerProduct(
  authToken: string,
  productId: number
): Promise<ProductResource> {
  const response = await fetch(`${API_BASE}/seller/products/${productId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Produit introuvable ou vous n\'avez pas les droits pour y accéder.')
    }
    if (response.status === 404) {
      throw new Error('Produit introuvable.')
    }
    throw new Error('Impossible de charger le produit.')
  }

  const json: CreateProductResponse = await response.json()
  return json.data
}

/**
 * Update an existing product.
 * PUT /api/seller/products/{id} (multipart/form-data)
 */
export async function updateProduct(
  authToken: string,
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
): Promise<ProductResource> {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('description', data.description)
  formData.append('category', data.category)
  formData.append('price', data.price)
  formData.append('stock_quantity', data.stock_quantity)
  formData.append('specs', JSON.stringify(data.specs.filter((s) => s.key.trim() || s.value.trim())))

  if (data.photo) {
    formData.append('photo', data.photo)
  }

  const response = await fetch(`${API_BASE}/seller/products/${productId}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  })

  if (!response.ok) {
    if (response.status === 422) {
      const errorData: ProductValidationError = await response.json()
      throw new ProductValidationException(
        errorData.message || 'Données invalides.',
        errorData.errors
      )
    }
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Produit introuvable ou vous n\'avez pas les droits pour le modifier.')
    }
    throw new Error('Une erreur est survenue lors de la mise à jour du produit.')
  }

  const json: CreateProductResponse = await response.json()
  return json.data
}

/**
 * Toggle the is_active status of a product.
 * PATCH /api/seller/products/{id}/toggle-status
 */
export async function toggleProductStatus(
  authToken: string,
  productId: number
): Promise<ProductResource> {
  const response = await fetch(`${API_BASE}/seller/products/${productId}/toggle-status`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Ce produit ne vous appartient pas ou n\'existe pas.')
    }
    if (response.status === 404) {
      throw new Error('Produit introuvable.')
    }
    throw new Error('Une erreur est survenue lors du changement de statut.')
  }

  const json: CreateProductResponse = await response.json()
  return json.data
}

/**
 * Delete a product permanently.
 * DELETE /api/seller/products/{id}
 * Returns void on success (204 No Content).
 */
export async function deleteProduct(
  authToken: string,
  productId: number
): Promise<void> {
  const response = await fetch(`${API_BASE}/seller/products/${productId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Non authentifié.')
    }
    if (response.status === 403) {
      throw new Error('Ce produit ne vous appartient pas ou n\'existe pas.')
    }
    if (response.status === 404) {
      throw new Error('Produit introuvable.')
    }
    throw new Error('Une erreur est survenue lors de la suppression du produit.')
  }
}

export const sellerProductService = {
  fetchSellerProducts,
  createProduct,
  fetchSellerProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
}
