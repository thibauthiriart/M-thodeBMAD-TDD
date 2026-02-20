<script setup lang="ts">
/**
 * AddToCartToast — Story 4.1
 *
 * Toast notification shown when a product is successfully added to the cart.
 * NFR3: feedback visual < 500ms.
 * Auto-dismisses after 3 seconds.
 */

defineProps<{
  visible: boolean
  productName: string
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="visible"
      data-testid="add-to-cart-toast"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-green-600 px-5 py-3 text-white shadow-lg"
      role="alert"
    >
      <!-- Check icon -->
      <svg
        class="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>

      <p data-testid="add-to-cart-toast-message" class="text-sm font-medium">
        <span class="font-semibold">{{ productName }}</span> ajouté au panier
      </p>

      <button
        type="button"
        data-testid="add-to-cart-toast-close-btn"
        class="ml-2 rounded-md p-1 hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        @click="$emit('close')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>
