<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CatalogProduct } from '@/types/product'
import ProductCard from '@/components/ProductCard.vue'

const props = withDefaults(
  defineProps<{
    /** All products to display in the grid */
    products: CatalogProduct[]
    /** Whether data is currently loading */
    loading?: boolean
    /** Number of items per page */
    perPage?: number
    /** Empty state message */
    emptyMessage?: string
    /** Empty state icon */
    emptyIcon?: string
  }>(),
  {
    loading: false,
    perPage: 12,
    emptyMessage: 'Aucun produit disponible.',
    emptyIcon: '📭',
  }
)

// ─── Pagination ────────────────────────────────────────────────────────────
const currentPage = ref<number>(1)

const totalPages = computed<number>(() =>
  Math.max(1, Math.ceil(props.products.length / props.perPage))
)

const paginatedProducts = computed<CatalogProduct[]>(() => {
  const start = (currentPage.value - 1) * props.perPage
  return props.products.slice(start, start + props.perPage)
})

const hasPrevious = computed<boolean>(() => currentPage.value > 1)
const hasNext = computed<boolean>(() => currentPage.value < totalPages.value)

function goToPage(page: number): void {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function previousPage(): void {
  goToPage(currentPage.value - 1)
}

function nextPage(): void {
  goToPage(currentPage.value + 1)
}

/** Visible page numbers (max 5, centered on current) */
const visiblePages = computed<number[]>(() => {
  const total = totalPages.value
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  let start = Math.max(1, currentPage.value - 2)
  let end = Math.min(total, start + 4)

  if (end - start < 4) {
    start = Math.max(1, end - 4)
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

// Reset to page 1 when the product list changes
watch(
  () => props.products,
  () => {
    currentPage.value = 1
  }
)
</script>

<template>
  <div data-testid="product-grid-container">
    <!-- Loading state -->
    <div
      v-if="loading"
      data-testid="product-grid-loading"
      class="flex justify-center py-16"
    >
      <div class="flex items-center gap-3 text-gray-500">
        <svg
          class="animate-spin h-6 w-6 text-indigo-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Chargement des produits...</span>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="products.length === 0"
      data-testid="product-grid-empty"
      class="text-center py-16"
    >
      <p class="text-5xl mb-4">{{ emptyIcon }}</p>
      <p class="text-lg text-gray-600">{{ emptyMessage }}</p>
    </div>

    <!-- Products grid + pagination -->
    <template v-else>
      <!-- Product count -->
      <p
        data-testid="product-grid-count"
        class="mb-4 text-sm text-gray-500"
      >
        {{ products.length }} produit{{ products.length > 1 ? 's' : '' }} trouvé{{ products.length > 1 ? 's' : '' }}
      </p>

      <!-- Responsive grid: 4 cols desktop, 2 cols tablet, 1 col mobile -->
      <div
        data-testid="product-grid"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <ProductCard
          v-for="product in paginatedProducts"
          :key="product.id"
          :product="product"
        />
      </div>

      <!-- Pagination -->
      <nav
        v-if="totalPages > 1"
        data-testid="product-grid-pagination"
        aria-label="Pagination des produits"
        class="mt-8 flex items-center justify-center gap-1"
      >
        <!-- Previous button -->
        <button
          type="button"
          data-testid="pagination-prev-btn"
          :disabled="!hasPrevious"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="hasPrevious
            ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
            : 'text-gray-300 cursor-not-allowed'"
          @click="previousPage"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Préc.
        </button>

        <!-- Page numbers -->
        <button
          v-for="page in visiblePages"
          :key="page"
          type="button"
          :data-testid="`pagination-page-${page}-btn`"
          class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors min-w-[40px]"
          :class="page === currentPage
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-gray-700 hover:bg-gray-100 cursor-pointer'"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>

        <!-- Next button -->
        <button
          type="button"
          data-testid="pagination-next-btn"
          :disabled="!hasNext"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="hasNext
            ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
            : 'text-gray-300 cursor-not-allowed'"
          @click="nextPage"
        >
          Suiv.
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </nav>

      <!-- Page info -->
      <p
        v-if="totalPages > 1"
        data-testid="pagination-info"
        class="mt-2 text-center text-xs text-gray-400"
      >
        Page {{ currentPage }} sur {{ totalPages }}
      </p>
    </template>
  </div>
</template>
