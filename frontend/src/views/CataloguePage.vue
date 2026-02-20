<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { CatalogProduct } from '@/types/product'
import ProductFilters from '@/components/ProductFilters.vue'
import type { ProductFilterValues } from '@/components/ProductFilters.vue'
import ProductGrid from '@/components/ProductGrid.vue'

// ─── Product data (curated catalogue) ─────────────────────────────────────
const allProducts = ref<CatalogProduct[]>([
  {
    id: 1,
    name: 'AMD Ryzen 9 7950X',
    description: 'Processeur 16 coeurs / 32 threads',
    category: 'cpu',
    price: 589.99,
    stock_quantity: 12,
    photo_url: null,
    seller_name: 'TechPro',
  },
  {
    id: 2,
    name: 'Intel Core i7-14700K',
    description: 'Processeur 20 coeurs / 28 threads',
    category: 'cpu',
    price: 419.90,
    stock_quantity: 8,
    photo_url: null,
    seller_name: 'CompoShop',
  },
  {
    id: 3,
    name: 'NVIDIA RTX 4090',
    description: 'Carte graphique 24 Go GDDR6X',
    category: 'gpu',
    price: 1899.00,
    stock_quantity: 3,
    photo_url: null,
    seller_name: 'TechPro',
  },
  {
    id: 4,
    name: 'AMD Radeon RX 7900 XTX',
    description: 'Carte graphique 24 Go GDDR6',
    category: 'gpu',
    price: 999.99,
    stock_quantity: 5,
    photo_url: null,
    seller_name: 'GPUWorld',
  },
  {
    id: 5,
    name: 'Corsair Vengeance DDR5 32 Go',
    description: 'Kit 2x16 Go DDR5-6000 CL36',
    category: 'ram',
    price: 129.99,
    stock_quantity: 25,
    photo_url: null,
    seller_name: 'MemoryKing',
  },
  {
    id: 6,
    name: 'G.Skill Trident Z5 RGB 64 Go',
    description: 'Kit 2x32 Go DDR5-6400 CL32',
    category: 'ram',
    price: 249.90,
    stock_quantity: 10,
    photo_url: null,
    seller_name: 'TechPro',
  },
  {
    id: 7,
    name: 'Samsung 990 Pro 2 To',
    description: 'SSD NVMe M.2 PCIe 4.0',
    category: 'stockage',
    price: 179.99,
    stock_quantity: 18,
    photo_url: null,
    seller_name: 'StoragePlus',
  },
  {
    id: 8,
    name: 'WD Black SN850X 1 To',
    description: 'SSD NVMe M.2 PCIe 4.0',
    category: 'stockage',
    price: 89.99,
    stock_quantity: 30,
    photo_url: null,
    seller_name: 'CompoShop',
  },
  {
    id: 9,
    name: 'ASUS ROG Strix Z790-E',
    description: 'Carte mère ATX LGA1700 DDR5',
    category: 'cm',
    price: 449.90,
    stock_quantity: 6,
    photo_url: null,
    seller_name: 'TechPro',
  },
  {
    id: 10,
    name: 'MSI MPG Z790 Carbon WiFi',
    description: 'Carte mère ATX LGA1700 DDR5',
    category: 'cm',
    price: 399.00,
    stock_quantity: 4,
    photo_url: null,
    seller_name: 'CompoShop',
  },
  {
    id: 11,
    name: 'Corsair RM1000x',
    description: 'Alimentation 1000W 80+ Gold modulaire',
    category: 'alimentation',
    price: 189.99,
    stock_quantity: 15,
    photo_url: null,
    seller_name: 'PowerSupply+',
  },
  {
    id: 12,
    name: 'Seasonic Focus GX-850',
    description: 'Alimentation 850W 80+ Gold modulaire',
    category: 'alimentation',
    price: 139.90,
    stock_quantity: 20,
    photo_url: null,
    seller_name: 'TechPro',
  },
  {
    id: 13,
    name: 'NZXT H7 Flow',
    description: 'Boîtier ATX Mesh airflow',
    category: 'boitier',
    price: 129.99,
    stock_quantity: 9,
    photo_url: null,
    seller_name: 'CaseWorld',
  },
  {
    id: 14,
    name: 'Fractal Design Torrent',
    description: 'Boîtier ATX haute ventilation',
    category: 'boitier',
    price: 189.90,
    stock_quantity: 7,
    photo_url: null,
    seller_name: 'CompoShop',
  },
  {
    id: 15,
    name: 'Logitech G Pro X Superlight',
    description: 'Souris gaming sans fil 63g',
    category: 'peripheriques',
    price: 129.00,
    stock_quantity: 22,
    photo_url: null,
    seller_name: 'PeriphStore',
  },
  {
    id: 16,
    name: 'Razer Huntsman V3 Pro',
    description: 'Clavier mécanique analogique',
    category: 'peripheriques',
    price: 249.99,
    stock_quantity: 0,
    photo_url: null,
    seller_name: 'TechPro',
  },
])

// ─── Filter state ─────────────────────────────────────────────────────────
const activeFilters = ref<ProductFilterValues>({
  category: '',
  priceMin: '',
  priceMax: '',
  search: '',
})

const isLoading = ref<boolean>(false)

/**
 * Apply filters to the product data (client-side filtering).
 * Filters are applied with AND logic.
 */
const filteredProducts = computed<CatalogProduct[]>(() => {
  let result = allProducts.value

  // Filter by category
  if (activeFilters.value.category) {
    result = result.filter((p) => p.category === activeFilters.value.category)
  }

  // Filter by price min
  if (activeFilters.value.priceMin) {
    const min = parseFloat(activeFilters.value.priceMin)
    if (!isNaN(min)) {
      result = result.filter((p) => p.price >= min)
    }
  }

  // Filter by price max
  if (activeFilters.value.priceMax) {
    const max = parseFloat(activeFilters.value.priceMax)
    if (!isNaN(max)) {
      result = result.filter((p) => p.price <= max)
    }
  }

  // Filter by search term (name LIKE %term%)
  if (activeFilters.value.search && activeFilters.value.search.trim()) {
    const term = activeFilters.value.search.trim().toLowerCase()
    result = result.filter((p) => p.name.toLowerCase().includes(term))
  }

  return result
})

/** Whether any filter is currently active */
const hasActiveFilters = computed<boolean>(() =>
  !!(activeFilters.value.category || activeFilters.value.priceMin || activeFilters.value.priceMax || activeFilters.value.search)
)

/**
 * Handle filter changes from ProductFilters component.
 * Updates local filter state; filtering is done client-side via computed.
 */
function onFilter(filters: ProductFilterValues): void {
  activeFilters.value = { ...filters }
}
</script>

<template>
  <div data-testid="catalogue-page">
    <!-- Breadcrumb -->
    <nav data-testid="catalogue-breadcrumb" class="mb-6">
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
            Catalogue
          </span>
        </li>
      </ol>
    </nav>

    <!-- Page header -->
    <div class="mb-8">
      <h1
        data-testid="catalogue-title"
        class="text-3xl font-bold text-gray-900"
      >
        Catalogue
      </h1>
      <p
        data-testid="catalogue-subtitle"
        class="mt-2 text-gray-600"
      >
        Parcourez tous nos composants et trouvez exactement ce qu'il vous faut.
      </p>
    </div>

    <!-- Layout: sidebar filters + product grid -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Filters sidebar -->
      <aside
        data-testid="filters-sidebar"
        class="lg:w-80 flex-shrink-0"
      >
        <ProductFilters @filter="onFilter" />
      </aside>

      <!-- Main content: product grid -->
      <div class="flex-1 min-w-0">
        <!-- Results count / info bar -->
        <div
          data-testid="results-info"
          class="flex items-center justify-between mb-4"
        >
          <p class="text-sm text-gray-500">
            <span data-testid="results-count">{{ filteredProducts.length }}</span>
            produit{{ filteredProducts.length > 1 ? 's' : '' }}
            <span v-if="hasActiveFilters"> correspondant{{ filteredProducts.length > 1 ? 's' : '' }} aux filtres</span>
          </p>
        </div>

        <!-- No results message -->
        <div
          v-if="filteredProducts.length === 0 && !isLoading"
          data-testid="no-results-message"
          class="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <p class="text-5xl mb-4">🔍</p>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Aucun produit trouvé</h3>
          <p class="text-gray-600 mb-4">
            Aucun produit ne correspond à vos critères de recherche.
          </p>
          <p class="text-sm text-gray-400">
            Essayez de modifier ou réinitialiser vos filtres.
          </p>
        </div>

        <!-- Product grid -->
        <ProductGrid
          v-if="filteredProducts.length > 0 || isLoading"
          :products="filteredProducts"
          :loading="isLoading"
          :per-page="12"
          empty-message="Aucun produit disponible."
        />
      </div>
    </div>
  </div>
</template>
