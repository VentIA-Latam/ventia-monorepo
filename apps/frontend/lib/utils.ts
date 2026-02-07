import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * US-007: Helper para formatear moneda
 * @param amount - Monto numérico
 * @param currency - Código de moneda (PEN, USD, etc.)
 * @returns String formateado "S/ 150.50" o "$ 1,000.00"
 */
export function formatCurrency(
  amount: number,
  currency: string
): string {
  const symbol = currency === "PEN" ? "S/" : "$";
  return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Convert currency code to symbol
 * @param currency - Currency code (USD, PEN, EUR, etc.)
 * @returns Currency symbol ($, S/, €, etc.)
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PEN': 'S/',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
  };
  return symbols[currency.toUpperCase()] || currency;
}

/**
 * Helper para formatear fecha (solo fecha, sin hora)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024"
 */
export function formatDate(isoDate: string): string {
  // Pure date strings (e.g. "2026-02-01") from metrics date ranges
  // Parse directly to avoid timezone shift (UTC midnight → previous day in Lima)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  // Timestamps (e.g. "2026-02-06 00:34:06") → convert from UTC to Lima
  const utcDate = new Date(isoDate + 'Z');

  const peruDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'America/Lima' })
  );

  const day = String(peruDate.getDate()).padStart(2, '0');
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const year = peruDate.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Helper para formatear fecha y hora completa (24 horas, hora de Perú UTC-5)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024 14:30"
 */
export function formatDateTime(isoDate: string): string {
  const utcDate = new Date(isoDate + 'Z');

  const peruDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'America/Lima' })
  );

  const day = String(peruDate.getDate()).padStart(2, '0');
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const year = peruDate.getFullYear();

  let hours = peruDate.getHours();
  const minutes = String(peruDate.getMinutes()).padStart(2, '0');

  const period = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12; // convierte 0 → 12

  const formattedHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year} ${formattedHours}:${minutes} ${period}`;
}


/**
 * Extrae el ID numérico de un Shopify GraphQL ID
 * @param gid - ID en formato "gid://shopify/DraftOrder/1026313977995"
 * @returns El ID numérico "1026313977995", o el valor original si no coincide
 */
export function extractShopifyDraftOrderId(gid: string | null): string {
  if (!gid) return '';
  const match = gid.match(/gid:\/\/shopify\/DraftOrder\/(\d+)/);
  return match ? match[1] : gid;
}


export function extractShopifyOrderId(gid: string | null): string {
  if (!gid) return '';
  const match = gid.match(/gid:\/\/shopify\/Order\/(\d+)/);
  return match ? match[1] : gid;
}

/**
 * Obtiene el ID de e-commerce de una orden (Shopify o WooCommerce)
 * @param order - Objeto de orden con shopify_draft_order_id o woocommerce_order_id
 * @returns El ID de la plataforma de e-commerce correspondiente
 */
export function getEcommerceOrderId(order: {
  shopify_draft_order_id: string | null;
  woocommerce_order_id: number | null;
}): string {
  if (order.shopify_draft_order_id) {
    return extractShopifyDraftOrderId(order.shopify_draft_order_id);
  }
  if (order.woocommerce_order_id) {
    return order.woocommerce_order_id.toString();
  }
  return 'N/A';
}

/**
 * Obtiene el ID de una orden completada (Shopify Order ID o WooCommerce Order ID)
 * @param order - Objeto de orden con shopify_order_id o woocommerce_order_id
 * @returns El ID de la orden completada
 */
export function getCompletedOrderId(order: {
  shopify_order_id: string | null;
  woocommerce_order_id: number | null;
}): string {
  if (order.shopify_order_id) {
    return extractShopifyOrderId(order.shopify_order_id);
  }
  if (order.woocommerce_order_id) {
    return order.woocommerce_order_id.toString();
  }
  return 'N/A';
}