"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { FaWhatsapp, FaMeta } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

type DialogView = "selector" | "meta" | "manual";
type MetaStatus = "idle" | "loading-sdk" | "authenticating" | "connecting";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data: WhatsAppConnectResponse["data"]) => void;
}

// --- Manual Connect Form ---
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
      const response = await connectWhatsAppManually({
        name: form.name || undefined,
        phone_number: sanitizedPhone,
        api_key: form.api_key,
        phone_number_id: form.phone_number_id,
        business_account_id: form.business_account_id,
      });

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
        <Label htmlFor="dlg-name">Nombre del inbox (opcional)</Label>
        <Input id="dlg-name" placeholder="Mi WhatsApp Business" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dlg-phone">Numero de telefono</Label>
        <Input id="dlg-phone" placeholder="+51987654321" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} required />
        {showPhoneError ? (
          <p className="text-xs text-destructive">Ingresa un numero valido con codigo de pais (ej: +51941190666), sin espacios</p>
        ) : (
          <p className="text-xs text-muted-foreground">Formato E.164 con codigo de pais (ej: +51941190666)</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dlg-api-key">API Key (Access Token)</Label>
        <Input id="dlg-api-key" type="password" placeholder="EAAxxxxxxx..." value={form.api_key} onChange={(e) => handleChange("api_key", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dlg-phone-id">Phone Number ID</Label>
          <Input id="dlg-phone-id" placeholder="1234567890" value={form.phone_number_id} onChange={(e) => handleChange("phone_number_id", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dlg-biz-id">Business Account ID</Label>
          <Input id="dlg-biz-id" placeholder="9876543210" value={form.business_account_id} onChange={(e) => handleChange("business_account_id", e.target.value)} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Encuentra estos valores en tu{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">
          Meta Developer Dashboard
        </a>.
      </p>
      <Button type="submit" className="w-full bg-[#16A34A] hover:bg-[#15803D]" disabled={!isValid || isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
        {isSubmitting ? "Conectando..." : "Conectar manualmente"}
      </Button>
    </form>
  );
}

// --- Meta Connect Flow ---
function MetaConnectFlow({
  onSuccess,
  onError,
}: {
  onSuccess: (data: WhatsAppConnectResponse["data"]) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<MetaStatus>("idle");
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
      onSuccess(response.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al conectar WhatsApp");
    } finally {
      connectingRef.current = false;
    }
  }, [onSuccess, onError]);

  const handleEmbeddedSignupData = useCallback(
    (signupData: EmbeddedSignupData) => {
      if (signupData.event === "CANCEL") {
        setStatus("idle");
        authCodeRef.current = null;
        businessDataRef.current = null;
        return;
      }
      if (signupData.event === "error") {
        onError(signupData.error_message || "Error en el proceso de Facebook");
        return;
      }
      if (
        (signupData.event === "FINISH" || signupData.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") &&
        isValidBusinessData(signupData.data)
      ) {
        businessDataRef.current = signupData.data as BusinessData;
        if (authCodeRef.current) completeSignup();
      }
    },
    [completeSignup, onError]
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
      onError("Configuracion de WhatsApp no disponible. Contacta soporte.");
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
      if (businessDataRef.current) completeSignup();
    } catch (err) {
      if (err instanceof Error && err.message === "Login cancelled") {
        setStatus("idle");
        return;
      }
      onError(err instanceof Error ? err.message : "Error al cargar Facebook SDK");
    }
  };

  const isLoading = status !== "idle";
  const statusText =
    status === "loading-sdk" ? "Cargando..." :
    status === "authenticating" ? "Esperando autorizacion..." :
    status === "connecting" ? "Conectando canal..." :
    "Conectar con Meta";

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]">
        <FaWhatsapp className="h-9 w-9 text-white" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          Conecta tu WhatsApp Business con Meta
        </p>
        <p className="text-xs text-muted-foreground">
          Se abrira el asistente de Meta para vincular tu numero de WhatsApp Business.
          El proceso toma menos de 2 minutos.
        </p>
      </div>
      <Button size="lg" onClick={handleConnect} disabled={isLoading} className="bg-[#1877F2] hover:bg-[#1664D9] text-white gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FaMeta className="h-4 w-4" />}
        {statusText}
      </Button>
    </div>
  );
}

// --- Main Dialog ---
export function ConnectDialog({ open, onOpenChange, onSuccess }: ConnectDialogProps) {
  const [view, setView] = useState<DialogView>("selector");
  const [error, setError] = useState("");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setView("selector");
        setError("");
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {view !== "selector" ? (
              <button onClick={() => { setView("selector"); setError(""); }} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div>
              <DialogTitle>
                {view === "selector" ? "Conectar nuevo numero" : view === "meta" ? "Conectar con Meta" : "Conexion manual"}
              </DialogTitle>
              <DialogDescription>
                {view === "selector"
                  ? "Elige como quieres conectar tu WhatsApp Business"
                  : view === "meta"
                    ? "Autoriza la conexion desde tu cuenta de Meta"
                    : "Ingresa las credenciales de WhatsApp Cloud API"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-danger-bg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        ) : null}

        {view === "selector" ? (
          <div className="space-y-3">
            <button
              onClick={() => setView("meta")}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-[#1877F2] bg-[#1877F2]/5 p-4 text-left transition-colors hover:bg-[#1877F2]/10"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1877F2]">
                <FaMeta className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Conectar con Meta</p>
                  <span className="rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-semibold text-[#25D366]">Recomendado</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Proceso guiado. Conecta en minutos con tu cuenta de Meta Business.</p>
              </div>
            </button>
            <button
              onClick={() => setView("manual")}
              className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Conexion manual</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ingresa manualmente tus credenciales de WhatsApp Cloud API.</p>
              </div>
            </button>
          </div>
        ) : view === "meta" ? (
          <MetaConnectFlow onSuccess={onSuccess} onError={handleError} />
        ) : (
          <ManualConnectForm onSuccess={onSuccess} onError={handleError} />
        )}
      </DialogContent>
    </Dialog>
  );
}
