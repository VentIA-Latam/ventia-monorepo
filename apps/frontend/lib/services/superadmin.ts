/**
 * SuperAdmin Service
 * Handles platform-wide data for super administrators
 */

import { extractShopifyDraftOrderId } from "@/lib/utils";

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
  tenant_name?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all tenants (SUPER_ADMIN only)
 */
export async function getAllTenants(): Promise<TenantSummary[]> {
  const response = await fetch('/api/superadmin/tenants', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch tenants' }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Get global orders across all tenants (SUPER_ADMIN only)
 */
export async function getGlobalOrders(limit: number = 20): Promise<GlobalOrder[]> {
  const response = await fetch(`/api/superadmin/global-orders?limit=${limit}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch orders' }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const orders = data.items || [];

  // Map backend response to frontend format
  return orders.map((order: any) => ({
    ...order,
    order_number: order.shopify_order_id || (order.shopify_draft_order_id ? extractShopifyDraftOrderId(order.shopify_draft_order_id) : null) || `#${order.id}`,
    total: order.total_price || 0,
    tenant_name: order.tenant?.name || `Tenant ${order.tenant_id}`,
  }));
}
