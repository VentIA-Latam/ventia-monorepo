/**
 * Role constants for the VentIA platform
 *
 * This file centralizes all role definitions to avoid hardcoding strings
 * throughout the codebase and provides user-friendly labels for the UI.
 */

// Definición de roles con labels para UI
export const ROLES = [
  { value: 'SUPERADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'LOGISTICA', label: 'Logística' },
  { value: 'VENTAS', label: 'Ventas' },
  { value: 'VIEWER', label: 'Viewer' },
] as const;

// Type para roles (derived from ROLES array)
export type UserRole = typeof ROLES[number]['value'];

/**
 * Helper para obtener el label amigable de un role
 * @param role - Role value (e.g., 'SUPERADMIN', 'ADMIN')
 * @returns User-friendly label (e.g., 'Super Admin', 'Admin')
 */
export function getRoleLabel(role: UserRole): string {
  return ROLES.find(r => r.value === role)?.label || role;
}

/**
 * Roles sin SUPERADMIN (para formularios regulares)
 * SUPERADMIN no debe poder ser asignado manualmente a usuarios
 */
export const REGULAR_ROLES = ROLES.filter(r => r.value !== 'SUPERADMIN');
