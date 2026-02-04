/**
 * User Client API
 * 
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * 
 * Este módulo proporciona funciones para interactuar con la API de user
 * desde componentes cliente. Todas las funciones llaman a /api/user/* routes.
 */

import { apiGet } from './client';
import type { User } from '@/lib/types/user';

/**
 * Obtener datos del usuario actual
 * GET /api/user/me
 */
export async function getCurrentUser(): Promise<User> {
  return apiGet<User>('/api/user/me');
}
