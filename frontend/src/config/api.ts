/**
 * Base URL for all API calls.
 *
 * - In development with Vite proxy: defaults to '/api' (relative, proxied by Vite)
 * - In E2E or with VITE_API_URL set: uses the full URL (e.g. 'http://localhost:8080/api')
 */
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api'
