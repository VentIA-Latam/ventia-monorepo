/**
 * Invoice Types - Tipos para el sistema de facturación electrónica
 * Integración con eFact-OSE para SUNAT (Perú)
 */

/**
 * LineItem - Item de línea en una factura
 * Representa un producto/servicio facturado
 */
export interface LineItem {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  igv: number;
  total: number;
}

/**
 * Invoice - Comprobante electrónico (Factura, Boleta, NC, ND)
 * Incluye todos los campos del backend para facturación SUNAT
 */
export interface Invoice {
  // IDs
  id: number;
  tenant_id: number;
  order_id: number;

  // Tipo de comprobante
  invoice_type: "01" | "03" | "07" | "08"; // 01=Factura, 03=Boleta, 07=NC, 08=ND

  // Numeración
  serie: string; // Ej: "F001", "B001", "NC01", "ND01"
  correlativo: number; // Número secuencial
  full_number: string; // Computed: "F001-00000123"

  // Emisor (Tenant/Empresa)
  emisor_ruc: string;
  emisor_razon_social: string;

  // Cliente
  cliente_tipo_documento: string; // "1"=DNI, "6"=RUC, "4"=CE, etc.
  cliente_numero_documento: string;
  cliente_razon_social: string;

  // Moneda y montos
  currency: "PEN" | "USD";
  subtotal: number;
  igv: number; // Impuesto General a las Ventas (18%)
  total: number;

  // Items/Líneas del comprobante
  items: LineItem[];

  // Campos de referencia (solo para NC/ND)
  reference_invoice_id?: number; // ID de la factura referenciada
  reference_type?: string; // Tipo de referencia
  reference_serie?: string; // Serie del comprobante referenciado
  reference_correlativo?: number; // Correlativo del comprobante referenciado
  reference_reason?: string; // Motivo de la NC/ND

  // Estado y respuesta de eFact-OSE
  efact_status: 'pending' | 'processing' | 'success' | 'error';
  efact_ticket?: string; // Ticket de SUNAT
  efact_response?: any; // Respuesta completa de SUNAT
  efact_error?: string; // Mensaje de error si falla
  efact_sent_at?: string; // Fecha de envío a SUNAT
  efact_processed_at?: string; // Fecha de procesamiento por SUNAT

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * InvoiceCreate - Datos para crear un nuevo comprobante
 * Usado al generar factura desde una orden
 */
export interface InvoiceCreate {
  invoice_type: "01" | "03" | "07" | "08"; // Tipo de comprobante
  serie: string; // Serie configurada (ej: "F001", "B001")
  reference_invoice_id?: number; // Solo para NC/ND - ID del comprobante a referenciar
  reference_reason?: string; // Solo para NC/ND - Motivo de la nota
  // Customer data overrides (optional)
  cliente_tipo_documento?: string; // Override document type
  cliente_numero_documento?: string; // Override document number
  cliente_razon_social?: string; // Override customer name
  cliente_email?: string; // Override customer email
}

/**
 * InvoiceSerie - Serie de numeración para comprobantes
 * Cada serie tiene su propio contador de correlativo
 */
export interface InvoiceSerie {
  id: number;
  tenant_id: number;
  invoice_type: "01" | "03" | "07" | "08";
  serie: string; // 4 caracteres alfanuméricos
  last_correlativo: number; // Último correlativo usado (siguiente = last + 1)
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * InvoiceSerieCreate - Datos para crear una nueva serie
 */
export interface InvoiceSerieCreate {
  invoice_type: "01" | "03" | "07" | "08";
  serie: string; // 4 caracteres (ej: "F001", "B001")
  description?: string;
  is_active?: boolean;
}

/**
 * InvoiceListResponse - Respuesta paginada de lista de comprobantes
 */
export interface InvoiceListResponse {
  total: number;
  items: Invoice[];
  skip: number;
  limit: number;
}

/**
 * INVOICE_TYPES - Constantes de tipos de comprobantes SUNAT
 */
export const INVOICE_TYPES = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
} as const;

/**
 * INVOICE_TYPE_NAMES - Mapeo de códigos a nombres legibles
 * Según catálogo SUNAT de tipos de comprobantes
 */
export const INVOICE_TYPE_NAMES: Record<string, string> = {
  '01': 'Factura Electrónica',
  '03': 'Boleta de Venta Electrónica',
  '07': 'Nota de Crédito Electrónica',
  '08': 'Nota de Débito Electrónica',
};

/**
 * INVOICE_STATUS_NAMES - Mapeo de estados a textos
 * Estados del proceso de envío a SUNAT
 */
export const INVOICE_STATUS_NAMES: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  success: 'Validado por SUNAT',
  error: 'Error en SUNAT',
};

/**
 * INVOICE_STATUS_COLORS - Colores Tailwind para estados
 */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-50 text-gray-700 border-gray-200',
  processing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

// Mantener LABELS por compatibilidad con código existente
export const INVOICE_TYPE_LABELS = INVOICE_TYPE_NAMES;
export const INVOICE_STATUS_LABELS = INVOICE_STATUS_NAMES;
