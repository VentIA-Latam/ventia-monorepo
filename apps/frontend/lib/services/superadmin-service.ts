/**
 * SuperAdmin Server-Side Service
 *
 * 🔒 SOLO USAR DESDE SERVER COMPONENTS
 *
 * Llama directamente al backend con el token de Auth0,
 * eliminando el paso intermedio de las API routes.
 */

import { getAccessToken } from "@/lib/auth0";
import type { Tenant } from "@/lib/types/tenant";
import type { User } from "@/lib/types/user";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchWithAuth<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ==================== STATS ====================

export interface SuperAdminStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_orders: number;
  total_revenue: number;
  active_api_keys?: number;
  total_super_admins?: number;
}

export async function fetchStats(): Promise<SuperAdminStats> {
  return fetchWithAuth<SuperAdminStats>("/stats");
}

// ==================== ACTIVITY ====================

export interface RecentActivity {
  id: string;
  type?: "order" | "user" | "tenant";
  entity_type: string;
  operation: string;
  description: string;
  timestamp: string;
  tenant_name?: string;
}

export async function fetchRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  const data = await fetchWithAuth<{ activities: RecentActivity[] }>(
    "/stats/activity/recent",
    { limit }
  );
  return data.activities;
}

// ==================== TENANTS ====================

export async function fetchTenants(params?: {
  skip?: number;
  limit?: number;
}): Promise<{ items: Tenant[]; total: number }> {
  return fetchWithAuth<{ items: Tenant[]; total: number }>(
    "/tenants",
    params as Record<string, number>
  );
}

// ==================== USERS ====================

export async function fetchUsers(params?: {
  skip?: number;
  limit?: number;
}): Promise<{ items: User[]; total: number }> {
  return fetchWithAuth<{ items: User[]; total: number }>(
    "/users",
    params as Record<string, number>
  );
}

// ==================== GLOBAL ORDERS ====================

export interface GlobalOrder {
  id: number;
  customer_name: string;
  customer_email: string;
  status: string;
  total_price: number;
  currency: string;
  validado: boolean;
  tenant_id: number;
  tenant?: Tenant;
  channel: string;
  created_at: string;
  updated_at: string;
}

export async function fetchGlobalOrders(limit: number = 20): Promise<GlobalOrder[]> {
  const data = await fetchWithAuth<{ items: GlobalOrder[] }>(
    "/orders",
    { limit }
  );
  return data.items;
}

/**
 * Fetch orders with full schema (for OrdersTable reuse in superadmin)
 */
export async function fetchOrdersFull(params?: {
  limit?: number;
  tenant_id?: number;
}): Promise<{ items: import("@/lib/services/order-service").Order[]; total: number }> {
  return fetchWithAuth("/orders", params as Record<string, number>);
}

// ==================== INVOICES ====================

/**
 * Fetch invoices (for superadmin invoices page)
 */
export async function fetchInvoicesFull(params?: {
  limit?: number;
  tenant_id?: number;
}): Promise<{ items: import("@/lib/types/invoice").Invoice[]; total: number }> {
  return fetchWithAuth("/invoices", params as Record<string, number>);
}
