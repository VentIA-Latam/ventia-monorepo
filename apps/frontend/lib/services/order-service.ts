/**
 * Order service - API calls to backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface Order {
  id: number;
  tenant_id: number;
  shopify_draft_order_id: string | null;
  shopify_order_id: string | null;
  woocommerce_order_id: number | null;
  customer_document_type: string | null;  // DNI o RUC
  customer_document_number: string | null;
  customer_email: string;
  customer_name: string | null;
  total_price: number;
  currency: string;
  line_items: LineItem[] | null;
  validado: boolean;
  validated_at: string | null;
  payment_method: string | null;
  shipping_address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  total: number;
  items: Order[];
  skip: number;
  limit: number;
}

export interface LineItem {
  id?: string | number;
  sku: string;
  product: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  [key: string]: unknown;
}

export interface OrderValidateRequest {
  payment_method?: string;
  notes?: string;
}

export interface OrderCancelRequest {
  reason: string;
  restock?: boolean;
  notify_customer?: boolean;
  refund_method?: string | null;
  staff_note?: string | null;
}

/**
 * Fetch orders from backend
 */
export async function fetchOrders(
  accessToken: string,
  params?: {
    skip?: number;
    limit?: number;
    validado?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<OrderListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.skip !== undefined) {
    queryParams.append('skip', params.skip.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.validado !== undefined) {
    queryParams.append('validado', params.validado.toString());
  }
  if (params?.sortBy !== undefined) {
    queryParams.append('sort_by', params.sortBy);
  }
  if (params?.sortOrder !== undefined) {
    queryParams.append('sort_order', params.sortOrder);
  }

  const url = `${API_URL}/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch orders' }));
    throw new Error(error.detail || 'Failed to fetch orders');
  }

  return response.json();
}

/**
 * Get single order by ID
 */
export async function fetchOrder(accessToken: string, orderId: number): Promise<Order> {
  const response = await fetch(`${API_URL}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch order' }));
    throw new Error(error.detail || 'Failed to fetch order');
  }

  return response.json();
}

/**
 * Update order
 */
export async function updateOrder(
  accessToken: string,
  orderId: number,
  data: Partial<Order>
): Promise<Order> {
  const response = await fetch(`${API_URL}/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to update order' }));
    throw new Error(error.detail || 'Failed to update order');
  }

  return response.json();
}

/**
 * Validate order and complete draft order in Shopify
 *
 * This is the main action that:
 * 1. Marks the order as validated
 * 2. Calls Shopify GraphQL to complete the draft order
 * 3. Returns the updated order with Shopify order ID
 */
export async function validateOrder(
  accessToken: string,
  orderId: number,
  data?: OrderValidateRequest
): Promise<Order> {
  const response = await fetch(`${API_URL}/orders/${orderId}/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to validate order' }));
    throw new Error(error.detail || 'Failed to validate order');
  }

  return response.json();
}

/**
 * Cancel order and sync with ecommerce platform (Shopify / WooCommerce)
 */
export async function cancelOrder(
  accessToken: string,
  orderId: number,
  data: OrderCancelRequest
): Promise<Order> {
  const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to cancel order' }));
    throw new Error(error.detail || 'Failed to cancel order');
  }

  return response.json();
}
