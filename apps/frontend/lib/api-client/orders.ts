/**
 * Orders Client API
 * 
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * 
 * Este módulo proporciona funciones para interactuar con la API de orders
 * desde componentes cliente. Todas las funciones llaman a /api/* routes.
 */

import { apiGet, apiPost, apiPut } from './client';
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
 * PUT /api/orders/:id
 */
export async function updateOrder(
  orderId: number,
  data: Partial<Order>
): Promise<Order> {
  return apiPut<Order>(`/api/orders/${orderId}`, data);
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
