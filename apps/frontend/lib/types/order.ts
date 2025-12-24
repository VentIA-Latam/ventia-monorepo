export interface Order {
  id: string;
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

export interface OrderFilters {
  search: string;
  paymentStatus: string;
  channel: string;
  dateRange: string;
}
