<script setup lang="ts">
import { onMounted } from 'vue'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

// --- Handlers ---
async function handleSubmit(): Promise<void> {
  await profileStore.updateProfile()
}

function handleCancel(): void {
  profileStore.resetForm()
}

// --- Lifecycle ---
onMounted(async () => {
  await profileStore.fetchProfile()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-160px)] items-start justify-center py-12 px-4">
    <div class="w-full max-w-lg space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2
          data-testid="profile-title"
          class="text-3xl font-bold tracking-tight text-gray-900"
        >
          Mon profil
        </h2>
        <p
          data-testid="profile-subtitle"
          class="mt-2 text-sm text-gray-600"
        >
          Consultez et modifiez vos informations personnelles
        </p>
      </div>

      <!-- Loading state -->
      <div v-if="profileStore.isLoading" class="flex justify-center py-12">
        <svg class="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <template v-if="profileStore.profile && !profileStore.isLoading">
      <!-- Success toast -->
      <Transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="profileStore.successMessage"
          data-testid="profile-success-message"
          class="rounded-md bg-green-50 p-4"
        >
          <div class="flex">
            <svg
              class="h-5 w-5 text-green-400 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                clip-rule="evenodd"
              />
            </svg>
            <p class="text-sm font-medium text-green-700">
              {{ profileStore.successMessage }}
            </p>
          </div>
        </div>
      </Transition>

      <!-- Form card -->
      <form
        data-testid="profile-form"
        class="space-y-6 bg-white p-8 rounded-xl shadow-md"
        @submit.prevent="handleSubmit"
      >
        <!-- General error -->
        <div
          v-if="profileStore.generalError"
          data-testid="profile-error-message"
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
            <p class="text-sm text-red-700">{{ profileStore.generalError }}</p>
          </div>
        </div>

        <!-- Email (readonly) -->
        <div>
          <label for="profile-email" class="block text-sm font-medium text-gray-700">
            Adresse email
          </label>
          <div class="relative mt-1">
            <input
              id="profile-email"
              data-testid="profile-email-input"
              type="email"
              :value="profileStore.profile?.email ?? ''"
              disabled
              class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm sm:text-sm cursor-not-allowed"
            />
            <span
              data-testid="profile-email-readonly-badge"
              class="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
            >
              Non modifiable
            </span>
          </div>
        </div>

        <!-- Role (readonly) -->
        <div>
          <label for="profile-role" class="block text-sm font-medium text-gray-700">
            Rôle
          </label>
          <div class="relative mt-1">
            <input
              id="profile-role"
              data-testid="profile-role-input"
              type="text"
              :value="profileStore.roleLabel"
              disabled
              class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm sm:text-sm cursor-not-allowed"
            />
            <span
              data-testid="profile-role-readonly-badge"
              class="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
            >
              Non modifiable
            </span>
          </div>
        </div>

        <!-- Separator -->
        <div class="border-t border-gray-200 pt-2">
          <p class="text-xs text-gray-400">Informations modifiables</p>
        </div>

        <!-- Name (editable) -->
        <div>
          <label for="profile-name" class="block text-sm font-medium text-gray-700">
            Nom complet
          </label>
          <input
            id="profile-name"
            v-model="profileStore.formName"
            data-testid="profile-name-input"
            type="text"
            autocomplete="name"
            placeholder="Votre nom complet"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            data-testid="profile-cancel-btn"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleCancel"
          >
            Annuler
          </button>
          <button
            type="submit"
            data-testid="profile-save-btn"
            :disabled="profileStore.isSaving"
            class="flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              v-if="profileStore.isSaving"
              data-testid="profile-loading-spinner"
              class="mr-2 h-4 w-4 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ profileStore.isSaving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
          </button>
        </div>
      </form>
      </template>
    </div>
  </div>
</template>
