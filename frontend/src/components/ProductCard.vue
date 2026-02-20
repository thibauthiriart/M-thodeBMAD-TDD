<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { CatalogProduct } from '@/types/product'

const props = defineProps<{
  product: CatalogProduct
}>()

const formattedPrice = computed<string>(() =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(props.product.price)
)

/**
 * Whether the product image should be lazy-loaded.
 * The component uses native lazy loading via the `loading` attribute.
 */
const imgLoading = 'lazy' as const
</script>

<template>
  <RouterLink
    :to="`/products/${product.id}`"
    :data-testid="`product-card-${product.id}`"
    class="group block rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
  >
    <!-- Product image -->
    <div
      :data-testid="`product-image-${product.id}`"
      class="h-48 bg-gray-100 flex items-center justify-center overflow-hidden"
    >
      <img
        v-if="product.photo_url"
        :src="product.photo_url"
        :alt="product.name"
        :loading="imgLoading"
        class="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      <span v-else class="text-5xl text-gray-300">📷</span>
    </div>

    <!-- Product info -->
    <div class="p-4">
      <h3
        :data-testid="`product-name-${product.id}`"
        class="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate"
      >
        {{ product.name }}
      </h3>

      <p
        :data-testid="`product-seller-${product.id}`"
        class="mt-1 text-xs text-gray-400"
      >
        Vendu par {{ product.seller_name }}
      </p>

      <div class="mt-3 flex items-center justify-between">
        <span
          :data-testid="`product-price-${product.id}`"
          class="text-lg font-bold text-indigo-600"
        >
          {{ formattedPrice }}
        </span>
        <span
          :data-testid="`product-stock-${product.id}`"
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="product.stock_quantity > 0
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'"
        >
          {{ product.stock_quantity > 0 ? 'En stock' : 'Rupture' }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
