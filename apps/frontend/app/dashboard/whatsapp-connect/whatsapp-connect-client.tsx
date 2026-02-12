"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  CheckCircle2,
  Loader2,
  LogIn,
  FileText,
  Link2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { connectWhatsApp } from "@/lib/api-client/messaging";
import {
  setupFacebookSdk,
  initWhatsAppEmbeddedSignup,
  createMessageHandler,
  isValidBusinessData,
  type BusinessData,
  type EmbeddedSignupData,
} from "@/lib/whatsapp/facebook-sdk";
import type { WhatsAppConnectResponse } from "@/lib/types/messaging";

type FlowStatus = "idle" | "loading-sdk" | "authenticating" | "connecting" | "success" | "error";

const STEPS = [
  {
    icon: LogIn,
    title: "Conecta e inicia sesion",
    description: "Inicia sesion con tu cuenta de Meta Business.",
  },
  {
    icon: FileText,
    title: "Completa los datos",
    description: "Portafolio, empresa, sitio web y categoria.",
  },
  {
    icon: Link2,
    title: "Elige tipo de conexion",
    description: 'Recomendamos "Vincular cuenta de WhatsApp Business".',
  },
  {
    icon: ShieldCheck,
    title: "Verifica tu numero",
    description: "Via SMS, llamada o QR segun indique Meta.",
  },
];

export function WhatsAppConnectClient() {
  const router = useRouter();
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<WhatsAppConnectResponse["data"] | null>(null);

  const authCodeRef = useRef<string | null>(null);
  const businessDataRef = useRef<BusinessData | null>(null);
  const connectingRef = useRef(false);

  const completeSignup = useCallback(async () => {
    const code = authCodeRef.current;
    const data = businessDataRef.current;

    if (!code || !data || connectingRef.current) return;
    connectingRef.current = true;

    setStatus("connecting");

    try {
      const response = await connectWhatsApp({
        code,
        business_id: data.business_id,
        waba_id: data.waba_id,
        phone_number_id: data.phone_number_id,
      });

      setResult(response.data);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al conectar WhatsApp";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const handleEmbeddedSignupData = useCallback(
    (signupData: EmbeddedSignupData) => {
      if (signupData.event === "CANCEL") {
        setStatus("idle");
        authCodeRef.current = null;
        businessDataRef.current = null;
        return;
      }

      if (signupData.event === "error") {
        setErrorMessage(signupData.error_message || "Error en el proceso de Facebook");
        setStatus("error");
        return;
      }

      if (
        (signupData.event === "FINISH" ||
          signupData.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") &&
        isValidBusinessData(signupData.data)
      ) {
        businessDataRef.current = signupData.data as BusinessData;

        if (authCodeRef.current) {
          completeSignup();
        }
      }
    },
    [completeSignup]
  );

  useEffect(() => {
    const handler = createMessageHandler(handleEmbeddedSignupData);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleEmbeddedSignupData]);

  const handleConnect = async () => {
    const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
    const configId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID;
    const apiVersion = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION || "v22.0";

    if (!appId || !configId) {
      setErrorMessage("Configuracion de WhatsApp no disponible. Contacta soporte.");
      setStatus("error");
      return;
    }

    authCodeRef.current = null;
    businessDataRef.current = null;
    connectingRef.current = false;

    try {
      setStatus("loading-sdk");
      await setupFacebookSdk(appId, apiVersion);

      setStatus("authenticating");
      const code = await initWhatsAppEmbeddedSignup(configId);

      authCodeRef.current = code;

      if (businessDataRef.current) {
        completeSignup();
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Login cancelled") {
        setStatus("idle");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Error al cargar Facebook SDK");
      setStatus("error");
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    setErrorMessage("");
    authCodeRef.current = null;
    businessDataRef.current = null;
    connectingRef.current = false;
  };

  const isLoading = status === "loading-sdk" || status === "authenticating" || status === "connecting";

  if (status === "success" && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">WhatsApp conectado exitosamente</CardTitle>
            <CardDescription>
              Tu canal de WhatsApp Business esta listo para recibir mensajes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-white p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Numero</span>
                <span className="font-medium">{result.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Inbox</span>
                <span className="font-medium">{result.inbox_name}</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => router.push("/dashboard/conversations")}
            >
              Ir a Conversaciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Conecta tu WhatsApp Business</CardTitle>
              <CardDescription>
                Es el primer paso para empezar a vender con tu vendedor inteligente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-800">Error al conectar</p>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    Reintentar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              {status === "loading-sdk"
                ? "Cargando..."
                : status === "authenticating"
                  ? "Esperando autorizacion..."
                  : status === "connecting"
                    ? "Conectando canal..."
                    : "Conectar WhatsApp"}
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://wa.me/51987654321"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contactar soporte
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <div>
            <Badge variant="secondary" className="mb-3">
              WhatsApp Business API
            </Badge>
            <h3 className="text-lg font-semibold mb-4">Pasos para conectar</h3>
            <div className="space-y-4">
              {STEPS.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
