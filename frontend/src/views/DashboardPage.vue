<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'

const authStore = useAuthStore()

// --- Mock data ---
const mockOrders = ref([
  { id: 101, date: '2025-02-10', total: 59.98, status: 'livré' },
  { id: 102, date: '2025-02-14', total: 29.99, status: 'en cours' },
  { id: 103, date: '2025-02-17', total: 89.97, status: 'en préparation' },
])

const mockCartItemCount = ref(2)

// --- Role labels ---
function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrateur'
    case 'vendeur':
      return 'Vendeur'
    case 'acheteur':
      return 'Acheteur'
    default:
      return ''
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'livré':
      return 'bg-green-100 text-green-800'
    case 'en cours':
      return 'bg-blue-100 text-blue-800'
    case 'en préparation':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h2
        data-testid="dashboard-title"
        class="text-3xl font-bold tracking-tight text-gray-900"
      >
        Dashboard
      </h2>
      <p
        data-testid="dashboard-subtitle"
        class="mt-1 text-sm text-gray-600"
      >
        Bienvenue{{ authStore.user?.email ? `, ${authStore.user.email}` : '' }}
        <span
          v-if="authStore.user?.role"
          data-testid="dashboard-user-role"
          class="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800"
        >
          {{ getRoleLabel(authStore.user?.role) }}
        </span>
      </p>
    </div>

    <!-- Quick actions for specific roles -->
    <div
      v-if="authStore.user?.role === 'vendeur' || authStore.user?.role === 'admin'"
      data-testid="dashboard-role-shortcuts"
      class="rounded-lg bg-indigo-50 p-4"
    >
      <p class="text-sm font-medium text-indigo-800 mb-3">Accès rapide</p>
      <div class="flex gap-3">
        <RouterLink
          v-if="authStore.user?.role === 'vendeur'"
          to="/seller/dashboard"
          data-testid="dashboard-seller-shortcut"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          Tableau de bord vendeur
        </RouterLink>
        <RouterLink
          v-if="authStore.user?.role === 'admin'"
          to="/admin/dashboard"
          data-testid="dashboard-admin-shortcut"
          class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-500"
        >
          Administration
        </RouterLink>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Mes commandes</dt>
        <dd
          data-testid="dashboard-orders-count"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockOrders.length }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Articles dans le panier</dt>
        <dd
          data-testid="dashboard-cart-count"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockCartItemCount }}
        </dd>
      </div>
    </div>

    <!-- Recent orders -->
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 class="text-lg font-medium leading-6 text-gray-900">Commandes récentes</h3>
      </div>
      <table
        data-testid="dashboard-orders-table"
        class="min-w-full divide-y divide-gray-200"
      >
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">N° commande</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr
            v-for="order in mockOrders"
            :key="order.id"
            :data-testid="`dashboard-order-row-${order.id}`"
          >
            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              #{{ order.id }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ order.date }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ order.total.toFixed(2) }} &euro;
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm">
              <span
                :class="[
                  'inline-flex rounded-full px-2 text-xs font-semibold leading-5',
                  getStatusClass(order.status),
                ]"
              >
                {{ order.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
