<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types/auth'

const authStore = useAuthStore()

// --- Mock data ---
interface MockUser {
  id: number
  name: string
  email: string
  role: UserRole
  created_at: string
}

const mockUsers = ref<MockUser[]>([
  { id: 1, name: 'Alice Martin', email: 'alice@example.com', role: 'acheteur', created_at: '2025-01-15' },
  { id: 2, name: 'Bob Dupont', email: 'bob@example.com', role: 'vendeur', created_at: '2025-02-20' },
  { id: 3, name: 'Charlie Admin', email: 'charlie@example.com', role: 'admin', created_at: '2025-01-01' },
  { id: 4, name: 'Diana Achat', email: 'diana@example.com', role: 'acheteur', created_at: '2025-03-10' },
])

const mockStats = ref({
  totalUsers: 4,
  totalSellers: 1,
  totalBuyers: 2,
  totalAdmins: 1,
})

const selectedTab = ref<'users' | 'stats'>('users')

// --- Handlers ---
function handleSelectTab(tab: 'users' | 'stats'): void {
  selectedTab.value = tab
  console.log('Tab selected:', tab)
}

function handleViewUser(userId: number): void {
  console.log('View user:', userId)
}

function handleDeleteUser(userId: number): void {
  console.log('Delete user:', userId)
}

function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800'
    case 'vendeur':
      return 'bg-blue-100 text-blue-800'
    case 'acheteur':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'vendeur':
      return 'Vendeur'
    case 'acheteur':
      return 'Acheteur'
    default:
      return role
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h2
        data-testid="admin-dashboard-title"
        class="text-3xl font-bold tracking-tight text-gray-900"
      >
        Administration
      </h2>
      <p
        data-testid="admin-dashboard-subtitle"
        class="mt-1 text-sm text-gray-600"
      >
        Bienvenue{{ authStore.user?.email ? `, ${authStore.user.email}` : '' }} — Panneau d'administration
      </p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav
        data-testid="admin-tabs"
        class="-mb-px flex space-x-8"
      >
        <button
          type="button"
          data-testid="admin-tab-users"
          :class="[
            'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
            selectedTab === 'users'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
          ]"
          @click="handleSelectTab('users')"
        >
          Utilisateurs
        </button>
        <button
          type="button"
          data-testid="admin-tab-stats"
          :class="[
            'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
            selectedTab === 'stats'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
          ]"
          @click="handleSelectTab('stats')"
        >
          Statistiques
        </button>
      </nav>
    </div>

    <!-- Stats panel -->
    <div
      v-if="selectedTab === 'stats'"
      data-testid="admin-stats-panel"
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Total utilisateurs</dt>
        <dd
          data-testid="admin-stat-total-users"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalUsers }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Vendeurs</dt>
        <dd
          data-testid="admin-stat-sellers"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalSellers }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Acheteurs</dt>
        <dd
          data-testid="admin-stat-buyers"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalBuyers }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Admins</dt>
        <dd
          data-testid="admin-stat-admins"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ mockStats.totalAdmins }}
        </dd>
      </div>
    </div>

    <!-- Users table -->
    <div
      v-if="selectedTab === 'users'"
      class="bg-white shadow rounded-lg overflow-hidden"
    >
      <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 class="text-lg font-medium leading-6 text-gray-900">Liste des utilisateurs</h3>
      </div>
      <table
        data-testid="admin-users-table"
        class="min-w-full divide-y divide-gray-200"
      >
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ID</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nom</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rôle</th>
            <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Inscrit le</th>
            <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr
            v-for="user in mockUsers"
            :key="user.id"
            :data-testid="`admin-user-row-${user.id}`"
          >
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ user.id }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              {{ user.name }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ user.email }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm">
              <span
                :class="[
                  'inline-flex rounded-full px-2 text-xs font-semibold leading-5',
                  getRoleBadgeClass(user.role),
                ]"
              >
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {{ user.created_at }}
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
              <button
                type="button"
                :data-testid="`admin-view-user-btn-${user.id}`"
                class="text-indigo-600 hover:text-indigo-900 mr-3"
                @click="handleViewUser(user.id)"
              >
                Voir
              </button>
              <button
                type="button"
                :data-testid="`admin-delete-user-btn-${user.id}`"
                class="text-red-600 hover:text-red-900"
                @click="handleDeleteUser(user.id)"
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
