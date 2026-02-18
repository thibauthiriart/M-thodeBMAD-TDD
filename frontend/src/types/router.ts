import 'vue-router'
import type { UserRole } from './auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Route requires authenticated user */
    requiresAuth?: boolean
    /** Route requires specific role(s) */
    requiredRole?: UserRole | UserRole[]
  }
}
