<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CATEGORY_CATALOG } from '@/types/product'
import type { CategoryInfo } from '@/types/product'

const categories: CategoryInfo[] = CATEGORY_CATALOG
</script>

<template>
  <div data-testid="home-page">
    <!-- Hero section -->
    <section class="text-center py-10 mb-8">
      <h1
        data-testid="home-title"
        class="text-4xl font-extrabold text-gray-900 mb-3"
      >
        Composants PC
      </h1>
      <p
        data-testid="home-subtitle"
        class="text-lg text-gray-600 max-w-2xl mx-auto"
      >
        Trouvez les meilleurs composants informatiques pour votre configuration.
        Parcourez nos catégories pour démarrer.
      </p>
    </section>

    <!-- Category grid -->
    <section>
      <h2
        data-testid="categories-heading"
        class="text-2xl font-bold text-gray-900 mb-6"
      >
        Parcourir par catégorie
      </h2>

      <div
        data-testid="category-grid"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        <RouterLink
          v-for="category in categories"
          :key="category.slug"
          :to="`/categories/${category.slug}`"
          :data-testid="`category-card-${category.slug}`"
          class="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5"
        >
          <div class="text-center">
            <span
              :data-testid="`category-icon-${category.slug}`"
              class="text-4xl mb-3 block"
            >
              {{ category.icon }}
            </span>
            <h3
              :data-testid="`category-name-${category.slug}`"
              class="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors"
            >
              {{ category.label }}
            </h3>
            <p
              :data-testid="`category-desc-${category.slug}`"
              class="mt-1 text-sm text-gray-500"
            >
              {{ category.description }}
            </p>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
