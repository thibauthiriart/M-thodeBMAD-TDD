<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()
const message = (route.query.message as string) || 'Vous n\'avez pas les droits pour accéder à cette page.'
</script>

<template>
  <div class="flex min-h-[calc(100vh-160px)] items-center justify-center py-12 px-4">
    <div class="w-full max-w-md text-center space-y-6">
      <!-- Icon -->
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg
          class="h-8 w-8 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>

      <!-- Title -->
      <h2
        data-testid="unauthorized-title"
        class="text-3xl font-bold tracking-tight text-gray-900"
      >
        Accès refusé
      </h2>

      <!-- Message -->
      <p
        data-testid="unauthorized-message"
        class="text-sm text-gray-600"
      >
        {{ message }}
      </p>

      <!-- Actions -->
      <div class="flex flex-col items-center gap-3 pt-4">
        <RouterLink
          to="/"
          data-testid="unauthorized-home-link"
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Retour à l'accueil
        </RouterLink>
        <RouterLink
          to="/dashboard"
          data-testid="unauthorized-dashboard-link"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Aller au dashboard
        </RouterLink>
      </div>
    </div>
  </div>
</template>
