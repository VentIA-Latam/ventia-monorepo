"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Clock, Users, Instagram as InstagramIcon, Plus, Loader2 } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChannelCard } from "@/components/instagram/channel-card";
import type { InstagramChannel } from "@/lib/types/messaging";

const BENEFITS = [
  { icon: Bot, text: "Respuestas automaticas con IA" },
  { icon: Clock, text: "Gestion de la ventana de 24 horas" },
  { icon: Users, text: "Soporte multi-agente" },
];

interface InstagramConnectClientProps {
  initialChannels: InstagramChannel[];
}

export function InstagramConnectClient({ initialChannels }: InstagramConnectClientProps) {
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle the redirect coming back from the OAuth callback (?status=...).
  // The server component re-renders with the latest channels on return.
  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;

    if (status === "success") {
      toast({ title: "Instagram conectado", description: "Tu cuenta de Instagram se conecto correctamente." });
    } else {
      toast({
        title: "No se pudo conectar Instagram",
        description: "Hubo un problema al conectar tu cuenta. Intentalo nuevamente.",
        variant: "destructive",
      });
    }
    router.replace("/dashboard/instagram-connect");
  }, [searchParams, toast, router]);

  // Full-page navigation to the consent route handler (server-side redirect to
  // Instagram). Same tab avoids popup blockers; OAuth returns here with ?status.
  const handleConnect = useCallback(() => {
    setConnecting(true);
    window.location.assign("/dashboard/instagram-connect/consent");
  }, []);

  return (
    <div className="space-y-6">
      {initialChannels.length > 0 ? (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                <InstagramIcon className="h-6 w-6" />
                Canales de Instagram
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona tus cuentas de Instagram conectadas
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#962fbf] hover:opacity-90 text-white"
            >
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {connecting ? "Conectando..." : "Conectar cuenta"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {initialChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-4xl flex items-center justify-center min-h-[calc(100vh-12rem)]">
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-8 flex flex-col justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#962fbf] mb-5">
                  <FaInstagram className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                  Conecta Instagram
                </h1>
                <p className="text-muted-foreground mb-6">
                  Activa tu vendedor inteligente y responde los DMs de Instagram 24/7.
                </p>
                <div className="space-y-3 mb-8">
                  {BENEFITS.map((benefit) => (
                    <div key={benefit.text} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d62976]/10 shrink-0">
                        <benefit.icon className="h-3.5 w-3.5 text-[#d62976]" />
                      </div>
                      <span className="text-sm">{benefit.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#962fbf] hover:opacity-90 text-white"
                  >
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FaInstagram className="mr-2 h-4 w-4" />}
                    {connecting ? "Conectando..." : "Conectar con Instagram"}
                  </Button>
                </div>
              </div>

              <div className="hidden md:flex w-[380px] items-center justify-center p-8 border-l relative overflow-hidden bg-muted/30">
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[#d62976]/10 blur-[80px] pointer-events-none" />
                <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-[#962fbf]/10 blur-[60px] pointer-events-none" />

                <div
                  className="relative w-[230px] rounded-[2.5rem] bg-black border-[6px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
                  style={{ aspectRatio: "9/18.5" }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-20" />
                  <div className="bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#962fbf] pt-7 pb-2 px-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                      <FaInstagram className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white leading-none">mitienda.oficial</p>
                      <p className="text-[8px] text-white/80 leading-none mt-0.5">Activo ahora</p>
                    </div>
                  </div>
                  <div className="flex-1 p-2.5 flex flex-col gap-2 bg-[#0b0b0f]">
                    <div className="self-start max-w-[85%] bg-[#262626] p-2 rounded-2xl rounded-tl-sm">
                      <p className="text-[9px] text-slate-200">Hola! Vi tu publicacion, tienen stock?</p>
                    </div>
                    <div className="self-end max-w-[85%] bg-gradient-to-r from-[#d62976] to-[#962fbf] p-2 rounded-2xl rounded-tr-sm">
                      <p className="text-[9px] text-white">
                        <span className="font-bold italic">IA:</span> Hola! Si, tenemos stock disponible.
                      </p>
                    </div>
                    <div className="self-start max-w-[85%] bg-[#262626] p-2 rounded-2xl rounded-tl-sm">
                      <p className="text-[9px] text-slate-200">Genial, quiero 2 unidades</p>
                    </div>
                    <div className="self-end max-w-[85%] bg-gradient-to-r from-[#d62976] to-[#962fbf] p-2 rounded-2xl rounded-tr-sm">
                      <p className="text-[9px] text-white">Perfecto, te comparto el link de pago</p>
                    </div>
                  </div>
                  <div className="p-2 bg-[#0b0b0f] flex items-center gap-1.5 border-t border-zinc-800">
                    <div className="flex-1 bg-[#262626] rounded-full h-6 px-3 flex items-center">
                      <p className="text-[8px] text-slate-400 italic">Mensaje...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
