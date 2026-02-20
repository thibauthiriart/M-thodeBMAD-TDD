<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ProductCategory } from '@/types/product'
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@/types/product'

/** Filter values emitted to the parent */
export interface ProductFilterValues {
  category: ProductCategory | ''
  priceMin: string
  priceMax: string
  search: string
}

const emit = defineEmits<{
  (e: 'filter', filters: ProductFilterValues): void
}>()

// ─── Filter state (local refs with v-model) ────────────────────────────
const selectedCategory = ref<ProductCategory | ''>('')
const priceMin = ref<string>('')
const priceMax = ref<string>('')
const search = ref<string>('')

/**
 * Emit current filter state to the parent.
 */
function emitFilters(): void {
  emit('filter', {
    category: selectedCategory.value,
    priceMin: priceMin.value,
    priceMax: priceMax.value,
    search: search.value,
  })
}

/**
 * Reset all filters to their default values.
 */
function resetFilters(): void {
  selectedCategory.value = ''
  priceMin.value = ''
  priceMax.value = ''
  search.value = ''
  emitFilters()
}

/**
 * Select or deselect a category chip.
 */
function toggleCategory(cat: ProductCategory): void {
  selectedCategory.value = selectedCategory.value === cat ? '' : cat
  emitFilters()
}

// Watch price and search inputs and emit on change
watch([priceMin, priceMax, search], () => {
  emitFilters()
})
</script>

<template>
  <div
    data-testid="product-filters"
    class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
  >
    <div class="flex items-center justify-between mb-5">
      <h2
        data-testid="filters-title"
        class="text-lg font-semibold text-gray-900"
      >
        Filtres
      </h2>
      <button
        type="button"
        data-testid="filters-reset-btn"
        class="text-sm text-indigo-600 hover:text-indigo-500 font-medium transition-colors cursor-pointer"
        @click="resetFilters"
      >
        Réinitialiser
      </button>
    </div>

    <!-- Search input -->
    <div class="mb-5">
      <label
        for="filter-search"
        data-testid="search-label"
        class="block text-sm font-medium text-gray-700 mb-1.5"
      >
        Rechercher par nom
      </label>
      <div class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <input
          id="filter-search"
          v-model="search"
          type="text"
          data-testid="search-input"
          placeholder="Ex : RTX 4090, Ryzen 9..."
          class="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>
    </div>

    <!-- Category chips -->
    <div class="mb-5">
      <label
        data-testid="category-filter-label"
        class="block text-sm font-medium text-gray-700 mb-2"
      >
        Catégorie
      </label>
      <div
        data-testid="category-chips"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="cat in PRODUCT_CATEGORIES"
          :key="cat"
          type="button"
          :data-testid="`category-chip-${cat}`"
          class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
          :class="selectedCategory === cat
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          @click="toggleCategory(cat)"
        >
          {{ PRODUCT_CATEGORY_LABELS[cat] }}
        </button>
      </div>
    </div>

    <!-- Price range -->
    <div class="mb-2">
      <label
        data-testid="price-filter-label"
        class="block text-sm font-medium text-gray-700 mb-2"
      >
        Fourchette de prix (€)
      </label>
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <input
            v-model="priceMin"
            type="number"
            min="0"
            step="0.01"
            data-testid="price-min-input"
            placeholder="Min"
            class="block w-full rounded-lg border border-gray-300 py-2 px-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <span class="text-gray-400 text-sm font-medium">—</span>
        <div class="flex-1">
          <input
            v-model="priceMax"
            type="number"
            min="0"
            step="0.01"
            data-testid="price-max-input"
            placeholder="Max"
            class="block w-full rounded-lg border border-gray-300 py-2 px-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
      </div>
    </div>

    <!-- Active filters summary -->
    <div
      v-if="selectedCategory || priceMin || priceMax || search"
      data-testid="active-filters-summary"
      class="mt-4 pt-4 border-t border-gray-100"
    >
      <p class="text-xs text-gray-500 mb-2">Filtres actifs :</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-if="selectedCategory"
          data-testid="active-filter-category"
          class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
        >
          {{ PRODUCT_CATEGORY_LABELS[selectedCategory] }}
          <button
            type="button"
            data-testid="remove-category-filter-btn"
            class="ml-0.5 text-indigo-400 hover:text-indigo-600 cursor-pointer"
            @click="selectedCategory = ''; emitFilters()"
          >
            ×
          </button>
        </span>
        <span
          v-if="priceMin"
          data-testid="active-filter-price-min"
          class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
        >
          Min: {{ priceMin }} €
          <button
            type="button"
            data-testid="remove-price-min-filter-btn"
            class="ml-0.5 text-indigo-400 hover:text-indigo-600 cursor-pointer"
            @click="priceMin = ''"
          >
            ×
          </button>
        </span>
        <span
          v-if="priceMax"
          data-testid="active-filter-price-max"
          class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
        >
          Max: {{ priceMax }} €
          <button
            type="button"
            data-testid="remove-price-max-filter-btn"
            class="ml-0.5 text-indigo-400 hover:text-indigo-600 cursor-pointer"
            @click="priceMax = ''"
          >
            ×
          </button>
        </span>
        <span
          v-if="search"
          data-testid="active-filter-search"
          class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
        >
          « {{ search }} »
          <button
            type="button"
            data-testid="remove-search-filter-btn"
            class="ml-0.5 text-indigo-400 hover:text-indigo-600 cursor-pointer"
            @click="search = ''; emitFilters()"
          >
            ×
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
