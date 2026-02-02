/**
 * Client API Helper
 * 
 * Wrapper para fetch desde Client Components.
 * ⚠️ SOLO USAR DESDE CLIENT COMPONENTS ("use client")
 * ⚠️ NO USAR DESDE SERVER COMPONENTS (usar services directamente)
 */

export interface ApiError {
  error: string;
  details?: string;
}

export class ClientApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string
  ) {
    super(message);
    this.name = 'ClientApiError';
  }
}

/**
 * Helper para hacer requests a las API Routes de Next.js
 * Maneja errores de forma consistente
 */
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'An error occurred',
      details: response.statusText,
    }));

    throw new ClientApiError(
      error.error || 'An error occurred',
      response.status,
      error.details
    );
  }

  return response.json();
}

/**
 * Helper para GET requests
 */
export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
  }

  const fullUrl = params ? `${url}?${queryParams}` : url;
  return apiRequest<T>(fullUrl, { method: 'GET' });
}

/**
 * Helper para POST requests
 */
export async function apiPost<T>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper para PUT requests
 */
export async function apiPut<T>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper para PATCH requests
 */
export async function apiPatch<T>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper para DELETE requests
 */
export async function apiDelete<T>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE' });
}

/**
 * Helper para descargar archivos (PDF, XML, etc.)
 */
export async function apiDownload(
  url: string,
  filename: string
): Promise<void> {
  const response = await fetch(url, { method: 'GET' });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'Failed to download file',
    }));
    throw new ClientApiError(error.error, response.status, error.details);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
