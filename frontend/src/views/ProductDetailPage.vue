<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import AddToCartToast from '@/components/AddToCartToast.vue'
import LoginPromptModal from '@/components/LoginPromptModal.vue'

const route = useRoute()
const catalogStore = useCatalogStore()
const authStore = useAuthStore()
const cartStore = useCartStore()

const productId = computed<string>(() => route.params.id as string)

/**
 * Watch the product ID from the route and fetch product detail from API.
 * Story 3.4: Fetches from GET /api/products/{id} via the catalog store.
 */
watch(
  productId,
  (id) => {
    if (id) {
      catalogStore.fetchProductDetail(id)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  catalogStore.resetProductDetail()
})

const product = computed(() => catalogStore.productDetail)
const isLoading = computed(() => catalogStore.isProductDetailLoading)

const isInStock = computed<boolean>(() => {
  return (product.value?.stock_quantity ?? 0) > 0
})

const formattedPrice = computed<string>(() => {
  if (!product.value) return '— €'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(product.value.price)
})

const formattedRestockDate = computed<string>(() => {
  if (!product.value?.restock_date) return ''
  const date = new Date(product.value.restock_date + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
})

// ── Story 4.1: Add to cart state ─────────────────────────────────
const showToast = ref(false)
const toastProductName = ref('')
const showLoginPrompt = ref(false)
const isAddingToCart = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** Current product URL for post-login redirect (AC#3) */
const currentProductUrl = computed<string>(() => route.fullPath)

/**
 * Handle "Add to cart" click.
 * AC#1: logged-in buyer → add product to cart, show toast (< 500ms).
 * AC#2: product already in cart → quantity incremented (handled by store).
 * AC#3: not logged in → show login prompt modal.
 */
async function handleAddToCart(): Promise<void> {
  if (!product.value || !isInStock.value) return

  // AC#3: visitor not logged in
  if (!authStore.isAuthenticated) {
    showLoginPrompt.value = true
    return
  }

  // AC#1 & AC#2: logged-in buyer — add to cart via API
  isAddingToCart.value = true

  const success = await cartStore.addItem(
    product.value.id,
    product.value.name,
    product.value.price,
    product.value.photo_url,
  )

  isAddingToCart.value = false

  if (success) {
    // NFR3: visual feedback < 500ms (toast appears after API confirms)
    toastProductName.value = product.value.name
    showToast.value = true

    // Auto-dismiss toast after 3s
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      showToast.value = false
    }, 3000)
  }
}

function closeToast(): void {
  showToast.value = false
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

function closeLoginPrompt(): void {
  showLoginPrompt.value = false
}

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div data-testid="product-detail-page" class="max-w-6xl mx-auto">
    <!-- Breadcrumb -->
    <nav data-testid="product-detail-breadcrumb" class="mb-6">
      <ol class="flex items-center gap-2 text-sm text-gray-500">
        <li>
          <RouterLink
            to="/"
            data-testid="breadcrumb-home-link"
            class="hover:text-indigo-600 transition-colors"
          >
            Accueil
          </RouterLink>
        </li>
        <li>
          <span class="mx-1">/</span>
        </li>
        <li>
          <RouterLink
            to="/catalogue"
            data-testid="breadcrumb-catalogue-link"
            class="hover:text-indigo-600 transition-colors"
          >
            Catalogue
          </RouterLink>
        </li>
        <li>
          <span class="mx-1">/</span>
        </li>
        <li>
          <span data-testid="breadcrumb-current" class="text-gray-900 font-medium">
            {{ product?.name ?? `Produit #${productId}` }}
          </span>
        </li>
      </ol>
    </nav>

    <!-- Loading state -->
    <div v-if="isLoading" class="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
      <p class="text-gray-500">Chargement du produit...</p>
    </div>

    <!-- Product not found -->
    <div
      v-else-if="!product"
      data-testid="product-not-found"
      class="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center"
    >
      <p class="text-6xl mb-4">&#x1F50D;</p>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Produit introuvable</h2>
      <p class="text-gray-500 mb-6">Le produit demandé n'existe pas ou a été retiré.</p>
      <RouterLink
        to="/catalogue"
        data-testid="not-found-catalogue-link"
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
      >
        ← Retour au catalogue
      </RouterLink>
    </div>

    <!-- Product detail content -->
    <div
      v-else
      data-testid="product-detail-content"
      class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <!-- Image area -->
        <div
          data-testid="product-detail-image"
          class="h-80 lg:h-full min-h-80 bg-gray-100 flex items-center justify-center overflow-hidden"
        >
          <img
            v-if="product.photo_url"
            :src="product.photo_url"
            :alt="product.name"
            loading="lazy"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-8xl text-gray-300">&#x1F4F7;</span>
        </div>

        <!-- Product info -->
        <div class="p-8">
          <!-- Name -->
          <h1
            data-testid="product-detail-name"
            class="text-2xl font-bold text-gray-900 mb-2"
          >
            {{ product.name }}
          </h1>

          <!-- Seller -->
          <p
            data-testid="product-detail-seller"
            class="text-sm text-gray-400 mb-4"
          >
            Vendu par
            <span class="font-medium text-gray-600">{{ product.seller_name }}</span>
          </p>

          <!-- Price -->
          <p
            data-testid="product-detail-price"
            class="text-3xl font-bold text-indigo-600 mb-4"
          >
            {{ formattedPrice }}
          </p>

          <!-- Stock status -->
          <div data-testid="product-detail-stock-status" class="mb-6">
            <!-- In stock -->
            <div
              v-if="isInStock"
              data-testid="product-stock-available"
              class="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-1.5"
            >
              <span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>
              <span class="text-sm font-medium text-green-800">
                En stock —
                <span data-testid="product-stock-quantity">{{ product.stock_quantity }}</span>
                unité{{ product.stock_quantity > 1 ? 's' : '' }} disponible{{ product.stock_quantity > 1 ? 's' : '' }}
              </span>
            </div>

            <!-- Out of stock -->
            <div v-else data-testid="product-stock-unavailable" class="space-y-2">
              <div class="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-4 py-1.5">
                <span class="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                <span
                  data-testid="product-out-of-stock-message"
                  class="text-sm font-medium text-red-800"
                >
                  Rupture de stock
                </span>
              </div>
              <p
                v-if="product.restock_date"
                data-testid="product-restock-date"
                class="text-sm text-gray-500 ml-1"
              >
                Retour prévu le {{ formattedRestockDate }}
              </p>
            </div>
          </div>

          <!-- Description -->
          <div class="mb-6">
            <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
              Description
            </h2>
            <p
              data-testid="product-detail-description"
              class="text-gray-600 leading-relaxed"
            >
              {{ product.description }}
            </p>
          </div>

          <!-- Add to cart button (Story 4.1) -->
          <button
            type="button"
            data-testid="add-to-cart-btn"
            :disabled="!isInStock || isAddingToCart"
            class="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
            :class="[
              isInStock && !isAddingToCart
                ? 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500 cursor-pointer active:scale-[0.98]'
                : 'bg-gray-400 cursor-not-allowed',
            ]"
            @click="handleAddToCart"
          >
            <span v-if="isAddingToCart" data-testid="add-to-cart-loading" class="inline-flex items-center gap-2">
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ajout en cours...
            </span>
            <span v-else-if="isInStock" class="inline-flex items-center gap-2">
              <!-- Cart icon -->
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              Ajouter au panier
            </span>
            <span v-else>Indisponible</span>
          </button>

          <!-- Cart error message -->
          <p
            v-if="cartStore.error"
            data-testid="add-to-cart-error"
            class="mt-2 text-sm text-red-600"
          >
            {{ cartStore.error }}
          </p>

          <!-- Back link -->
          <RouterLink
            to="/catalogue"
            data-testid="product-detail-back-link"
            class="mt-4 inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
          >
            ← Retour au catalogue
          </RouterLink>
        </div>
      </div>

      <!-- Technical specs table -->
      <div
        v-if="product.specs && product.specs.length > 0"
        data-testid="product-specs-section"
        class="border-t border-gray-200 px-8 py-6"
      >
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Caractéristiques techniques</h2>
        <table
          data-testid="product-specs-table"
          class="w-full text-sm"
        >
          <tbody>
            <tr
              v-for="(spec, index) in product.specs"
              :key="index"
              :data-testid="`product-spec-row-${index}`"
              class="border-b border-gray-100 last:border-0"
            >
              <td
                :data-testid="`product-spec-key-${index}`"
                class="py-3 pr-4 font-medium text-gray-500 w-1/3"
              >
                {{ spec.key }}
              </td>
              <td
                :data-testid="`product-spec-value-${index}`"
                class="py-3 text-gray-900"
              >
                {{ spec.value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Toast notification (Story 4.1 — AC#1 feedback) -->
    <AddToCartToast
      :visible="showToast"
      :product-name="toastProductName"
      @close="closeToast"
    />

    <!-- Login prompt modal (Story 4.1 — AC#3) -->
    <LoginPromptModal
      :open="showLoginPrompt"
      :redirect-url="currentProductUrl"
      @close="closeLoginPrompt"
    />
  </div>
</template>
