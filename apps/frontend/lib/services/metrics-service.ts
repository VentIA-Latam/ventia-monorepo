/**
 * Metrics service - API calls to backend metrics endpoints
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export type PeriodType =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface MetricsQuery {
  period: PeriodType;
  start_date?: string; // ISO date string (YYYY-MM-DD)
  end_date?: string;   // ISO date string (YYYY-MM-DD)
}

export interface DashboardMetrics {
  total_orders: number;
  pending_payment: number;
  total_sales: number;
  currency: string;
  period: PeriodType;
  start_date: string;
  end_date: string;
}

/**
 * Fetch dashboard metrics from backend
 */
export async function fetchDashboardMetrics(
  accessToken: string,
  query?: MetricsQuery
): Promise<DashboardMetrics> {
  const params = new URLSearchParams();

  if (query?.period) {
    params.append('period', query.period);
  }

  if (query?.start_date && query.period === 'custom') {
    params.append('start_date', query.start_date);
  }

  if (query?.end_date && query.period === 'custom') {
    params.append('end_date', query.end_date);
  }

  const url = `${API_URL}/metrics/dashboard${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    // Deshabilitar caché para siempre obtener datos frescos
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch metrics' }));
    throw new Error(error.detail || 'Failed to fetch metrics');
  }

  return response.json();
}

// --- Top Products ---

export interface TopProduct {
  product: string;
  total_sold: number;
  total_revenue: number;
}

export interface TopProductsResponse {
  data: TopProduct[];
  period: PeriodType;
  start_date: string;
  end_date: string;
}

export async function fetchTopProducts(
  accessToken: string,
  query?: MetricsQuery
): Promise<TopProductsResponse> {
  const params = new URLSearchParams();

  if (query?.period) {
    params.append('period', query.period);
  }

  if (query?.start_date && query.period === 'custom') {
    params.append('start_date', query.start_date);
  }

  if (query?.end_date && query.period === 'custom') {
    params.append('end_date', query.end_date);
  }

  const url = `${API_URL}/metrics/top-products${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch top products' }));
    throw new Error(error.detail || 'Failed to fetch top products');
  }

  return response.json();
}

// --- Orders by City ---

export interface CityOrderCount {
  city: string;
  order_count: number;
}

export interface OrdersByCityResponse {
  data: CityOrderCount[];
  period: PeriodType;
  start_date: string;
  end_date: string;
}

export async function fetchOrdersByCity(
  accessToken: string,
  query?: MetricsQuery
): Promise<OrdersByCityResponse> {
  const params = new URLSearchParams();

  if (query?.period) {
    params.append('period', query.period);
  }

  if (query?.start_date && query.period === 'custom') {
    params.append('start_date', query.start_date);
  }

  if (query?.end_date && query.period === 'custom') {
    params.append('end_date', query.end_date);
  }

  const url = `${API_URL}/metrics/orders-by-city${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch orders by city' }));
    throw new Error(error.detail || 'Failed to fetch orders by city');
  }

  return response.json();
}
