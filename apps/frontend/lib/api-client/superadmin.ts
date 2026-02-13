/**
 * SuperAdmin Client API
 * 
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * 
 * Este módulo proporciona funciones para interactuar con la API de superadmin
 * desde componentes cliente. Todas las funciones llaman a /api/superadmin/* routes.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Tenant, TenantDetail } from '@/lib/types/tenant';
import type { User } from '@/lib/types/user';
import type { APIKey } from '@/lib/types/api-key';
import type { InvoiceListResponse } from '@/lib/types/invoice';
import type { Order, OrderListResponse } from '@/lib/services/order-service';

export interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  total_users?: number;
  total_orders?: number;
  last_activity?: string;
}

export interface GlobalOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total: number;
  currency: string;
  validado: boolean;
  tenant_id: number;
  tenant?: Tenant;
  created_at: string;
  updated_at: string;
}

export interface SuperAdminStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_orders: number;
  total_revenue: number;
  active_api_keys?: number;
  total_super_admins?: number;
}

export interface RecentActivity {
  id: string;
  type?: 'order' | 'user' | 'tenant';
  entity_type: string;
  operation: string;
  description: string;
  timestamp: string;
  tenant_name?: string;
}

// ==================== TENANTS ====================

/**
 * Obtener todos los tenants
 * GET /api/superadmin/tenants
 */
export async function getTenants(params?: {
  skip?: number;
  limit?: number;
}): Promise<{ items: Tenant[]; total: number }> {
  return apiGet('/api/superadmin/tenants', params as Record<string, number>);
}

/**
 * Obtener un tenant por ID
 * GET /api/superadmin/tenants/:id
 */
export async function getTenant(tenantId: number): Promise<TenantDetail> {
  return apiGet(`/api/superadmin/tenants/${tenantId}`);
}

/**
 * Crear un nuevo tenant
 * POST /api/superadmin/tenants
 */
export async function createTenant(data: Partial<Tenant>): Promise<Tenant> {
  return apiPost('/api/superadmin/tenants', data);
}

/**
 * Actualizar un tenant
 * PATCH /api/superadmin/tenants/:id
 */
export async function updateTenant(
  tenantId: number,
  data: Partial<Tenant>
): Promise<Tenant> {
  return apiPatch(`/api/superadmin/tenants/${tenantId}`, data);
}

/**
 * Toggle tenant status (activar/desactivar)
 * PATCH /api/superadmin/tenants/:id
 */
export async function toggleTenantStatus(
  tenantId: number,
  isActive: boolean
): Promise<Tenant> {
  return apiPatch(`/api/superadmin/tenants/${tenantId}`, { is_active: isActive });
}

// ==================== USERS ====================

/**
 * Obtener todos los usuarios
 * GET /api/superadmin/users
 */
export async function getUsers(params?: {
  skip?: number;
  limit?: number;
}): Promise<{ items: User[]; total: number }> {
  return apiGet('/api/superadmin/users', params as Record<string, number>);
}

/**
 * Obtener un usuario por ID
 * GET /api/superadmin/users/:id
 */
export async function getUser(userId: number): Promise<User> {
  return apiGet(`/api/superadmin/users/${userId}`);
}

/**
 * Crear un nuevo usuario
 * POST /api/superadmin/users
 */
export async function createUser(data: Partial<User>): Promise<User> {
  return apiPost('/api/superadmin/users', data);
}

/**
 * Actualizar un usuario
 * PATCH /api/superadmin/users/:id
 */
export async function updateUser(
  userId: number,
  data: Partial<User>
): Promise<User> {
  return apiPatch(`/api/superadmin/users/${userId}`, data);
}

/**
 * Toggle user status (activar/desactivar)
 * PATCH /api/superadmin/users/:id
 */
export async function toggleUserStatus(
  userId: number,
  isActive: boolean
): Promise<User> {
  return apiPatch(`/api/superadmin/users/${userId}`, { is_active: isActive });
}

// ==================== ORDERS ====================

/**
 * Obtener orders globales de todos los tenants
 * GET /api/superadmin/global-orders
 */
export async function getGlobalOrders(limit: number = 20): Promise<GlobalOrder[]> {
  const response = await apiGet<{ items: GlobalOrder[] }>(
    '/api/superadmin/global-orders',
    { limit }
  );
  return response.items;
}

/**
 * Obtener orders filtradas por tenant (full Order type for OrdersTable)
 * GET /api/superadmin/global-orders?tenant_id=X
 */
export async function getOrdersByTenant(tenantId?: number, limit: number = 100): Promise<OrderListResponse> {
  const params: Record<string, number> = { limit };
  if (tenantId) params.tenant_id = tenantId;
  return apiGet<OrderListResponse>(
    '/api/superadmin/global-orders',
    params
  );
}

/**
 * Obtener invoices filtradas por tenant
 * GET /api/superadmin/invoices?tenant_id=X
 */
export async function getInvoicesByTenant(tenantId?: number, limit: number = 100): Promise<InvoiceListResponse> {
  const params: Record<string, number> = { limit };
  if (tenantId) params.tenant_id = tenantId;
  return apiGet<InvoiceListResponse>(
    '/api/superadmin/invoices',
    params
  );
}

// ==================== STATS ====================

/**
 * Obtener estadísticas globales
 * GET /api/superadmin/stats
 */
export async function getStats(): Promise<SuperAdminStats> {
  return apiGet('/api/superadmin/stats');
}

/**
 * Obtener actividad reciente
 * GET /api/superadmin/stats/activity/recent
 */
export async function getRecentActivity(
  limit: number = 10
): Promise<RecentActivity[]> {
  const response = await apiGet<{ activities: RecentActivity[] }>(
    '/api/superadmin/stats/activity/recent',
    { limit }
  );
  return response.activities;
}

// ==================== API KEYS ====================

/**
 * Obtener API keys
 * GET /api/superadmin/api-keys
 */
export async function getApiKeys(tenantId?: number): Promise<APIKey[]> {
  const params = tenantId ? { tenant_id: tenantId } : undefined;
  return apiGet('/api/superadmin/api-keys', params as Record<string, number>);
}

/**
 * Crear API key
 * POST /api/superadmin/api-keys
 */
export async function createApiKey(data: {
  name: string;
  tenant_id?: number;
}): Promise<APIKey> {
  return apiPost('/api/superadmin/api-keys', data);
}

/**
 * Revocar API key
 * DELETE /api/superadmin/api-keys/:id
 */
export async function revokeApiKey(apiKeyId: number): Promise<void> {
  return apiPost(`/api/superadmin/api-keys/${apiKeyId}`, {});
}

// ==================== MESSAGING WEBHOOKS ====================

export interface WebhookConfig {
  id: string;
  url: string;
  subscriptions: string[];
}

/**
 * Obtener webhook de messaging configurado para un tenant
 * GET /api/superadmin/tenants/:id/messaging-webhook
 */
export async function getTenantWebhook(tenantId: number): Promise<WebhookConfig | null> {
  const data = await apiGet<WebhookConfig | Record<string, never>>(
    `/api/superadmin/tenants/${tenantId}/messaging-webhook`
  );
  // Empty object means no webhook configured
  if (!data || !('id' in data)) return null;
  return data as WebhookConfig;
}

/**
 * Crear o actualizar webhook de messaging para un tenant
 * POST /api/superadmin/tenants/:id/messaging-webhook
 */
export async function saveTenantWebhook(
  tenantId: number,
  data: { url: string; subscriptions: string[] }
): Promise<WebhookConfig> {
  return apiPost(`/api/superadmin/tenants/${tenantId}/messaging-webhook`, data);
}

/**
 * Eliminar webhook de messaging para un tenant
 * DELETE /api/superadmin/tenants/:id/messaging-webhook
 */
export async function deleteTenantWebhook(tenantId: number): Promise<void> {
  return apiDelete(`/api/superadmin/tenants/${tenantId}/messaging-webhook`);
}
