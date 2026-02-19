"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  CheckCircle2,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  Settings,
  ChevronDown,
  Bot,
  Clock,
  Users,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const BENEFITS = [
  { icon: Bot, text: "Respuestas automáticas con IA" },
  { icon: Clock, text: "Gestión de ventana de 24 horas" },
  { icon: Users, text: "Soporte multi-agente" },
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

  const [showManual, setShowManual] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Error banner */}
      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Error al conectar</p>
              <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Split card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left: info */}
          <div className="flex-1 p-8 flex flex-col justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40 mb-5">
              <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Conecta WhatsApp Business
            </h1>
            <p className="text-muted-foreground mb-6">
              Activa tu vendedor inteligente y responde clientes 24/7 por WhatsApp.
            </p>
            <div className="space-y-3 mb-8">
              {BENEFITS.map((benefit) => (
                <div key={benefit.text} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 shrink-0">
                    <benefit.icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm">{benefit.text}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                {status === "loading-sdk"
                  ? "Cargando..."
                  : status === "authenticating"
                    ? "Esperando autorización..."
                    : status === "connecting"
                      ? "Conectando canal..."
                      : "Conectar con Meta"}
              </Button>
            </div>
          </div>

          {/* Right: WhatsApp chat illustration */}
          <div className="hidden md:flex w-[380px] items-center justify-center p-8 border-l relative overflow-hidden bg-muted/30 dark:bg-black/20">
            {/* Decorative blurs */}
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-green-500/10 blur-[80px] pointer-events-none" />
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-green-500/5 blur-[60px] pointer-events-none" />

            {/* Phone frame */}
            <div className="relative w-[230px] rounded-[2.5rem] bg-black border-[6px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col" style={{ aspectRatio: "9/18.5" }}>
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-20" />

              {/* WhatsApp header */}
              <div className="bg-[#075e54] pt-7 pb-2 px-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                  <Smartphone className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-white leading-none">Mi Tienda Oficial</p>
                  <p className="text-[8px] text-white/70 leading-none mt-0.5">en línea</p>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 p-2.5 flex flex-col gap-2 bg-[#0b141a]" style={{ backgroundImage: "radial-gradient(#122017 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
                <div className="self-start max-w-[85%] bg-[#1f2c33] p-2 rounded-lg rounded-tl-none">
                  <p className="text-[9px] text-slate-200">Hola! 👋 ¿En qué podemos ayudarte hoy?</p>
                  <p className="text-[7px] text-slate-500 text-right mt-1">10:42 AM</p>
                </div>
                <div className="self-end max-w-[85%] bg-[#005c4b] p-2 rounded-lg rounded-tr-none">
                  <p className="text-[9px] text-white">Hola, busco información sobre precios.</p>
                  <p className="text-[7px] text-slate-300 text-right mt-1">10:43 AM</p>
                </div>
                <div className="self-start max-w-[85%] bg-[#1f2c33] p-2 rounded-lg rounded-tl-none border-l-2 border-green-500">
                  <p className="text-[9px] text-slate-200"><span className="font-bold text-green-400 italic">IA:</span> ¡Claro! Nuestros planes comienzan desde...</p>
                  <p className="text-[7px] text-slate-500 text-right mt-1">10:43 AM</p>
                </div>
                <div className="self-end max-w-[85%] bg-[#005c4b] p-2 rounded-lg rounded-tr-none">
                  <p className="text-[9px] text-white">¡Genial! Quiero el pack de 6 🛒</p>
                  <p className="text-[7px] text-slate-300 text-right mt-1">10:44 AM</p>
                </div>
              </div>

              {/* Chat input */}
              <div className="p-2 bg-[#1f2c33] flex items-center gap-1.5">
                <div className="flex-1 bg-[#2a3942] rounded-full h-6 px-3 flex items-center">
                  <p className="text-[8px] text-slate-400 italic">Escribe un mensaje...</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center">
                  <MessageSquare className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Manual connect - collapsible */}
      <Card>
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Conexión manual</p>
              <p className="text-xs text-muted-foreground">¿Ya tienes tus credenciales de WhatsApp Cloud API?</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showManual ? "rotate-180" : ""}`} />
        </button>
        {showManual && (
          <CardContent className="pt-0 border-t">
            <ManualConnectForm
              onSuccess={handleManualSuccess}
              onError={handleManualError}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
