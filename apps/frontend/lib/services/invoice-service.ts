/**
 * Invoice Service - Servicio para gestión de facturas electrónicas
 * Integración con backend FastAPI y eFact-OSE
 * Sigue el mismo patrón que order-service.ts
 */

import {
  Invoice,
  InvoiceCreate,
  InvoiceSerie,
  InvoiceSerieCreate,
  InvoiceListResponse,
} from "@/lib/types/invoice";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Fetch invoices with pagination and optional filters
 * GET /invoices?skip={}&limit={}&order_id={}
 */
export async function fetchInvoices(
  accessToken: string,
  params?: {
    skip?: number;
    limit?: number;
    order_id?: number;
  }
): Promise<InvoiceListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.skip !== undefined) {
    queryParams.append("skip", params.skip.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append("limit", params.limit.toString());
  }
  if (params?.order_id !== undefined) {
    queryParams.append("order_id", params.order_id.toString());
  }

  const url = `${API_URL}/invoices${queryParams.toString() ? "?" + queryParams.toString() : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to fetch invoices",
    }));
    throw new Error(error.detail || "Failed to fetch invoices");
  }

  return response.json();
}

/**
 * Fetch single invoice by ID
 * WORKAROUND: El backend no tiene GET /invoices/{id}, 
 * así que obtenemos todos los invoices y buscamos el que necesitamos
 * GET /invoices (lista todos del tenant)
 */
export async function fetchInvoice(
  accessToken: string,
  invoiceId: number
): Promise<Invoice> {
  // Obtener todos los invoices del tenant
  const response = await fetch(`${API_URL}/invoices`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to fetch invoices",
    }));
    throw new Error(error.detail || "Failed to fetch invoices");
  }

  const data = await response.json();

  // El backend devuelve { total, items, skip, limit }
  const invoices: Invoice[] = data.items || [];
  const invoice = invoices.find(inv => inv.id === invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  return invoice;

}

/**
 * Fetch all invoices for a specific order
 * GET /orders/{orderId}/invoices
 */
export async function fetchInvoicesByOrder(
  accessToken: string,
  orderId: number
): Promise<Invoice[]> {
  const response = await fetch(`${API_URL}/orders/${orderId}/invoices`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    // Si es 404, retornar array vacío (orden sin invoices)
    if (response.status === 404) {
      return [];
    }
    const error = await response.json().catch(() => ({
      detail: "Failed to fetch invoices for order",
    }));
    throw new Error(error.detail || "Failed to fetch invoices for order");
  }

  return response.json();
}

/**
 * Create invoice from order
 * POST /orders/{orderId}/invoices
 */
export async function createInvoice(
  accessToken: string,
  orderId: number,
  data: InvoiceCreate
): Promise<Invoice> {
  const response = await fetch(`${API_URL}/orders/${orderId}/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to create invoice",
    }));
    throw new Error(error.detail || "Failed to create invoice");
  }

  return response.json();
}

/**
 * Check invoice status (get updated invoice with current eFact status)
 * GET /invoices/{invoiceId}/status
 */
export async function checkInvoiceStatus(
  accessToken: string,
  invoiceId: number
): Promise<Invoice> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/status`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to check invoice status",
    }));
    throw new Error(error.detail || "Failed to check invoice status");
  }

  return response.json();
}

/**
 * Download invoice PDF
 * GET /invoices/{invoiceId}/pdf
 * Returns Blob and triggers browser download with cleanup
 */
export async function downloadInvoicePDF(
  accessToken: string,
  invoiceId: number,
  fileName?: string
): Promise<void> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/pdf`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to download PDF",
    }));
    throw new Error(error.detail || "Failed to download PDF");
  }

  // Extract filename from Content-Disposition header or use provided/default
  const contentDisposition = response.headers.get("Content-Disposition");
  let downloadFileName = fileName || "invoice.pdf";

  if (!fileName && contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      downloadFileName = filenameMatch[1];
    }
  }

  // Get blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadFileName;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Download invoice XML
 * GET /invoices/{invoiceId}/xml
 * Returns Blob and triggers browser download with cleanup
 */
export async function downloadInvoiceXML(
  accessToken: string,
  invoiceId: number,
  fileName?: string
): Promise<void> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/xml`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to download XML",
    }));
    throw new Error(error.detail || "Failed to download XML");
  }

  // Extract filename from Content-Disposition header or use provided/default
  const contentDisposition = response.headers.get("Content-Disposition");
  let downloadFileName = fileName || "invoice.xml";

  if (!fileName && contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      downloadFileName = filenameMatch[1];
    }
  }

  // Get blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadFileName;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// === INVOICE SERIES MANAGEMENT ===
// Note: Series endpoints may not follow exact same pattern as they're admin-only

/**
 * Fetch invoice series for tenant
 * GET /invoice-series
 */
export async function fetchInvoiceSeries(
  accessToken: string,
  tenantId?: number
): Promise<InvoiceSerie[]> {
  const url = tenantId
    ? `${API_URL}/invoice-series?tenant_id=${tenantId}`
    : `${API_URL}/invoice-series`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to fetch invoice series",
    }));
    throw new Error(error.detail || "Failed to fetch invoice series");
  }

  return response.json();
}

/**
 * Create new invoice series
 * POST /invoice-series
 */
export async function createInvoiceSerie(
  accessToken: string,
  serieData: InvoiceSerieCreate,
  tenantId?: number
): Promise<InvoiceSerie> {
  const url = tenantId
    ? `${API_URL}/invoice-series?tenant_id=${tenantId}`
    : `${API_URL}/invoice-series`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serieData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to create invoice series",
    }));
    throw new Error(error.detail || "Failed to create invoice series");
  }

  return response.json();
}

/**
 * Update invoice series
 * PATCH /invoice-series/{serieId}
 */
export async function updateInvoiceSerie(
  accessToken: string,
  serieId: number,
  updates: Partial<InvoiceSerieCreate>
): Promise<InvoiceSerie> {
  const response = await fetch(`${API_URL}/invoice-series/${serieId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to update invoice series",
    }));
    throw new Error(error.detail || "Failed to update invoice series");
  }

  return response.json();
}

/**
 * Delete invoice series
 * DELETE /invoice-series/{serieId}
 */
export async function deleteInvoiceSerie(
  accessToken: string,
  serieId: number
): Promise<void> {
  const response = await fetch(`${API_URL}/invoice-series/${serieId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to delete invoice series",
    }));
    throw new Error(error.detail || "Failed to delete invoice series");
  }
}

/**
 * Send invoice by email
 * POST /invoices/{invoiceId}/send-email
 */
export async function sendInvoiceEmail(
  accessToken: string,
  invoiceId: number,
  recipientEmail?: string,
  includeXml?: boolean
): Promise<{
  success: boolean;
  email_id?: string;
  sent_to: string;
  message: string;
}> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient_email: recipientEmail,
      include_xml: includeXml || false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Failed to send invoice email",
    }));
    throw new Error(error.detail || "Failed to send invoice email");
  }

  return response.json();
}
