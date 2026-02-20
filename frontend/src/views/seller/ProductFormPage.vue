<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type {
  ProductForm,
  ProductFormErrors,
} from '@/types/product'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from '@/types/product'
import { useSellerProductStore } from '@/stores/sellerProduct'

const router = useRouter()
const route = useRoute()
const sellerProductStore = useSellerProductStore()

// ── Edit mode detection ─────────────────────────────────────────────────
const isEditMode = computed(() => route.name === 'seller-product-edit')
const productId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

// ── Loading state for fetching product data in edit mode ────────────────
const isLoadingProduct = ref(false)
const loadError = ref<string | null>(null)

// ── Existing photo URL (edit mode — shown when no new photo is selected) ─
const existingPhotoUrl = ref<string | null>(null)

// ── Form state ──────────────────────────────────────────────────────────
const form = ref<ProductForm>({
  name: '',
  description: '',
  specs: [{ key: '', value: '' }],
  price: '',
  stock_quantity: '',
  category: '',
  photo: null,
})

const photoPreview = ref<string | null>(null)
const isSubmitting = ref(false)
const successMessage = ref('')
const serverErrors = ref<ProductFormErrors>({})

// ── Load product data for edit mode on mount ────────────────────────────
onMounted(() => {
  if (isEditMode.value && productId.value) {
    loadProductForEdit(productId.value)
  }
})

async function loadProductForEdit(id: number): Promise<void> {
  isLoadingProduct.value = true
  loadError.value = null

  const product = await sellerProductStore.fetchProduct(id)

  if (!product) {
    loadError.value = sellerProductStore.fetchProductError || 'Produit introuvable ou vous n\'avez pas les droits pour le modifier.'
    isLoadingProduct.value = false
    return
  }

  // Pre-fill form with product data
  const specs = product.specs && product.specs.length > 0
    ? product.specs.map((s) => ({ key: s.key, value: s.value }))
    : [{ key: '', value: '' }]

  form.value = {
    name: product.name,
    description: product.description,
    specs,
    price: String(product.price),
    stock_quantity: String(product.stock_quantity),
    category: product.category,
    photo: null, // Photo is optional on update
  }

  existingPhotoUrl.value = product.photo_url

  isLoadingProduct.value = false
}

// ── Client-side validation ──────────────────────────────────────────────
const clientErrors = computed<ProductFormErrors>(() => {
  const errors: ProductFormErrors = {}

  if (submitted.value) {
    if (!form.value.name.trim()) {
      errors.name = ['Le nom du produit est requis.']
    }

    if (!form.value.description.trim()) {
      errors.description = ['La description est requise.']
    }

    if (!form.value.category) {
      errors.category = ['Veuillez sélectionner une catégorie.']
    }

    if (form.value.price === '' || form.value.price === null || form.value.price === undefined) {
      errors.price = ['Le prix est requis.']
    } else if (Number(form.value.price) <= 0) {
      errors.price = ['Le prix doit être supérieur à 0.']
    }

    if (form.value.stock_quantity === '') {
      errors.stock_quantity = ['La quantité en stock est requise.']
    } else if (Number(form.value.stock_quantity) < 0) {
      errors.stock_quantity = ['La quantité doit être supérieure ou égale à 0.']
    }

    // Photo is required only in create mode
    if (!isEditMode.value && !form.value.photo) {
      errors.photo = ['Une photo du produit est requise.']
    }
  }

  return errors
})

const submitted = ref(false)

function getFieldErrors(field: string): string[] {
  return serverErrors.value[field] || clientErrors.value[field] || []
}

const hasErrors = computed(() => {
  return Object.keys(clientErrors.value).length > 0 || Object.keys(serverErrors.value).length > 0
})

// ── Photo handling ──────────────────────────────────────────────────────
function handlePhotoChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  form.value.photo = file

  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      photoPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  } else {
    photoPreview.value = null
  }
}

function removePhoto(): void {
  form.value.photo = null
  photoPreview.value = null
  // In edit mode, also remove the existing photo reference
  if (isEditMode.value) {
    existingPhotoUrl.value = null
  }
}

// ── Specs key/value management ──────────────────────────────────────────
function addSpec(): void {
  form.value.specs.push({ key: '', value: '' })
}

function removeSpec(index: number): void {
  if (form.value.specs.length > 1) {
    form.value.specs.splice(index, 1)
  }
}

// ── Submit handler ──────────────────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  submitted.value = true
  serverErrors.value = {}
  successMessage.value = ''

  if (hasErrors.value) {
    return
  }

  isSubmitting.value = true

  if (isEditMode.value && productId.value) {
    // Edit mode: update product via API
    const result = await sellerProductStore.updateProduct(productId.value, {
      name: form.value.name,
      description: form.value.description,
      category: form.value.category,
      price: String(form.value.price),
      stock_quantity: String(form.value.stock_quantity),
      specs: form.value.specs,
      photo: form.value.photo,
    })

    if (result) {
      successMessage.value = 'Produit mis à jour avec succès !'
      isSubmitting.value = false

      setTimeout(() => {
        router.push('/seller/dashboard')
      }, 1500)
    } else {
      isSubmitting.value = false
      if (Object.keys(sellerProductStore.updateServerErrors).length > 0) {
        serverErrors.value = { ...sellerProductStore.updateServerErrors }
      }
    }
  } else {
    // Create mode: use store
    const result = await sellerProductStore.createProduct({
      name: form.value.name,
      description: form.value.description,
      category: form.value.category,
      price: String(form.value.price),
      stock_quantity: String(form.value.stock_quantity),
      specs: form.value.specs,
      photo: form.value.photo!,
    })

    if (result) {
      successMessage.value = 'Produit créé avec succès !'
      isSubmitting.value = false

      setTimeout(() => {
        router.push('/seller/dashboard')
      }, 1500)
    } else {
      isSubmitting.value = false
      if (Object.keys(sellerProductStore.createServerErrors).length > 0) {
        serverErrors.value = { ...sellerProductStore.createServerErrors }
      }
    }
  }
}

function handleCancel(): void {
  router.push('/seller/dashboard')
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <!-- ──────────────── Header ──────────────── -->
    <div class="mb-8">
      <h2
        data-testid="product-form-title"
        class="text-3xl font-bold tracking-tight text-gray-900"
      >
        {{ isEditMode ? 'Modifier le produit' : 'Ajouter un produit' }}
      </h2>
      <p
        data-testid="product-form-subtitle"
        class="mt-1 text-sm text-gray-600"
      >
        {{
          isEditMode
            ? 'Modifiez les informations de votre produit. La photo est optionnelle si vous souhaitez conserver l\'actuelle.'
            : 'Remplissez les informations de votre produit pour le rendre visible aux acheteurs.'
        }}
      </p>
    </div>

    <!-- ──────────────── Loading state (edit mode) ──────────────── -->
    <div
      v-if="isLoadingProduct"
      data-testid="product-form-loading"
      class="flex items-center justify-center py-16"
    >
      <div class="text-center">
        <svg
          class="mx-auto h-10 w-10 animate-spin text-indigo-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="mt-4 text-sm text-gray-600">Chargement du produit...</p>
      </div>
    </div>

    <!-- ──────────────── Load error (edit mode) ──────────────── -->
    <div
      v-if="loadError"
      data-testid="product-form-load-error"
      class="rounded-md bg-red-50 p-4"
    >
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800">{{ loadError }}</p>
          <button
            type="button"
            data-testid="product-form-back-btn"
            class="mt-2 text-sm font-medium text-red-600 underline hover:text-red-500"
            @click="handleCancel"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    </div>

    <!-- ──────────────── Success message ──────────────── -->
    <div
      v-if="successMessage"
      data-testid="product-form-success-message"
      class="mb-6 rounded-md bg-green-50 p-4"
    >
      <div class="flex">
        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" />
        </svg>
        <p class="ml-3 text-sm font-medium text-green-800">{{ successMessage }}</p>
      </div>
    </div>

    <!-- ──────────────── General error ──────────────── -->
    <div
      v-if="submitted && hasErrors"
      data-testid="product-form-general-error"
      class="mb-6 rounded-md bg-red-50 p-4"
    >
      <p class="text-sm text-red-700">
        Veuillez corriger les erreurs ci-dessous avant de soumettre le formulaire.
      </p>
    </div>

    <!-- ──────────────── Form ──────────────── -->
    <form
      v-if="!isLoadingProduct && !loadError"
      data-testid="product-form"
      class="space-y-6 rounded-xl bg-white p-8 shadow-md"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <!-- ── Photo upload ── -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Photo du produit
          <span v-if="!isEditMode" class="text-red-500">*</span>
          <span v-else class="text-xs font-normal text-gray-500 ml-1">(optionnelle — conserve la photo actuelle si non modifiée)</span>
        </label>

        <!-- Existing photo display (edit mode, no new photo selected) -->
        <div
          v-if="isEditMode && existingPhotoUrl && !photoPreview && !form.photo"
          data-testid="photo-existing"
          class="relative inline-block"
        >
          <img
            :src="existingPhotoUrl"
            alt="Photo actuelle du produit"
            data-testid="photo-existing-img"
            class="h-40 w-40 rounded-lg object-cover shadow-sm"
          />
          <div class="mt-2 flex items-center gap-2">
            <label
              for="photo-input-replace"
              data-testid="photo-replace-btn"
              class="cursor-pointer rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
            >
              Remplacer
              <input
                id="photo-input-replace"
                type="file"
                accept="image/*"
                class="sr-only"
                @change="handlePhotoChange"
              />
            </label>
            <button
              type="button"
              data-testid="photo-remove-existing-btn"
              class="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              @click="removePhoto"
            >
              Supprimer
            </button>
          </div>
        </div>

        <!-- Upload zone (create mode, or edit mode with no photo at all) -->
        <div
          v-if="!photoPreview && !(isEditMode && existingPhotoUrl)"
          data-testid="photo-upload-zone"
          class="flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 transition-colors hover:border-indigo-400"
        >
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            <div class="mt-4 flex text-sm text-gray-600">
              <label
                for="photo-input"
                class="relative cursor-pointer rounded-md font-semibold text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2"
              >
                <span>Choisir une image</span>
                <input
                  id="photo-input"
                  data-testid="photo-input"
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  @change="handlePhotoChange"
                />
              </label>
              <p class="pl-1">ou glisser-déposer</p>
            </div>
            <p class="text-xs text-gray-500 mt-1">PNG, JPG, WEBP. Max 2 Mo.</p>
          </div>
        </div>

        <!-- New photo preview (both modes) -->
        <div
          v-if="photoPreview"
          data-testid="photo-preview"
          class="relative inline-block"
        >
          <img
            :src="photoPreview"
            alt="Aperçu photo produit"
            data-testid="photo-preview-img"
            class="h-40 w-40 rounded-lg object-cover shadow-sm"
          />
          <button
            type="button"
            data-testid="photo-remove-btn"
            class="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow-sm transition-colors hover:bg-red-600"
            @click="removePhoto"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p
          v-if="getFieldErrors('photo').length"
          data-testid="photo-error"
          class="mt-1 text-sm text-red-600"
        >
          {{ getFieldErrors('photo')[0] }}
        </p>
      </div>

      <!-- ── Name ── -->
      <div>
        <label for="product-name" class="block text-sm font-medium text-gray-700">
          Nom du produit <span class="text-red-500">*</span>
        </label>
        <input
          id="product-name"
          v-model="form.name"
          data-testid="product-name-input"
          type="text"
          placeholder="Ex: AMD Ryzen 9 7950X"
          class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('name').length }"
        />
        <p
          v-if="getFieldErrors('name').length"
          data-testid="product-name-error"
          class="mt-1 text-sm text-red-600"
        >
          {{ getFieldErrors('name')[0] }}
        </p>
      </div>

      <!-- ── Description ── -->
      <div>
        <label for="product-description" class="block text-sm font-medium text-gray-700">
          Description <span class="text-red-500">*</span>
        </label>
        <textarea
          id="product-description"
          v-model="form.description"
          data-testid="product-description-input"
          rows="4"
          placeholder="Décrivez votre produit en détail..."
          class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('description').length }"
        />
        <p
          v-if="getFieldErrors('description').length"
          data-testid="product-description-error"
          class="mt-1 text-sm text-red-600"
        >
          {{ getFieldErrors('description')[0] }}
        </p>
      </div>

      <!-- ── Category ── -->
      <div>
        <label for="product-category" class="block text-sm font-medium text-gray-700">
          Catégorie <span class="text-red-500">*</span>
        </label>
        <select
          id="product-category"
          v-model="form.category"
          data-testid="product-category-select"
          class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('category').length }"
        >
          <option value="" disabled>Sélectionner une catégorie</option>
          <option
            v-for="cat in PRODUCT_CATEGORIES"
            :key="cat"
            :value="cat"
            :data-testid="`product-category-option-${cat}`"
          >
            {{ PRODUCT_CATEGORY_LABELS[cat] }}
          </option>
        </select>
        <p
          v-if="getFieldErrors('category').length"
          data-testid="product-category-error"
          class="mt-1 text-sm text-red-600"
        >
          {{ getFieldErrors('category')[0] }}
        </p>
      </div>

      <!-- ── Price & Stock (side by side) ── -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <!-- Price -->
        <div>
          <label for="product-price" class="block text-sm font-medium text-gray-700">
            Prix (€) <span class="text-red-500">*</span>
          </label>
          <div class="relative mt-1">
            <input
              id="product-price"
              v-model="form.price"
              data-testid="product-price-input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('price').length }"
            />
            <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">€</span>
          </div>
          <p
            v-if="getFieldErrors('price').length"
            data-testid="product-price-error"
            class="mt-1 text-sm text-red-600"
          >
            {{ getFieldErrors('price')[0] }}
          </p>
        </div>

        <!-- Stock quantity -->
        <div>
          <label for="product-stock" class="block text-sm font-medium text-gray-700">
            Quantité en stock <span class="text-red-500">*</span>
          </label>
          <input
            id="product-stock"
            v-model="form.stock_quantity"
            data-testid="product-stock-input"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500': getFieldErrors('stock_quantity').length }"
          />
          <p
            v-if="getFieldErrors('stock_quantity').length"
            data-testid="product-stock-error"
            class="mt-1 text-sm text-red-600"
          >
            {{ getFieldErrors('stock_quantity')[0] }}
          </p>
        </div>
      </div>

      <!-- ── Technical Specs (key/value pairs) ── -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">
            Caractéristiques techniques
          </label>
          <button
            type="button"
            data-testid="spec-add-btn"
            class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
            @click="addSpec"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="(spec, index) in form.specs"
            :key="index"
            :data-testid="`spec-row-${index}`"
            class="flex items-start gap-3"
          >
            <input
              v-model="spec.key"
              :data-testid="`spec-key-input-${index}`"
              type="text"
              placeholder="Ex: Fréquence"
              class="block w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            />
            <input
              v-model="spec.value"
              :data-testid="`spec-value-input-${index}`"
              type="text"
              placeholder="Ex: 4.5 GHz"
              class="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            />
            <button
              type="button"
              :data-testid="`spec-remove-btn-${index}`"
              :disabled="form.specs.length <= 1"
              class="rounded-lg border border-gray-300 p-2 text-gray-400 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              @click="removeSpec(index)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Ajoutez les caractéristiques clés de votre produit (optionnel).
        </p>
      </div>

      <!-- ── Form actions ── -->
      <div class="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          data-testid="product-cancel-btn"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          @click="handleCancel"
        >
          Annuler
        </button>
        <button
          type="submit"
          data-testid="product-submit-btn"
          :disabled="isSubmitting"
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            v-if="isSubmitting"
            data-testid="product-submit-spinner"
            class="h-4 w-4 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{
            isSubmitting
              ? (isEditMode ? 'Mise à jour en cours...' : 'Création en cours...')
              : (isEditMode ? 'Enregistrer les modifications' : 'Créer le produit')
          }}
        </button>
      </div>
    </form>
  </div>
</template>
