export interface Order {
  id: string; // ID visual del draft (ej: "1026313977995")
  dbId: number; // ID real de la base de datos
  shopifyOrderId: string | null; // ID de orden Shopify (después de validar pago)
  date: string;
  client: {
    name: string;
    email: string;
  };
  channel: 'Portal B2B' | 'WhatsApp' | 'Venta Directa';
  paymentStatus: 'Pagado' | 'Pendiente' | 'Rechazado';
  logisticsStatus: 'En camino' | 'Procesando' | 'Entregado' | 'Cancelado';
  amount: number;
  currency: string;
}

/**
 * FakeOrder - Para datos mock/fake sin dbId ni shopifyOrderId real
 * Usado en tests, mock data, y páginas de ejemplo
 */
export type FakeOrder = Omit<Order, 'dbId' | 'shopifyOrderId'>;

export interface OrderFilters {
  search: string;
  paymentStatus: string;
  channel: string;
  dateRange: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  skip: number;
  limit: number;
}
