"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    MessageSquare,
    ExternalLink,
    RefreshCw,
    Maximize2,
    Minimize2,
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
 * Chatwoot Integration Page
 *
 * Esta página integra Chatwoot directamente en el dashboard de Ventia.
 * Utiliza un iframe para mostrar la interfaz de Chatwoot.
 * El proxy nginx elimina X-Frame-Options para permitir el embedding.
 */

export default function ChatwootPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Get Chatwoot URL from environment variables
    const chatwootBaseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "";
    const chatwootAccountId = process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || "";

    // Build the Chatwoot dashboard URL
    const getChatwootUrl = () => {
        if (!chatwootBaseUrl) {
            return null;
        }

        if (chatwootAccountId) {
            return `${chatwootBaseUrl}/app/accounts/${chatwootAccountId}/dashboard`;
        }

        return `${chatwootBaseUrl}/app`;
    };

    const chatwootUrl = getChatwootUrl();

    useEffect(() => {
        if (!chatwootBaseUrl) {
            setError("Chatwoot no está configurado. Contacta al administrador.");
            setIsLoading(false);
            return;
        }

        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [chatwootBaseUrl]);

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setError(
            "No se pudo cargar Chatwoot. Verifica que el servicio esté disponible."
        );
        setIsLoading(false);
    };

    const handleRefresh = () => {
        setIsLoading(true);
        setError(null);
        if (iframeRef.current) {
            iframeRef.current.src = chatwootUrl || "";
        }
    };

    const handleOpenExternal = () => {
        if (chatwootUrl) {
            window.open(chatwootUrl, "_blank", "noopener,noreferrer");
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Si no hay URL configurada, mostrar mensaje de configuración
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
                            <p className="text-gray-500">Cargando Chatwoot...</p>
                        </div>
                    </div>
                )}

                {/* Iframe */}
                {chatwootUrl && !error && (
                    <iframe
                        ref={iframeRef}
                        src={chatwootUrl}
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
            </div>
        </div>
    );
}
