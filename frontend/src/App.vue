<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const authStore = useAuthStore()
const cartStore = useCartStore()
const router = useRouter()

async function handleLogout(): Promise<void> {
  await authStore.logout()
  cartStore.reset()
  router.push('/')
}

onMounted(async () => {
  await authStore.hydrate()
  // After auth hydration, fetch cart for badge count (Story 4.1, NFR18)
  if (authStore.isAuthenticated && authStore.user?.role === 'acheteur') {
    cartStore.fetchCart()
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <RouterLink to="/" class="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
          testApp
        </RouterLink>
        <nav class="flex items-center gap-4">
          <RouterLink
            to="/"
            data-testid="nav-home-link"
            class="text-gray-600 hover:text-gray-900"
          >
            Accueil
          </RouterLink>
          <RouterLink
            to="/catalogue"
            data-testid="nav-catalogue-link"
            class="text-gray-600 hover:text-gray-900"
          >
            Catalogue
          </RouterLink>
          <RouterLink
            to="/about"
            data-testid="nav-about-link"
            class="text-gray-600 hover:text-gray-900"
          >
            About
          </RouterLink>

          <!-- Etat non connecte -->
          <template v-if="!authStore.isAuthenticated">
            <RouterLink
              to="/login"
              data-testid="nav-login-link"
              class="text-gray-600 hover:text-gray-900 font-medium"
            >
              Se connecter
            </RouterLink>
            <RouterLink
              to="/register"
              data-testid="nav-register-link"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
            >
              S'inscrire
            </RouterLink>
          </template>

          <!-- Etat connecte -->
          <template v-else-if="!authStore.isHydrating">
            <RouterLink
              to="/dashboard"
              data-testid="nav-dashboard-link"
              class="text-gray-600 hover:text-gray-900 font-medium"
            >
              Dashboard
            </RouterLink>

            <!-- Seller nav link (vendeur only) -->
            <RouterLink
              v-if="authStore.user?.role === 'vendeur'"
              to="/seller/dashboard"
              data-testid="nav-seller-dashboard-link"
              class="text-gray-600 hover:text-gray-900 font-medium"
            >
              Espace vendeur
            </RouterLink>

            <!-- Admin nav link (admin only) -->
            <RouterLink
              v-if="authStore.user?.role === 'admin'"
              to="/admin/dashboard"
              data-testid="nav-admin-dashboard-link"
              class="text-gray-600 hover:text-gray-900 font-medium"
            >
              Administration
            </RouterLink>

            <!-- Cart badge (Story 4.1) — visible for acheteur -->
            <RouterLink
              v-if="authStore.user?.role === 'acheteur'"
              to="/catalogue"
              data-testid="nav-cart-badge"
              class="relative inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              title="Mon panier"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <span
                v-if="cartStore.totalItems > 0"
                data-testid="nav-cart-count"
                class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
              >
                {{ cartStore.totalItems > 99 ? '99+' : cartStore.totalItems }}
              </span>
            </RouterLink>

            <RouterLink
              to="/profile"
              data-testid="nav-profile-link"
              class="text-gray-600 hover:text-gray-900 font-medium"
            >
              Mon profil
            </RouterLink>

            <!-- User info -->
            <span
              v-if="authStore.user?.email"
              data-testid="nav-user-email"
              class="text-sm text-gray-600"
            >
              {{ authStore.user.email }}
            </span>
            <span
              v-if="authStore.user?.role"
              data-testid="nav-user-role-badge"
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="{
                'bg-green-100 text-green-800': authStore.user.role === 'acheteur',
                'bg-blue-100 text-blue-800': authStore.user.role === 'vendeur',
                'bg-purple-100 text-purple-800': authStore.user.role === 'admin',
              }"
            >
              {{ authStore.user.role === 'acheteur' ? 'Acheteur' : authStore.user.role === 'vendeur' ? 'Vendeur' : 'Admin' }}
            </span>

            <button
              type="button"
              data-testid="nav-logout-btn"
              class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              @click="handleLogout"
            >
              Se déconnecter
            </button>
          </template>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
