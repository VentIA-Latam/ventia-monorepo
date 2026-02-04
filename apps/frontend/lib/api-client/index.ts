/**
 * Client API Index
 * 
 * Exporta todas las funciones de la capa de Client API
 * para fácil importación en componentes cliente.
 * 
 * Uso:
 * ```tsx
 * import { getOrders, getTenants } from '@/lib/api-client';
 * ```
 */

// Orders
export * from './orders';

// Invoices
export * from './invoices';

// SuperAdmin
export * from './superadmin';

// User
export * from './user';

// Chatwoot
export * from './chatwoot';

// Client helpers
export { ClientApiError } from './client';
export type { ApiError } from './client';
