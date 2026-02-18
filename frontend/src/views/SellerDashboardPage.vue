<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// --- Mock data ---
const mockProducts = ref([
  { id: 1, name: 'Produit A', price: 29.99, stock: 15, status: 'actif' },
  { id: 2, name: 'Produit B', price: 49.99, stock: 0, status: 'rupture' },
  { id: 3, name: 'Produit C', price: 19.99, stock: 8, status: 'actif' },
])

const mockStats = ref({
  totalProducts: 3,
  totalOrders: 12,
  revenue: 459.87,
})

// --- Handlers ---
function handleAddProduct(): void {
  console.log('Add product clicked')
}

function handleEditProduct(productId: number): void {
  console.log('Edit product:', productId)
}

function handleDeleteProduct(productId: number): void {
  console.log('Delete product:', productId)
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2
          data-testid="seller-dashboard-title"
          class="text-3xl font-bold tracking-tight text-gray-900"
        >
          Tableau de bord vendeur
        </h2>
        <p
          data-testid="seller-dashboard-subtitle"
          class="mt-1 text-sm text-gray-600"
        >
          Bienvenue{{ authStore.user?.email ? `, ${authStore.user.email}` : '' }}
        </p>
      </div>
      <button
        type="button"
        data-testid="seller-add-product-btn"
        class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        @click="handleAddProduct"
      >
        + Ajouter un produit
      </button>
    </div>

    <!-- Stats cards -->
    <div
      data-testid="seller-stats"
      class="grid grid-cols-1 gap-5 sm:grid-cols-3"
    >
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Produits</dt>
        <dd
          data-testid="seller-stat-products"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalProducts }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Commandes</dt>
        <dd
          data-testid="seller-stat-orders"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalOrders }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Chiffre d'affaires</dt>
        <dd
          data-testid="seller-stat-revenue"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.revenue.toFixed(2) }} &euro;
        </dd>
      </div>
    </div>

    <!-- Products table -->
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 class="text-lg font-medium leading-6 text-gray-900">Mes produits</h3>
      </div>
      <table
        data-testid="seller-products-table"
        class="min-w-full divide-y divide-gray-200"
      >
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nom</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Prix</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr
            v-for="product in mockProducts"
            :key="product.id"
            :data-testid="`seller-product-row-${product.id}`"
          >
            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              {{ product.name }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ product.price.toFixed(2) }} &euro;
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ product.stock }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm">
              <span
                :class="[
                  'inline-flex rounded-full px-2 text-xs font-semibold leading-5',
                  product.status === 'actif'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800',
                ]"
              >
                {{ product.status === 'actif' ? 'Actif' : 'Rupture' }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
              <button
                type="button"
                :data-testid="`seller-edit-product-btn-${product.id}`"
                class="text-indigo-600 hover:text-indigo-900 mr-3"
                @click="handleEditProduct(product.id)"
              >
                Modifier
              </button>
              <button
                type="button"
                :data-testid="`seller-delete-product-btn-${product.id}`"
                class="text-red-600 hover:text-red-900"
                @click="handleDeleteProduct(product.id)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
