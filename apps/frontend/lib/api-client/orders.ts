/**
 * Orders Client API
 * 
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * 
 * Este módulo proporciona funciones para interactuar con la API de orders
 * desde componentes cliente. Todas las funciones llaman a /api/* routes.
 */

import { apiGet, apiPost, apiPatch, apiDownload } from './client';
import type { Order, OrderListResponse } from '@/lib/types/order';

export interface FetchOrdersParams {
  skip?: number;
  limit?: number;
  validado?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ValidateOrderRequest {
  payment_method?: string;
  notes?: string;
}

export interface CancelOrderRequest {
  reason: string;
  restock?: boolean;
  notify_customer?: boolean;
  refund_method?: string | null;
  staff_note?: string | null;
}

/**
 * Obtener lista de orders
 * GET /api/orders
 */
export async function getOrders(
  params?: FetchOrdersParams
): Promise<OrderListResponse> {
  return apiGet<OrderListResponse>('/api/orders', params as Record<string, string | number | boolean>);
}

/**
 * Obtener una order por ID
 * GET /api/orders/:id
 */
export async function getOrder(orderId: number): Promise<Order> {
  return apiGet<Order>(`/api/orders/${orderId}`);
}

/**
 * Actualizar una order
 * PATCH /api/orders/:id
 */
export async function updateOrder(
  orderId: number,
  data: Partial<Order>
): Promise<Order> {
  return apiPatch<Order>(`/api/orders/${orderId}`, data);
}

/**
 * Validar una order y completar draft order en Shopify
 * POST /api/orders/:id/validate
 */
export async function validateOrder(
  orderId: number,
  data?: ValidateOrderRequest
): Promise<Order> {
  return apiPost<Order>(`/api/orders/${orderId}/validate`, data);
}

/**
 * Cancelar una order y sincronizar con la plataforma de ecommerce
 * POST /api/orders/:id/cancel
 */
export async function cancelOrder(
  orderId: number,
  data: CancelOrderRequest
): Promise<Order> {
  return apiPost<Order>(`/api/orders/${orderId}/cancel`, data);
}

/**
 * Exportar orders como CSV o Excel
 * GET /api/orders/export
 */
export async function exportOrders(params: {
  format: "csv" | "excel";
  start_date?: string;
  end_date?: string;
  validado?: boolean;
}): Promise<void> {
  const query = new URLSearchParams();
  query.set("format", params.format);
  if (params.start_date) query.set("start_date", params.start_date);
  if (params.end_date) query.set("end_date", params.end_date);
  if (params.validado !== undefined) query.set("validado", String(params.validado));

  const ext = params.format === "excel" ? "xlsx" : "csv";
  return apiDownload(`/api/orders/export?${query.toString()}`, `pedidos.${ext}`);
}
