export interface Order {
  id: string; // ID visual (ej: "ORD-3920" o "123")
  dbId: number; // ID real de la base de datos
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
