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
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { connectWhatsApp, connectWhatsAppManually } from "@/lib/api-client/messaging";
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

function SuccessView({
  result,
  onGoToConversations,
}: {
  result: WhatsAppConnectResponse["data"];
  onGoToConversations: () => void;
}) {
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
          <Button className="w-full" onClick={onGoToConversations}>
            Ir a Conversaciones
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ManualConnectForm({
  onSuccess,
  onError,
}: {
  onSuccess: (data: WhatsAppConnectResponse["data"]) => void;
  onError: (message: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    api_key: "",
    phone_number_id: "",
    business_account_id: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const sanitizedPhone = form.phone_number.replace(/[\s\-()]/g, "");
  const isPhoneClean = /^\+[1-9]\d{7,14}$/.test(form.phone_number.trim());
  const isPhoneValid = /^\+[1-9]\d{7,14}$/.test(sanitizedPhone);
  const showPhoneError = form.phone_number.trim() !== "" && (!isPhoneValid || !isPhoneClean);

  const isValid =
    isPhoneClean &&
    form.api_key.trim() !== "" &&
    form.phone_number_id.trim() !== "" &&
    form.business_account_id.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = (await connectWhatsAppManually({
        name: form.name || undefined,
        phone_number: sanitizedPhone,
        api_key: form.api_key,
        phone_number_id: form.phone_number_id,
        business_account_id: form.business_account_id,
      })) as { success: boolean; data: WhatsAppConnectResponse["data"] };

      onSuccess(response.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al conectar WhatsApp");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del inbox (opcional)</Label>
        <Input
          id="name"
          placeholder="Mi WhatsApp Business"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone_number">Numero de telefono</Label>
        <Input
          id="phone_number"
          placeholder="+51987654321"
          value={form.phone_number}
          onChange={(e) => handleChange("phone_number", e.target.value)}
          required
        />
        {showPhoneError ? (
          <p className="text-xs text-destructive">Ingresa un número válido con código de país (ej: +51941190666), sin espacios</p>
        ) : (
          <p className="text-xs text-muted-foreground">Formato E.164 con código de país (ej: +51941190666)</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="api_key">API Key (Access Token)</Label>
        <Input
          id="api_key"
          type="password"
          placeholder="EAAxxxxxxx..."
          value={form.api_key}
          onChange={(e) => handleChange("api_key", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone_number_id">Phone Number ID</Label>
          <Input
            id="phone_number_id"
            placeholder="1234567890"
            value={form.phone_number_id}
            onChange={(e) => handleChange("phone_number_id", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_account_id">Business Account ID</Label>
          <Input
            id="business_account_id"
            placeholder="9876543210"
            value={form.business_account_id}
            onChange={(e) => handleChange("business_account_id", e.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Encuentra estos valores en tu{" "}
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Meta Developer Dashboard
        </a>
        .
      </p>
      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Settings className="mr-2 h-4 w-4" />
        )}
        {isSubmitting ? "Conectando..." : "Conectar manualmente"}
      </Button>
    </form>
  );
}

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

  const handleManualSuccess = (data: WhatsAppConnectResponse["data"]) => {
    setResult(data);
    setStatus("success");
  };

  const handleManualError = (message: string) => {
    setErrorMessage(message);
    setStatus("error");
  };

  const isLoading = status === "loading-sdk" || status === "authenticating" || status === "connecting";

  if (status === "success" && result) {
    return (
      <SuccessView
        result={result}
        onGoToConversations={() => router.push("/dashboard/conversations")}
      />
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

          <Tabs defaultValue="embedded">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="embedded">Conexion automatica</TabsTrigger>
              <TabsTrigger value="manual">Conexion manual</TabsTrigger>
            </TabsList>

            <TabsContent value="embedded" className="space-y-6 pt-4">
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
            </TabsContent>

            <TabsContent value="manual" className="pt-4">
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  Usa esta opcion si ya tienes tus credenciales de WhatsApp Cloud API. Necesitaras tu Access Token, Phone Number ID y Business Account ID del Meta Developer Dashboard.
                </p>
              </div>
              <ManualConnectForm
                onSuccess={handleManualSuccess}
                onError={handleManualError}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
