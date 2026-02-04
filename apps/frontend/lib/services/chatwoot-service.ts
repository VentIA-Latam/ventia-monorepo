/**
 * Chatwoot Integration Types and Utilities
 * 
 * Este archivo contiene tipos y utilidades para la integración con Chatwoot.
 * 
 * Para configurar SSO con Chatwoot, necesitas:
 * 1. Habilitar SSO en Chatwoot (Enterprise feature o Self-hosted)
 * 2. Configurar un Custom SSO provider que apunte a tu backend
 * 3. Generar tokens JWT para autenticar usuarios automáticamente
 */

export interface ChatwootConfig {
    baseUrl: string;
    accountId?: number;
    websiteToken?: string;
    ssoEnabled?: boolean;
}

export interface ChatwootUser {
    identifier: string;
    email: string;
    name?: string;
    avatar_url?: string;
    phone_number?: string;
    custom_attributes?: Record<string, string | number | boolean>;
}

/**
 * Genera la URL del dashboard de Chatwoot con parámetros opcionales
 */
export function getChatwootDashboardUrl(config: ChatwootConfig): string {
    const { baseUrl, accountId } = config;

    if (accountId) {
        return `${baseUrl}/app/accounts/${accountId}/dashboard`;
    }

    return `${baseUrl}/app`;
}

/**
 * Genera la URL de SSO para Chatwoot
 * Nota: Esto requiere que tengas SSO configurado en tu instalación de Chatwoot
 */
export function getChatwootSSOUrl(config: ChatwootConfig, ssoToken: string): string {
    const { baseUrl } = config;
    return `${baseUrl}/auth/sso?sso_auth_token=${ssoToken}`;
}

/**
 * Configuración para el widget de Chatwoot (para soporte en vivo)
 */
export interface ChatwootWidgetSettings {
    websiteToken: string;
    baseUrl: string;
    locale?: string;
    position?: 'left' | 'right';
    type?: 'standard' | 'expanded_bubble';
    launcherTitle?: string;
}

/**
 * Inicializa el widget de Chatwoot para soporte en vivo
 * Esto es diferente al dashboard - es para que los usuarios finales contacten soporte
 */
export function initChatwootWidget(settings: ChatwootWidgetSettings): void {
    if (typeof window === 'undefined') return;

    const { websiteToken, baseUrl, locale = 'es', position = 'right', type = 'standard', launcherTitle = 'Chat con nosotros' } = settings;

    // Configurar settings globales
    (window as unknown as Record<string, unknown>).chatwootSettings = {
        hideMessageBubble: false,
        position,
        locale,
        type,
        launcherTitle,
    };

    // Cargar el script de Chatwoot
    const script = document.createElement('script');
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
        (window as unknown as { chatwootSDK?: { run: (config: { websiteToken: string; baseUrl: string }) => void } }).chatwootSDK?.run({
            websiteToken,
            baseUrl,
        });
    };

    document.head.appendChild(script);
}

/**
 * Establece el usuario actual en el widget de Chatwoot
 * Útil para identificar usuarios cuando usan el chat de soporte
 */
export function setChatwootUser(user: ChatwootUser): void {
    if (typeof window === 'undefined') return;

    const chatwoot = (window as unknown as {
        $chatwoot?: {
            setUser: (identifier: string, user: Omit<ChatwootUser, 'identifier'>) => void;
            reset: () => void;
        }
    }).$chatwoot;

    if (chatwoot) {
        chatwoot.setUser(user.identifier, {
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
            phone_number: user.phone_number,
            custom_attributes: user.custom_attributes,
        });
    }
}

/**
 * Resetea el usuario en el widget de Chatwoot (para logout)
 */
export function resetChatwootUser(): void {
    if (typeof window === 'undefined') return;

    const chatwoot = (window as unknown as { $chatwoot?: { reset: () => void } }).$chatwoot;
    chatwoot?.reset();
}
