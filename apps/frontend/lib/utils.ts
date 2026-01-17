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
 * US-007: Helper para formatear fecha
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024"
 */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Lima'
  });
}

/**
 * Helper para formatear fecha y hora completa (24 horas, hora de Perú)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024, 14:30"
 */
export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima'
  });
}

/**
 * Helper para formatear fecha y hora con segundos (24 horas, hora de Perú)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "15/01/2024, 14:30:45"
 */
export function formatDateTimeWithSeconds(isoDate: string): string {
  return new Date(isoDate).toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Lima'
  });
}

/**
 * Helper para formatear solo la hora (24 horas, hora de Perú)
 * @param isoDate - Fecha en formato ISO string
 * @returns String formateado "14:30"
 */
export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima'
  });
}
