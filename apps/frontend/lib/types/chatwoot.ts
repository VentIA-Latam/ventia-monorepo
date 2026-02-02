/**
 * Chatwoot Integration Types
 *
 * Tipos para la integración de Chatwoot con SSO.
 * VentIA usa Chatwoot para el sistema de mensajería y atención al cliente.
 */

/**
 * Configuración de Chatwoot para un usuario
 * Obtenido desde el backend
 */
export interface ChatwootConfig {
  /** Indica si el usuario está configurado para usar Chatwoot */
  configured: boolean;
  /** ID del usuario en Chatwoot (para SSO) */
  chatwoot_user_id: number | null;
  /** ID de la cuenta de Chatwoot (para SSO) */
  chatwoot_account_id: number | null;
}

/**
 * Respuesta del endpoint de SSO
 * Contiene la URL autenticada para acceder a Chatwoot
 */
export interface ChatwootSSOResponse {
  /** URL de SSO para login automático en Chatwoot */
  url: string;
}
