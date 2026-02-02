/**
 * Chatwoot Client API
 *
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 *
 * Este módulo proporciona funciones para interactuar con la API de Chatwoot
 * desde componentes cliente. Todas las funciones llaman a /api/* routes.
 */

import { apiGet } from './client';
import type { ChatwootConfig, ChatwootSSOResponse } from '@/lib/types/chatwoot';

/**
 * Obtener configuración de Chatwoot para el usuario actual
 * GET /api/chatwoot/config
 */
export async function getChatwootConfig(): Promise<ChatwootConfig> {
  return apiGet<ChatwootConfig>('/api/chatwoot/config');
}

/**
 * Obtener URL de SSO para un usuario de Chatwoot
 * GET /api/chatwoot/sso/:userId
 */
export async function getChatwootSSOUrl(userId: number): Promise<ChatwootSSOResponse> {
  return apiGet<ChatwootSSOResponse>(`/api/chatwoot/sso/${userId}`);
}
