/**
 * Invoices Client API
 * 
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * 
 * Este módulo proporciona funciones para interactuar con la API de invoices
 * desde componentes cliente. Todas las funciones llaman a /api/* routes.
 */

import { apiGet, apiPost, apiPatch, apiDelete, apiDownload } from './client';
import type {
  Invoice,
  InvoiceCreate,
  InvoiceSerie,
  InvoiceSerieCreate,
  InvoiceListResponse,
} from '@/lib/types/invoice';

export interface FetchInvoicesParams {
  skip?: number;
  limit?: number;
  order_id?: number;
}

/**
 * Obtener lista de invoices
 * GET /api/invoices
 */
export async function getInvoices(
  params?: FetchInvoicesParams
): Promise<InvoiceListResponse> {
  return apiGet<InvoiceListResponse>('/api/invoices', params as Record<string, string | number>);
}

/**
 * Obtener invoice por order ID
 * GET /api/invoices/:orderId
 */
export async function getInvoiceByOrderId(orderId: number): Promise<Invoice> {
  return apiGet<Invoice>(`/api/invoices/${orderId}`);
}

/**
 * Crear invoice para una order
 * POST /api/invoices/:orderId
 */
export async function createInvoice(
  orderId: number,
  data: InvoiceCreate
): Promise<Invoice> {
  return apiPost<Invoice>(`/api/invoices/${orderId}`, data);
}

/**
 * Descargar PDF de invoice
 * GET /api/invoices/pdf/:id
 */
export async function downloadInvoicePdf(
  invoiceId: number,
  filename?: string
): Promise<void> {
  const defaultFilename = `invoice-${invoiceId}.pdf`;
  return apiDownload(`/api/invoices/pdf/${invoiceId}`, filename || defaultFilename);
}

/**
 * Descargar XML de invoice
 * GET /api/invoices/xml/:id
 */
export async function downloadInvoiceXml(
  invoiceId: number,
  filename?: string
): Promise<void> {
  const defaultFilename = `invoice-${invoiceId}.xml`;
  return apiDownload(`/api/invoices/xml/${invoiceId}`, filename || defaultFilename);
}

/**
 * Obtener lista de invoice series
 * GET /api/invoice-series
 */
export async function getInvoiceSeries(
  tenantId?: number
): Promise<InvoiceSerie[]> {
  const params = tenantId ? { tenant_id: tenantId } : undefined;
  return apiGet<InvoiceSerie[]>('/api/invoice-series', params as Record<string, number>);
}

/**
 * Crear nueva invoice serie
 * POST /api/invoice-series
 */
export async function createInvoiceSerie(
  data: InvoiceSerieCreate
): Promise<InvoiceSerie> {
  return apiPost<InvoiceSerie>('/api/invoice-series', data);
}

/**
 * Actualizar invoice serie
 * PATCH /api/invoice-series/:id
 */
export async function updateInvoiceSerie(
  serieId: number,
  data: Partial<InvoiceSerieCreate>
): Promise<InvoiceSerie> {
  return apiPatch<InvoiceSerie>(`/api/invoice-series/${serieId}`, data);
}

/**
 * Eliminar invoice serie
 * DELETE /api/invoice-series/:id
 */
export async function deleteInvoiceSerie(serieId: number): Promise<void> {
  return apiDelete<void>(`/api/invoice-series/${serieId}`);
}
