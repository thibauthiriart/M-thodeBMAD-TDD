<script setup lang="ts">
/**
 * ConfirmDialog — Reusable confirmation dialog (modal) component.
 *
 * Usage:
 *   <ConfirmDialog
 *     :open="isDialogOpen"
 *     title="Confirmer la suppression"
 *     message="Êtes-vous sûr de vouloir supprimer ce produit ?"
 *     confirm-label="Supprimer"
 *     cancel-label="Annuler"
 *     variant="danger"
 *     @confirm="onConfirm"
 *     @cancel="onCancel"
 *   />
 */

export interface ConfirmDialogProps {
  /** Controls dialog visibility */
  open: boolean
  /** Dialog title */
  title?: string
  /** Dialog message / description */
  message?: string
  /** Label for the confirm button */
  confirmLabel?: string
  /** Label for the cancel button */
  cancelLabel?: string
  /** Visual variant: 'danger' (red) or 'info' (indigo) */
  variant?: 'danger' | 'info'
}

withDefaults(defineProps<ConfirmDialogProps>(), {
  title: 'Confirmation',
  message: 'Êtes-vous sûr de vouloir continuer ?',
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  variant: 'danger',
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm(): void {
  emit('confirm')
}

function handleCancel(): void {
  emit('cancel')
}
</script>

<template>
  <!-- Backdrop + Dialog -->
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
      data-testid="confirm-dialog-backdrop"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click="handleCancel"
    >
      <!-- Dialog panel -->
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
          data-testid="confirm-dialog"
          class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="title ? 'confirm-dialog-title' : undefined"
          :aria-describedby="message ? 'confirm-dialog-message' : undefined"
        >
          <!-- Icon -->
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full" :class="variant === 'danger' ? 'bg-red-100' : 'bg-indigo-100'">
            <!-- Warning icon (danger) -->
            <svg
              v-if="variant === 'danger'"
              class="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <!-- Info icon -->
            <svg
              v-else
              class="h-6 w-6 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
              />
            </svg>
          </div>

          <!-- Title -->
          <h3
            id="confirm-dialog-title"
            data-testid="confirm-dialog-title"
            class="mt-4 text-center text-lg font-semibold text-gray-900"
          >
            {{ title }}
          </h3>

          <!-- Message -->
          <p
            id="confirm-dialog-message"
            data-testid="confirm-dialog-message"
            class="mt-2 text-center text-sm text-gray-600"
          >
            {{ message }}
          </p>

          <!-- Actions -->
          <div class="mt-6 flex gap-3">
            <button
              type="button"
              data-testid="confirm-dialog-cancel-btn"
              class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              @click.stop="handleCancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              data-testid="confirm-dialog-confirm-btn"
              :class="[
                'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500'
                  : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500',
              ]"
              @click.stop="handleConfirm"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
