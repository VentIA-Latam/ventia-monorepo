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
 * Helper para formatear fecha (solo fecha, sin hora)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024"
 */
export function formatDate(isoDate: string): string {
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
 * @returns String formateado "15/01/2024, 14:30"
 */
export function formatDateTime(isoDate: string): string {
  const utcDate = new Date(isoDate + 'Z');

  const peruDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'America/Lima' })
  );

  const day = String(peruDate.getDate()).padStart(2, '0');
  const month = String(peruDate.getMonth() + 1).padStart(2, '0');
  const year = peruDate.getFullYear();
  const hours = String(peruDate.getHours()).padStart(2, '0');
  const minutes = String(peruDate.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Extrae el ID numérico de un Shopify GraphQL ID
 * @param gid - ID en formato "gid://shopify/DraftOrder/1026313977995"
 * @returns El ID numérico "1026313977995", o el valor original si no coincide
 */
export function extractShopifyDraftOrderId(gid: string): string {
  const match = gid.match(/gid:\/\/shopify\/DraftOrder\/(\d+)/);
  return match ? match[1] : gid;
}


export function extractShopifyOrderId(gid: string): string {
  const match = gid.match(/gid:\/\/shopify\/Order\/(\d+)/);
  return match ? match[1] : gid;
}