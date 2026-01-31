"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    MessageSquare,
    ExternalLink,
    RefreshCw,
    Maximize2,
    Minimize2,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chatwoot Integration Page with SSO
 *
 * Esta página integra Chatwoot directamente en el dashboard de Ventia.
 * Utiliza SSO para autenticar automáticamente al usuario.
 * El proxy nginx elimina X-Frame-Options para permitir el embedding.
 */

interface ChatwootConfig {
    configured: boolean;
    chatwoot_user_id: number | null;
    chatwoot_account_id: number | null;
}

interface SSOResponse {
    url: string;
}

export default function ChatwootPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [ssoUrl, setSsoUrl] = useState<string | null>(null);
    const [chatwootConfig, setChatwootConfig] = useState<ChatwootConfig | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Get Chatwoot URL from environment variables (fallback)
    const chatwootBaseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "";

    // Fetch Chatwoot configuration for current user
    const fetchChatwootConfig = useCallback(async () => {
        try {
            const response = await fetch("/api/chatwoot/config");

            if (response.ok) {
                const config: ChatwootConfig = await response.json();
                setChatwootConfig(config);
                return config;
            }
        } catch (err) {
            console.error("Error fetching Chatwoot config:", err);
        }
        return null;
    }, []);

    // Fetch SSO URL from backend
    const fetchSSOUrl = useCallback(async (userId: number | null | undefined) => {
        if (!userId) {
            throw new Error("No se puede obtener SSO: user_id es obligatorio");
        }
        try {
            const url = `/api/chatwoot/sso/${userId}`;
            const response = await fetch(url);

            if (response.ok) {
                const data: SSOResponse = await response.json();
                return data.url;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.detail?.detail || errorData.error || "Error al obtener SSO");
            }
        } catch (err) {
            console.error("Error fetching SSO URL:", err);
            throw err;
        }
    }, []);

    // Initialize Chatwoot with SSO
    const initializeChatwoot = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // First check config
            const config = await fetchChatwootConfig();

            if (!config?.configured) {
                setError("Tu cuenta no está configurada para Chatwoot. Contacta al administrador.");
                setIsLoading(false);
                return;
            }

            // Get SSO URL
            const url = await fetchSSOUrl(config?.chatwoot_user_id);
            if (url) {
                setSsoUrl(url);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al conectar con Chatwoot");
        } finally {
            setIsLoading(false);
        }
    }, [fetchChatwootConfig, fetchSSOUrl]);

    useEffect(() => {
        if (!authLoading && user) {
            initializeChatwoot();
        }
    }, [authLoading, user, initializeChatwoot]);

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setError(
            "No se pudo cargar Chatwoot. Verifica que el servicio esté disponible."
        );
        setIsLoading(false);
    };

    const handleRefresh = async () => {
        // Get a new SSO URL and reload
        await initializeChatwoot();
        if (iframeRef.current && ssoUrl) {
            iframeRef.current.src = ssoUrl;
        }
    };

    const handleOpenExternal = async () => {
        try {
            const url = await fetchSSOUrl(chatwootConfig?.chatwoot_user_id);
            if (url) {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        } catch {
            // Fallback to base URL
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
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                        Chatwoot
                    </h1>
                    <p className="text-gray-500">
                        Centro de mensajería y atención al cliente
                    </p>
                </div>

                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="text-yellow-800 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Configuración Requerida
                        </CardTitle>
                        <CardDescription className="text-yellow-700">
                            Chatwoot no está configurado en este momento.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-yellow-800 space-y-4">
                        <p>
                            Para habilitar la integración con Chatwoot, necesitas configurar
                            las siguientes variables de entorno:
                        </p>
                        <div className="bg-yellow-100 p-4 rounded-lg font-mono text-sm">
                            <p>NEXT_PUBLIC_CHATWOOT_BASE_URL=http://localhost:3001</p>
                            <p>NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID=1</p>
                        </div>
                    </CardContent>
                </Card>
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

    // User not configured for Chatwoot
    if (chatwootConfig && !chatwootConfig.configured) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                        Chatwoot
                    </h1>
                    <p className="text-gray-500">
                        Centro de mensajería y atención al cliente
                    </p>
                </div>

                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-800 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Cuenta no configurada
                        </CardTitle>
                        <CardDescription className="text-orange-700">
                            Tu cuenta no está vinculada a Chatwoot.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-orange-800 space-y-4">
                        <p>
                            Para acceder a Chatwoot, un administrador debe configurar tu
                            cuenta con los siguientes datos:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>ID de usuario de Chatwoot</li>
                            <li>ID de cuenta de Chatwoot</li>
                        </ul>
                        <p className="text-sm">
                            Contacta al administrador del sistema para completar la configuración.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div
            className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : ""}`}
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-blue-600" />
                        Chatwoot
                    </h1>
                    <p className="text-gray-500">
                        Centro de mensajería y atención al cliente
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                        />
                        Actualizar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="gap-2"
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenExternal}
                        className="gap-2"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Abrir en nueva pestaña
                    </Button>
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
                className={`relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ${isFullscreen
                    ? "h-[calc(100vh-120px)]"
                    : "h-[calc(100vh-220px)] min-h-[500px]"
                    }`}
            >
                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
                        <div className="text-center space-y-4">
                            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                            <p className="text-gray-500">Conectando con Chatwoot...</p>
                        </div>
                    </div>
                )}

                {/* Iframe with SSO URL */}
                {ssoUrl && !error && (
                    <iframe
                        ref={iframeRef}
                        src={ssoUrl}
                        title="Chatwoot"
                        className="w-full h-full border-0"
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                        allow="microphone; camera; geolocation; notifications"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
                    />
                )}
            </div>

            {/* Footer info */}
            <div className="text-xs text-gray-400 text-center">
                Conectado a: {chatwootBaseUrl}
                {user?.email && ` • Usuario: ${user.email}`}
                {chatwootConfig?.chatwoot_user_id && ` • Chatwoot ID: ${chatwootConfig.chatwoot_user_id}`}
            </div>
        </div>
    );
}
