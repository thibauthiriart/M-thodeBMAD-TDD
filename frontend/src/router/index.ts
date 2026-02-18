import { createRouter, createWebHistory } from 'vue-router'
import type { UserRole } from '@/types/auth'
import '@/types/router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ─── Public routes ────────────────────────────────────────────
    {
      path: '/',
      name: 'home',
      component: HomeView,
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
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) {
      next({ name: 'login' })
      return
    }

    // Check role-based access
    const requiredRole = to.meta.requiredRole
    if (requiredRole) {
      // Try to get user data from localStorage (set by auth store)
      const userJson = localStorage.getItem('user')
      if (userJson) {
        try {
          const user = JSON.parse(userJson) as { role?: UserRole }
          const userRole = user.role

          // Check if user's role matches required role(s)
          const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
          if (!userRole || !allowedRoles.includes(userRole)) {
            next({
              name: 'unauthorized',
              query: { message: 'Vous n\'avez pas les droits pour accéder à cette page.' },
            })
            return
          }
        } catch {
          next({
            name: 'unauthorized',
            query: { message: 'Impossible de vérifier vos droits d\'accès.' },
          })
          return
        }
      } else {
        // No user data available yet — redirect to unauthorized
        next({
          name: 'unauthorized',
          query: { message: 'Impossible de vérifier vos droits d\'accès.' },
        })
        return
      }
    }
  }
  next()
})

export default router
