<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import type { ProductCategory } from '@/types/product'
import { PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORIES } from '@/types/product'
import ProductGrid from '@/components/ProductGrid.vue'
import { useCatalogStore } from '@/stores/catalog'

const route = useRoute()
const catalogStore = useCatalogStore()

const slug = computed<string>(() => route.params.slug as string)

const isValidCategory = computed<boolean>(() =>
  PRODUCT_CATEGORIES.includes(slug.value as ProductCategory)
)

const categoryLabel = computed<string>(() =>
  isValidCategory.value
    ? PRODUCT_CATEGORY_LABELS[slug.value as ProductCategory]
    : 'Categorie inconnue'
)

// Fetch products from API when category slug changes
watch(
  slug,
  (newSlug) => {
    if (isValidCategory.value) {
      catalogStore.fetchProductsByCategory(newSlug)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div data-testid="category-page">
    <!-- Breadcrumb -->
    <nav data-testid="category-breadcrumb" class="mb-6">
      <ol class="flex items-center gap-2 text-sm text-gray-500">
        <li>
          <RouterLink
            to="/"
            data-testid="breadcrumb-home-link"
            class="hover:text-indigo-600 transition-colors"
          >
            Accueil
          </RouterLink>
        </li>
        <li>
          <span class="mx-1">/</span>
        </li>
        <li>
          <span data-testid="breadcrumb-current" class="text-gray-900 font-medium">
            {{ categoryLabel }}
          </span>
        </li>
      </ol>
    </nav>

    <!-- Invalid category -->
    <div
      v-if="!isValidCategory"
      data-testid="category-not-found"
      class="text-center py-16"
    >
      <p class="text-5xl mb-4">🔍</p>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Categorie introuvable</h2>
      <p class="text-gray-600 mb-6">
        La categorie &laquo; {{ slug }} &raquo; n'existe pas.
      </p>
      <RouterLink
        to="/"
        data-testid="back-home-link"
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
      >
        &larr; Retour a l'accueil
      </RouterLink>
    </div>

    <!-- Valid category -->
    <template v-else>
      <!-- Page header -->
      <div class="mb-8">
        <h1
          data-testid="category-title"
          class="text-3xl font-bold text-gray-900"
        >
          {{ categoryLabel }}
        </h1>
      </div>

      <!-- Product grid (reusable component) -->
      <ProductGrid
        :products="catalogStore.products"
        :loading="catalogStore.isProductsLoading"
        :per-page="12"
        empty-message="Il n'y a pas encore de produits dans cette categorie."
      />
    </template>
  </div>
</template>
