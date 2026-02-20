<script setup lang="ts">
/**
 * LoginPromptModal — Story 4.1, AC#3
 *
 * Shown when a non-authenticated visitor tries to add a product to cart.
 * Invites the user to log in or create an account.
 * The current product URL is saved for post-registration redirect.
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  open: boolean
  redirectUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)

/**
 * Document-level mousedown handler (capturing phase).
 * Detects clicks outside the panel to close the modal.
 * Works with Playwright's force-click because we capture
 * the event at the document level before it reaches any element.
 */
function handleDocumentMouseDown(event: MouseEvent): void {
  if (!panelRef.value) return

  // Check if the click is inside the panel
  if (panelRef.value.contains(event.target as Node)) {
    return // Click is inside panel, don't close
  }

  // Click is outside the panel (on backdrop area) — close
  emit('close')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Use setTimeout to avoid capturing the same click that opened the modal
    setTimeout(() => {
      document.addEventListener('mousedown', handleDocumentMouseDown, true)
    }, 0)
  } else {
    document.removeEventListener('mousedown', handleDocumentMouseDown, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown, true)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      data-testid="login-prompt-modal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        ref="backdropRef"
        data-testid="login-prompt-backdrop"
        class="absolute inset-0 bg-black/40"
      />

      <!-- Modal panel -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="open"
          ref="panelRef"
          data-testid="login-prompt-panel"
          class="relative w-full max-w-md rounded-xl bg-white p-8 shadow-xl"
        >
          <!-- Close button -->
          <button
            type="button"
            data-testid="login-prompt-close-btn"
            class="absolute top-4 right-4 rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Icon -->
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 mb-4">
            <svg
              class="h-7 w-7 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>

          <!-- Title -->
          <h2
            data-testid="login-prompt-title"
            class="text-center text-lg font-semibold text-gray-900 mb-2"
          >
            Connectez-vous pour ajouter au panier
          </h2>

          <!-- Message -->
          <p
            data-testid="login-prompt-message"
            class="text-center text-sm text-gray-500 mb-6"
          >
            Vous devez être connecté pour ajouter des produits à votre panier.
            Connectez-vous ou créez un compte pour continuer.
          </p>

          <!-- Saved redirect info (hidden, for post-login redirect) -->
          <input
            type="hidden"
            data-testid="login-prompt-redirect-url"
            :value="redirectUrl"
          />

          <!-- Actions -->
          <div class="flex flex-col gap-3">
            <RouterLink
              :to="{ name: 'login', query: { redirect: redirectUrl } }"
              data-testid="login-prompt-login-btn"
              class="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              @click="emit('close')"
            >
              Se connecter
            </RouterLink>

            <RouterLink
              :to="{ name: 'register', query: { redirect: redirectUrl } }"
              data-testid="login-prompt-register-btn"
              class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              @click="emit('close')"
            >
              Créer un compte
            </RouterLink>

            <button
              type="button"
              data-testid="login-prompt-cancel-btn"
              class="w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              @click="emit('close')"
            >
              Continuer sans compte
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
