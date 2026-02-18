<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { LoginForm } from '@/types/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref<LoginForm>({
  email: '',
  password: '',
})

const isFormValid = computed(() => {
  return form.value.email.trim() !== '' && form.value.password.trim() !== ''
})

async function handleSubmit(): Promise<void> {
  authStore.generalError = ''

  if (!isFormValid.value) {
    authStore.generalError = 'Veuillez remplir tous les champs.'
    return
  }

  const success = await authStore.login(form.value)

  if (success) {
    router.push('/')
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-80px)] items-center justify-center py-12 px-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2
          data-testid="login-title"
          class="text-3xl font-bold tracking-tight text-gray-900"
        >
          Se connecter
        </h2>
        <p
          data-testid="login-subtitle"
          class="mt-2 text-sm text-gray-600"
        >
          Accédez à votre compte testApp
        </p>
      </div>

      <!-- Form -->
      <form
        data-testid="login-form"
        class="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-md"
        @submit.prevent="handleSubmit"
      >
        <!-- General error (identifiants invalides - message generique AC#2) -->
        <div
          v-if="authStore.generalError"
          data-testid="login-error-message"
          class="rounded-md bg-red-50 p-4"
        >
          <div class="flex">
            <svg
              class="h-5 w-5 text-red-400 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                clip-rule="evenodd"
              />
            </svg>
            <p class="text-sm text-red-700">{{ authStore.generalError }}</p>
          </div>
        </div>

        <!-- Email -->
        <div>
          <label for="login-email" class="block text-sm font-medium text-gray-700">
            Adresse email
          </label>
          <input
            id="login-email"
            v-model="form.email"
            data-testid="login-email-input"
            type="email"
            autocomplete="email"
            placeholder="vous@exemple.com"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <!-- Password -->
        <div>
          <label for="login-password" class="block text-sm font-medium text-gray-700">
            Mot de passe
          </label>
          <input
            id="login-password"
            v-model="form.password"
            data-testid="login-password-input"
            type="password"
            autocomplete="current-password"
            placeholder="Votre mot de passe"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <!-- Submit Button -->
        <div>
          <button
            type="submit"
            data-testid="login-submit-btn"
            :disabled="authStore.isLoading"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              v-if="authStore.isLoading"
              data-testid="login-loading-spinner"
              class="mr-2 h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ authStore.isLoading ? 'Connexion en cours...' : 'Se connecter' }}
          </button>
        </div>

        <!-- Register link -->
        <p
          data-testid="register-link-text"
          class="text-center text-sm text-gray-600"
        >
          Pas encore de compte ?
          <RouterLink
            to="/register"
            data-testid="register-link"
            class="font-medium text-indigo-600 hover:text-indigo-500"
          >
            S'inscrire
          </RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>
