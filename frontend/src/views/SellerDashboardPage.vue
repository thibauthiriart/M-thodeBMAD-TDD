<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSellerProductStore } from '@/stores/sellerProduct'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const sellerProductStore = useSellerProductStore()

// --- Toggle feedback message ---
const toggleFeedbackMessage = ref<string | null>(null)
const toggleFeedbackType = ref<'activated' | 'deactivated'>('activated')
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null

// --- Delete confirmation state ---
const showDeleteDialog = ref(false)
const productToDelete = ref<{ id: number; name: string } | null>(null)
const deleteFeedbackMessage = ref<string | null>(null)
let deleteFeedbackTimeout: ReturnType<typeof setTimeout> | null = null

// --- Computed from store ---
const products = computed(() => sellerProductStore.products)
const isLoading = computed(() => sellerProductStore.isLoading)
const hasProducts = computed(() => products.value.length > 0)

// --- Stats derived from products ---
const stats = computed(() => ({
  totalProducts: products.value.length,
  activeProducts: products.value.filter((p) => p.is_active).length,
  inactiveProducts: products.value.filter((p) => !p.is_active).length,
}))

// --- Load products on mount ---
onMounted(async () => {
  await sellerProductStore.fetchProducts()
})

// --- Handlers ---
function handleAddProduct(): void {
  router.push('/seller/products/create')
}

function handleEditProduct(productId: number): void {
  router.push({ name: 'seller-product-edit', params: { id: productId } })
}

/**
 * Opens the delete confirmation dialog for the given product.
 */
function handleDeleteProduct(productId: number): void {
  const product = products.value.find((p) => p.id === productId)
  if (!product) return

  productToDelete.value = { id: product.id, name: product.name }
  showDeleteDialog.value = true
}

/**
 * Confirms product deletion — calls the API via the store, then updates UI.
 */
async function confirmDelete(): Promise<void> {
  if (!productToDelete.value) return

  const deletedName = productToDelete.value.name
  const deletedId = productToDelete.value.id

  // Call API via the store (removes from local list on success)
  const success = await sellerProductStore.deleteProduct(deletedId)

  // Close dialog
  showDeleteDialog.value = false
  productToDelete.value = null

  if (success) {
    // Show delete success feedback
    deleteFeedbackMessage.value = `« ${deletedName} » a été supprimé définitivement.`
    if (deleteFeedbackTimeout) clearTimeout(deleteFeedbackTimeout)
    deleteFeedbackTimeout = setTimeout(() => {
      deleteFeedbackMessage.value = null
    }, 3000)
  }
}

/**
 * Cancels product deletion — closes dialog without action.
 */
function cancelDelete(): void {
  showDeleteDialog.value = false
  productToDelete.value = null
  console.log('[SellerDashboard] Delete cancelled')
}

function dismissDeleteFeedback(): void {
  deleteFeedbackMessage.value = null
  if (deleteFeedbackTimeout) clearTimeout(deleteFeedbackTimeout)
}

/**
 * Toggle product active/inactive status via API (optimistic UI update).
 * The store handles optimistic flip + revert on failure.
 * Shows feedback toast after toggle.
 */
async function handleToggleStatus(productId: number): Promise<void> {
  // Find the product to get its name before toggling
  const product = products.value.find((p) => p.id === productId)
  if (!product) return

  const productName = product.name

  // Store handles optimistic update + API call
  const success = await sellerProductStore.toggleProductStatus(productId)

  if (success) {
    // Read the new state after toggle
    const updatedProduct = products.value.find((p) => p.id === productId)
    const isNowActive = updatedProduct?.is_active ?? false

    // Show feedback toast
    toggleFeedbackType.value = isNowActive ? 'activated' : 'deactivated'
    toggleFeedbackMessage.value = isNowActive
      ? `« ${productName} » est maintenant actif et visible dans le catalogue.`
      : `« ${productName} » est maintenant inactif et masqué du catalogue.`

    // Auto-dismiss after 3 seconds
    if (feedbackTimeout) clearTimeout(feedbackTimeout)
    feedbackTimeout = setTimeout(() => {
      toggleFeedbackMessage.value = null
    }, 3000)
  }
}

function dismissFeedback(): void {
  toggleFeedbackMessage.value = null
  if (feedbackTimeout) clearTimeout(feedbackTimeout)
}

// --- Formatting helpers ---
function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',')
}
</script>

<template>
  <div class="space-y-8">
    <!-- ──────────────── Toggle feedback toast ──────────────── -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-[-1rem] opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-[-1rem] opacity-0"
    >
      <div
        v-if="toggleFeedbackMessage"
        data-testid="toggle-status-feedback"
        :class="[
          'flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-sm',
          toggleFeedbackType === 'activated'
            ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
            : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        ]"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <!-- Activated icon -->
          <svg
            v-if="toggleFeedbackType === 'activated'"
            class="h-5 w-5 flex-shrink-0 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <!-- Deactivated icon -->
          <svg
            v-else
            class="h-5 w-5 flex-shrink-0 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span data-testid="toggle-status-feedback-message">{{ toggleFeedbackMessage }}</span>
        </div>
        <button
          type="button"
          data-testid="toggle-status-feedback-dismiss-btn"
          class="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/5"
          @click="dismissFeedback"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ──────────────── Delete feedback toast ──────────────── -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-[-1rem] opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-[-1rem] opacity-0"
    >
      <div
        v-if="deleteFeedbackMessage"
        data-testid="delete-feedback"
        class="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm ring-1 ring-red-200"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <svg
            class="h-5 w-5 flex-shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          <span data-testid="delete-feedback-message">{{ deleteFeedbackMessage }}</span>
        </div>
        <button
          type="button"
          data-testid="delete-feedback-dismiss-btn"
          class="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/5"
          @click="dismissDeleteFeedback"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ──────────────── Header ──────────────── -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2
          data-testid="seller-dashboard-title"
          class="text-3xl font-bold tracking-tight text-gray-900"
        >
          Tableau de bord vendeur
        </h2>
        <p
          data-testid="seller-dashboard-subtitle"
          class="mt-1 text-sm text-gray-600"
        >
          Bienvenue{{ authStore.user?.name ? `, ${authStore.user.name}` : '' }}. Gérez vos produits et suivez vos ventes.
        </p>
      </div>
      <button
        v-if="hasProducts"
        type="button"
        data-testid="seller-add-product-btn"
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        @click="handleAddProduct"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter un produit
      </button>
    </div>

    <!-- ──────────────── Stats cards ──────────────── -->
    <div
      v-if="hasProducts"
      data-testid="seller-stats"
      class="grid grid-cols-1 gap-5 sm:grid-cols-3"
    >
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Total produits</dt>
        <dd
          data-testid="seller-stat-total-products"
          class="mt-1 text-3xl font-semibold tracking-tight text-gray-900"
        >
          {{ stats.totalProducts }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Produits actifs</dt>
        <dd
          data-testid="seller-stat-active-products"
          class="mt-1 text-3xl font-semibold tracking-tight text-green-600"
        >
          {{ stats.activeProducts }}
        </dd>
      </div>
      <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
        <dt class="truncate text-sm font-medium text-gray-500">Produits inactifs</dt>
        <dd
          data-testid="seller-stat-inactive-products"
          class="mt-1 text-3xl font-semibold tracking-tight text-red-600"
        >
          {{ stats.inactiveProducts }}
        </dd>
      </div>
    </div>

    <!-- ──────────────── Empty state ──────────────── -->
    <div
      v-if="!isLoading && !hasProducts"
      data-testid="seller-empty-state"
      class="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center"
    >
      <!-- Empty illustration -->
      <svg
        class="mx-auto h-16 w-16 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
        />
      </svg>

      <h3
        data-testid="seller-empty-state-title"
        class="mt-4 text-lg font-semibold text-gray-900"
      >
        Aucun produit pour le moment
      </h3>
      <p
        data-testid="seller-empty-state-description"
        class="mt-2 text-sm text-gray-500"
      >
        Commencez par ajouter votre premier produit pour le rendre visible aux acheteurs.
      </p>
      <button
        type="button"
        data-testid="seller-empty-state-add-btn"
        class="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        @click="handleAddProduct"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter mon premier produit
      </button>
    </div>

    <!-- ──────────────── Products table ──────────────── -->
    <div
      v-if="hasProducts"
      class="overflow-hidden rounded-lg bg-white shadow"
    >
      <div class="flex items-center justify-between border-b border-gray-200 px-4 py-5 sm:px-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900">Mes produits</h3>
        <span
          data-testid="seller-products-count"
          class="text-sm text-gray-500"
        >
          {{ products.length }} produit{{ products.length > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Desktop table (hidden on mobile) -->
      <div class="hidden sm:block">
        <table
          data-testid="seller-products-table"
          class="min-w-full divide-y divide-gray-200"
        >
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Photo</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nom</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Prix</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
              <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr
              v-for="product in products"
              :key="product.id"
              :data-testid="`seller-product-row-${product.id}`"
            >
              <!-- Photo thumbnail -->
              <td class="whitespace-nowrap px-6 py-4">
                <img
                  v-if="product.photo_url"
                  :src="product.photo_url"
                  :alt="`Photo de ${product.name}`"
                  :data-testid="`seller-product-photo-${product.id}`"
                  class="h-10 w-10 rounded-md object-cover"
                />
                <div
                  v-else
                  :data-testid="`seller-product-photo-placeholder-${product.id}`"
                  class="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-400"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
              </td>

              <!-- Name -->
              <td
                :data-testid="`seller-product-name-${product.id}`"
                class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900"
              >
                {{ product.name }}
              </td>

              <!-- Price -->
              <td
                :data-testid="`seller-product-price-${product.id}`"
                class="whitespace-nowrap px-6 py-4 text-sm text-gray-500"
              >
                {{ formatPrice(product.price) }}&nbsp;&euro;
              </td>

              <!-- Stock -->
              <td
                :data-testid="`seller-product-stock-${product.id}`"
                class="whitespace-nowrap px-6 py-4 text-sm"
                :class="product.stock_quantity === 0 ? 'font-semibold text-red-600' : 'text-gray-500'"
              >
                {{ product.stock_quantity }}
                <span v-if="product.stock_quantity === 0" class="ml-1 text-xs">(rupture)</span>
              </td>

              <!-- Status badge (active / inactive) -->
              <td class="whitespace-nowrap px-6 py-4 text-sm">
                <span
                  :data-testid="`seller-product-status-${product.id}`"
                  :class="[
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5',
                    product.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800',
                  ]"
                >
                  {{ product.is_active ? 'Actif' : 'Inactif' }}
                </span>
              </td>

              <!-- Actions -->
              <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <button
                  type="button"
                  :data-testid="`seller-toggle-status-btn-${product.id}`"
                  :class="[
                    'mr-3 transition-colors',
                    product.is_active
                      ? 'text-amber-600 hover:text-amber-900'
                      : 'text-green-600 hover:text-green-900',
                  ]"
                  :title="product.is_active ? 'Désactiver ce produit' : 'Activer ce produit'"
                  @click="handleToggleStatus(product.id)"
                >
                  {{ product.is_active ? 'Désactiver' : 'Activer' }}
                </button>
                <button
                  type="button"
                  :data-testid="`seller-edit-product-btn-${product.id}`"
                  class="mr-3 text-indigo-600 transition-colors hover:text-indigo-900"
                  @click="handleEditProduct(product.id)"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  :data-testid="`seller-delete-product-btn-${product.id}`"
                  class="text-red-600 transition-colors hover:text-red-900"
                  @click="handleDeleteProduct(product.id)"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards (visible on small screens) -->
      <div
        data-testid="seller-products-cards"
        class="divide-y divide-gray-200 sm:hidden"
      >
        <div
          v-for="product in products"
          :key="product.id"
          :data-testid="`seller-product-card-${product.id}`"
          class="flex items-start gap-4 px-4 py-4"
        >
          <!-- Photo thumbnail -->
          <img
            v-if="product.photo_url"
            :src="product.photo_url"
            :alt="`Photo de ${product.name}`"
            class="h-14 w-14 flex-shrink-0 rounded-md object-cover"
          />
          <div
            v-else
            class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-400"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>

          <!-- Content -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <p class="truncate text-sm font-medium text-gray-900">{{ product.name }}</p>
              <span
                :data-testid="`seller-product-card-status-${product.id}`"
                :class="[
                  'ml-2 inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                  product.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800',
                ]"
              >
                {{ product.is_active ? 'Actif' : 'Inactif' }}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-500">
              {{ formatPrice(product.price) }}&nbsp;&euro; &middot; Stock : {{ product.stock_quantity }}
            </p>
            <div class="mt-2 flex gap-3">
              <button
                type="button"
                :data-testid="`seller-card-toggle-status-btn-${product.id}`"
                :class="[
                  'text-xs transition-colors',
                  product.is_active
                    ? 'text-amber-600 hover:text-amber-900'
                    : 'text-green-600 hover:text-green-900',
                ]"
                @click="handleToggleStatus(product.id)"
              >
                {{ product.is_active ? 'Désactiver' : 'Activer' }}
              </button>
              <button
                type="button"
                :data-testid="`seller-card-edit-product-btn-${product.id}`"
                class="text-xs text-indigo-600 hover:text-indigo-900"
                @click="handleEditProduct(product.id)"
              >
                Modifier
              </button>
              <button
                type="button"
                :data-testid="`seller-card-delete-product-btn-${product.id}`"
                class="text-xs text-red-600 hover:text-red-900"
                @click="handleDeleteProduct(product.id)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ──────────────── Delete confirmation dialog ──────────────── -->
    <ConfirmDialog
      :open="showDeleteDialog"
      title="Supprimer le produit"
      :message="`Êtes-vous sûr de vouloir supprimer « ${productToDelete?.name ?? ''} » ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      cancel-label="Annuler"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
