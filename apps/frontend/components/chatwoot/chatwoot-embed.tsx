"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    ExternalLink,
    RefreshCw,
    Maximize2,
    Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatwootConfig } from "@/lib/types/chatwoot";
import { getChatwootConfig, getChatwootSSOUrl } from "@/lib/api-client";
import { ChatwootHeader } from "./chatwoot-header";
import { ChatwootConfigCard } from "./chatwoot-config-card";
import { ChatwootUserConfigCard } from "./chatwoot-user-config-card";

export type ChatwootMode = "sso" | "direct";

interface ChatwootEmbedProps {
    /** Modo de autenticación: SSO (dashboard) o directo (superadmin) */
    mode: ChatwootMode;
    /** Color del icono en el header */
    iconColor?: "blue" | "purple";
    /** Mostrar información adicional en el footer */
    showFooterInfo?: boolean;
}

/**
 * Componente reutilizable para integrar Chatwoot
 *
 * Modos:
 * - "sso": Usa SSO para autenticación (requiere usuario configurado)
 * - "direct": URL directa al dashboard (para superadmin)
 */
export function ChatwootEmbed({
    mode,
    iconColor = "blue",
    showFooterInfo = true
}: ChatwootEmbedProps) {
    const { user, userDetails, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [ssoUrl, setSsoUrl] = useState<string | null>(null);
    const [chatwootConfig, setChatwootConfig] = useState<ChatwootConfig | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Duración de validez del SSO de Chatwoot (24 horas)
    const SSO_VALIDITY_HOURS = 24;
    const SSO_REFRESH_THRESHOLD_MS = (SSO_VALIDITY_HOURS - 1) * 60 * 60 * 1000;

    // Get Chatwoot URL from environment variables
    const chatwootBaseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "";

    // Initialize Chatwoot with SSO
    const initializeSSO = useCallback(async () => {
        if (!userDetails?.id) {
            setError("No se pudo obtener información del usuario.");
            return;
        }

        // Verificar si la sesión todavía es válida
        const expirationKey = `chatwoot_sso_expiration_${userDetails.id}`;
        const expirationTime = localStorage.getItem(expirationKey);

        if (expirationTime) {
            const now = Date.now();
            const expiration = parseInt(expirationTime);

            if (now < expiration) {
                // Sesión todavía válida - usar URL base (Chatwoot reconoce por cookie)
                console.log('[Chatwoot] Sesión todavía válida, usando URL base');
                setSsoUrl(chatwootBaseUrl); // Solo http://localhost:3001
                setIsLoading(false);
                return;
            } else {
                console.log('[Chatwoot] Sesión expirada, regenerando SSO...');
            }
        }

        // Generar nuevo SSO
        setIsLoading(true);
        setError(null);

        try {
            // Fetch Chatwoot configuration
            const config = await getChatwootConfig();
            setChatwootConfig(config);

            if (!config?.configured) {
                setError("Tu cuenta no está configurada para Chatwoot. Contacta al administrador.");
                return;
            }

            // Validar que tenemos user_id
            if (!config.chatwoot_user_id) {
                setError("Falta ID de usuario de Chatwoot. Contacta al administrador.");
                return;
            }

            // Generar nueva URL SSO
            const data = await getChatwootSSOUrl(userDetails.id);
            setSsoUrl(data.url);

            // Guardar CUÁNDO EXPIRA (no cuándo se generó)
            const newExpiration = Date.now() + SSO_REFRESH_THRESHOLD_MS;
            localStorage.setItem(expirationKey, newExpiration.toString());
            console.log('[Chatwoot] SSO generado. Expira en 23 horas');
        } catch (err) {
            console.error("Error initializing Chatwoot:", err);
            setError(err instanceof Error ? err.message : "Error al conectar con Chatwoot");
        } finally {
            setIsLoading(false);
        }
    }, [userDetails, chatwootBaseUrl, SSO_REFRESH_THRESHOLD_MS]);

    // Initialize direct mode
    const initializeDirect = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Obtener configuración del usuario primero
            const config = await getChatwootConfig();
            setChatwootConfig(config);

            // Construir URL directa (inline para evitar dependencias circulares)
            let url: string | null = null;
            if (chatwootBaseUrl) {
                if (config?.chatwoot_account_id) {
                    url = `${chatwootBaseUrl}/app/accounts/${config.chatwoot_account_id}/dashboard`;
                } else {
                    url = `${chatwootBaseUrl}/app`;
                }
            }

            if (url) {
                setSsoUrl(url);
            } else {
                setError("No se pudo conectar con Chatwoot");
            }
        } catch (err) {
            console.error("Error initializing Chatwoot:", err);
            // En modo directo, si falla la config, usar URL base sin account
            const fallbackUrl = chatwootBaseUrl ? `${chatwootBaseUrl}/app` : null;
            if (fallbackUrl) {
                setSsoUrl(fallbackUrl);
            } else {
                setError("No se pudo conectar con Chatwoot");
            }
        } finally {
            setIsLoading(false);
        }
    }, [chatwootBaseUrl]);

    // Initialize on mount
    useEffect(() => {
        if (authLoading) return;

        if (mode === "sso" && userDetails) {
            initializeSSO();
        } else if (mode === "direct") {
            initializeDirect();
        }
    }, [authLoading, userDetails, mode, initializeSSO, initializeDirect]);

    // Auto-refresh SSO antes de que expire (cada 23 horas)
    useEffect(() => {
        if (mode !== "sso" || !ssoUrl || !userDetails?.id) return;

        const intervalId = setInterval(() => {
            console.log('[Chatwoot] Auto-refresh periódico del SSO');
            // Forzar regeneración limpiando el localStorage primero
            localStorage.removeItem(`chatwoot_sso_expiration_${userDetails.id}`);
            initializeSSO();
        }, SSO_REFRESH_THRESHOLD_MS);

        return () => clearInterval(intervalId);
    }, [mode, ssoUrl, userDetails?.id, initializeSSO, SSO_REFRESH_THRESHOLD_MS]);

    const handleIframeError = () => {
        setError("No se pudo cargar Chatwoot. Verifica que el servicio esté disponible.");
    };

    const handleRefresh = async () => {
        if (mode === "sso") {
            await initializeSSO();
        } else {
            initializeDirect();
        }
    };

    const handleOpenExternal = () => {
        if (ssoUrl) {
            window.open(ssoUrl, "_blank", "noopener,noreferrer");
        } else if (chatwootBaseUrl) {
            window.open(chatwootBaseUrl, "_blank", "noopener,noreferrer");
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Si no hay URL de Chatwoot configurada
    if (!chatwootBaseUrl) {
        return (
            <div className="space-y-6">
                <ChatwootHeader iconColor={iconColor} />
                <ChatwootConfigCard />
            </div>
        );
    }

    // Loading state
    if (authLoading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-[calc(100vh-200px)] w-full rounded-lg" />
            </div>
        );
    }

    // User not configured for Chatwoot (only in SSO mode)
    if (mode === "sso" && chatwootConfig && !chatwootConfig.configured) {
        return (
            <div className="space-y-6">
                <ChatwootHeader iconColor={iconColor} />
                <ChatwootUserConfigCard />
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : ""}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <ChatwootHeader iconColor={iconColor} />

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="gap-2"
                        aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
                    >
                        {isFullscreen ? (
                            <>
                                <Minimize2 className="h-4 w-4" />
                                Salir
                            </>
                        ) : (
                            <>
                                <Maximize2 className="h-4 w-4" />
                                Pantalla completa
                            </>
                        )}
                    </Button>
                    {/* <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenExternal}
                        className="gap-2"
                        aria-label="Abrir Chatwoot en nueva pestaña"
                        disabled={!ssoUrl}
                    >
                        <ExternalLink className="h-4 w-4" />
                        Abrir en nueva pestaña
                    </Button> */}
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>
                            Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Chatwoot Iframe Container */}
            <div
                className={`relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ${
                    isFullscreen ? "h-[calc(100vh-120px)]" : "h-[calc(100vh-220px)] min-h-[700px]"
                }`}
            >
                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
                        <div className="text-center space-y-4">
                            <RefreshCw className={`h-8 w-8 animate-spin mx-auto ${iconColor === "purple" ? "text-purple-600" : "text-blue-600"}`} />
                            <p className="text-gray-500">
                                {mode === "sso" ? "Conectando con Chatwoot..." : "Cargando Chatwoot..."}
                            </p>
                        </div>
                    </div>
                )}

                {/* Iframe */}
                {ssoUrl && !error && (
                    <iframe
                        ref={iframeRef}
                        src={ssoUrl}
                        title="Conversaciones - Centro de mensajería y atención al cliente"
                        className="w-full h-full border-0"
                        onError={handleIframeError}
                        allow="microphone; camera; geolocation; notifications"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
                    />
                )}
            </div>

            {/* Footer info */}
            {showFooterInfo && (
                <div className="text-xs text-gray-400 text-center">
                    Conectado a: {chatwootBaseUrl}
                    {user?.email && ` • Usuario: ${user.email}`}
                    {mode === "sso" && chatwootConfig?.chatwoot_user_id && ` • Chatwoot ID: ${chatwootConfig.chatwoot_user_id}`}
                </div>
            )}
        </div>
    );
}
