import { createRouter, createWebHistory } from 'vue-router'
import type { UserRole } from '@/types/auth'
import '@/types/router'
import { useAuthStore } from '@/stores/auth'
import HomePage from '../views/HomePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ─── Public routes ────────────────────────────────────────────
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/catalogue',
      name: 'catalogue',
      component: () => import('../views/CataloguePage.vue'),
    },
    {
      path: '/categories/:slug',
      name: 'category',
      component: () => import('../views/CategoryPage.vue'),
    },
    {
      path: '/products/:id',
      name: 'product-detail',
      component: () => import('../views/ProductDetailPage.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterPage.vue'),
    },
    {
      path: '/unauthorized',
      name: 'unauthorized',
      component: () => import('../views/UnauthorizedPage.vue'),
    },

    // ─── Auth-protected routes (any authenticated user) ───────────
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfilePage.vue'),
      meta: { requiresAuth: true },
    },

    // ─── Seller routes (role: vendeur) ────────────────────────────
    {
      path: '/seller/dashboard',
      name: 'seller-dashboard',
      component: () => import('../views/SellerDashboardPage.vue'),
      meta: { requiresAuth: true, requiredRole: 'vendeur' as UserRole },
    },
    {
      path: '/seller/products/create',
      name: 'seller-product-create',
      component: () => import('../views/seller/ProductFormPage.vue'),
      meta: { requiresAuth: true, requiredRole: 'vendeur' as UserRole },
    },
    {
      path: '/seller/products/:id/edit',
      name: 'seller-product-edit',
      component: () => import('../views/seller/ProductFormPage.vue'),
      meta: { requiresAuth: true, requiredRole: 'vendeur' as UserRole },
    },

    // ─── Admin routes (role: admin) ───────────────────────────────
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: () => import('../views/AdminDashboardPage.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' as UserRole },
    },
  ],
})

/**
 * Navigation guard:
 * 1. If route requires auth and user is not authenticated → redirect to /login
 * 2. If route requires a specific role and user doesn't have it → redirect to /unauthorized
 *
 * When a token exists but user data has not been hydrated yet,
 * the guard waits for hydration to complete before checking roles.
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true
  }

  const token = localStorage.getItem('token')
  if (!token) {
    return { name: 'login' }
  }

  // Check role-based access
  const requiredRole = to.meta.requiredRole
  if (!requiredRole) {
    return true
  }

  // We need user data to check roles.
  // First try localStorage (fast path — data persisted from previous hydration).
  let userRole: UserRole | undefined
  const userJson = localStorage.getItem('user')
  if (userJson) {
    try {
      const user = JSON.parse(userJson) as { role?: UserRole }
      userRole = user.role
    } catch {
      // Invalid JSON — will try hydration below
    }
  }

  // If we don't have user data yet, wait for the auth store to hydrate.
  // This handles the case where token is set in localStorage but the app
  // hasn't fetched user data from the server yet (e.g. after loginAs in e2e).
  if (!userRole) {
    const authStore = useAuthStore()

    // If hydration hasn't started yet, trigger it
    if (!authStore.user && token) {
      await authStore.hydrate()
    }

    userRole = authStore.user?.role
  }

  // If we still don't have a role, the token is likely invalid
  if (!userRole) {
    return {
      name: 'unauthorized',
      query: { message: 'Impossible de vérifier vos droits d\'accès.' },
    }
  }

  // Check if user's role matches required role(s)
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  if (!allowedRoles.includes(userRole)) {
    return {
      name: 'unauthorized',
      query: { message: 'Vous n\'avez pas les droits pour accéder à cette page.' },
    }
  }

  return true
})

export default router
