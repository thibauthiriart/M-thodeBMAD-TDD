<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { RegisterForm, UserRole, ValidationErrors } from '@/types/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref<RegisterForm>({
  email: '',
  password: '',
  password_confirmation: '',
  role: '',
})

const clientErrors = computed(() => {
  const errors: ValidationErrors = {}

  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.email = ['Veuillez entrer une adresse email valide.']
  }

  if (form.value.password && form.value.password.length < 8) {
    errors.password = ['Le mot de passe doit contenir au moins 8 caractères.']
  }

  if (
    form.value.password_confirmation &&
    form.value.password &&
    form.value.password !== form.value.password_confirmation
  ) {
    errors.password_confirmation = ['Les mots de passe ne correspondent pas.']
  }

  return errors
})

const hasClientErrors = computed(() => Object.keys(clientErrors.value).length > 0)

function getFieldErrors(field: string): string[] {
  return authStore.serverErrors[field] || clientErrors.value[field] || []
}

const generalError = computed(() => authStore.generalError)

async function handleSubmit(): Promise<void> {
  authStore.serverErrors = {}
  authStore.generalError = ''

  if (hasClientErrors.value) {
    return
  }

  if (!form.value.email || !form.value.password || !form.value.password_confirmation || !form.value.role) {
    authStore.generalError = 'Veuillez remplir tous les champs.'
    return
  }

  const success = await authStore.register(form.value)

  if (success) {
    router.push('/')
  }
}

function selectRole(role: UserRole): void {
  form.value.role = role
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-80px)] items-center justify-center py-12 px-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2
          data-testid="register-title"
          class="text-3xl font-bold tracking-tight text-gray-900"
        >
          Créer un compte
        </h2>
        <p
          data-testid="register-subtitle"
          class="mt-2 text-sm text-gray-600"
        >
          Choisissez votre rôle et commencez à utiliser testApp
        </p>
      </div>

      <!-- Form -->
      <form
        data-testid="register-form"
        class="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-md"
        @submit.prevent="handleSubmit"
      >
        <!-- General error -->
        <div
          v-if="generalError"
          data-testid="general-error-message"
          class="rounded-md bg-red-50 p-4"
        >
          <p class="text-sm text-red-700">{{ generalError }}</p>
        </div>

        <!-- Email -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">
            Adresse email
          </label>
          <input
            id="email"
            v-model="form.email"
            data-testid="email-input"
            type="email"
            autocomplete="email"
            placeholder="vous@exemple.com"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('email').length }"
          />
          <p
            v-if="getFieldErrors('email').length"
            data-testid="email-error"
            class="mt-1 text-sm text-red-600"
          >
            {{ getFieldErrors('email')[0] }}
          </p>
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">
            Mot de passe
          </label>
          <input
            id="password"
            v-model="form.password"
            data-testid="password-input"
            type="password"
            autocomplete="new-password"
            placeholder="Minimum 8 caractères"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('password').length }"
          />
          <p
            v-if="getFieldErrors('password').length"
            data-testid="password-error"
            class="mt-1 text-sm text-red-600"
          >
            {{ getFieldErrors('password')[0] }}
          </p>
        </div>

        <!-- Password Confirmation -->
        <div>
          <label for="password_confirmation" class="block text-sm font-medium text-gray-700">
            Confirmer le mot de passe
          </label>
          <input
            id="password_confirmation"
            v-model="form.password_confirmation"
            data-testid="password-confirmation-input"
            type="password"
            autocomplete="new-password"
            placeholder="Répétez votre mot de passe"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('password_confirmation').length }"
          />
          <p
            v-if="getFieldErrors('password_confirmation').length"
            data-testid="password-confirmation-error"
            class="mt-1 text-sm text-red-600"
          >
            {{ getFieldErrors('password_confirmation')[0] }}
          </p>
        </div>

        <!-- Role Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">
            Je suis un...
          </label>
          <div class="grid grid-cols-2 gap-4">
            <!-- Acheteur -->
            <button
              type="button"
              data-testid="role-acheteur-btn"
              class="relative flex flex-col items-center rounded-xl border-2 p-6 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :class="
                form.role === 'acheteur'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              "
              @click="selectRole('acheteur')"
            >
              <svg class="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              <span class="text-sm font-semibold">Acheteur</span>
              <span class="mt-1 text-xs opacity-70">Je veux acheter</span>
              <div
                v-if="form.role === 'acheteur'"
                class="absolute top-2 right-2"
              >
                <svg class="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>

            <!-- Vendeur -->
            <button
              type="button"
              data-testid="role-vendeur-btn"
              class="relative flex flex-col items-center rounded-xl border-2 p-6 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :class="
                form.role === 'vendeur'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              "
              @click="selectRole('vendeur')"
            >
              <svg class="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0 0 20.25 9.35m-16.5 0a3.004 3.004 0 0 0-.621-1.72L4.49 5.55a2.25 2.25 0 0 1 1.705-.778h7.612a2.25 2.25 0 0 1 1.705.778l1.36 2.08a3 3 0 0 0-.621 1.72" />
              </svg>
              <span class="text-sm font-semibold">Vendeur</span>
              <span class="mt-1 text-xs opacity-70">Je veux vendre</span>
              <div
                v-if="form.role === 'vendeur'"
                class="absolute top-2 right-2"
              >
                <svg class="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
          <p
            v-if="getFieldErrors('role').length"
            data-testid="role-error"
            class="mt-2 text-sm text-red-600"
          >
            {{ getFieldErrors('role')[0] }}
          </p>
        </div>

        <!-- Submit Button -->
        <div>
          <button
            type="submit"
            data-testid="register-submit-btn"
            :disabled="authStore.isLoading"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              v-if="authStore.isLoading"
              data-testid="loading-spinner"
              class="mr-2 h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ authStore.isLoading ? 'Création en cours...' : 'Créer mon compte' }}
          </button>
        </div>

        <!-- Login link -->
        <p
          data-testid="login-link-text"
          class="text-center text-sm text-gray-600"
        >
          Déjà un compte ?
          <RouterLink
            to="/login"
            data-testid="login-link"
            class="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Se connecter
          </RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>
