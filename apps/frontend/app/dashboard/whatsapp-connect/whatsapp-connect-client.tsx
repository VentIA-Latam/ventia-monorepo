"use client";

import { useCallback, useState } from "react";
import {
  MessageSquare,
  Bot,
  Clock,
  Users,
  Smartphone,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelCard } from "@/components/whatsapp/channel-card";
import dynamic from "next/dynamic";
import type { WhatsAppChannel, WhatsAppConnectResponse } from "@/lib/types/messaging";

const ConnectDialog = dynamic(
  () => import("@/components/whatsapp/connect-dialog").then((m) => ({ default: m.ConnectDialog })),
  { ssr: false }
);

const BENEFITS = [
  { icon: Bot, text: "Respuestas automaticas con IA" },
  { icon: Clock, text: "Gestion de ventana de 24 horas" },
  { icon: Users, text: "Soporte multi-agente" },
];

interface WhatsAppConnectClientProps {
  initialChannels: WhatsAppChannel[];
}

export function WhatsAppConnectClient({ initialChannels }: WhatsAppConnectClientProps) {
  const [channels, setChannels] = useState<WhatsAppChannel[]>(initialChannels);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSuccess = useCallback((data: WhatsAppConnectResponse["data"]) => {
    setChannels((prev) => [
      ...prev,
      {
        id: data.channel_id,
        phone_number: data.phone_number,
        provider: "whatsapp_cloud",
        inbox_id: data.inbox_id,
        inbox_name: data.inbox_name,
        templates_count: 0,
        last_template_sync: null,
        reauthorization_required: false,
      },
    ]);
    setDialogOpen(false);
  }, []);

  return (
    <div className="space-y-6">
      {channels.length > 0 ? (
        /* Vista 2: Canales conectados */
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                <Smartphone className="h-6 w-6" />
                Canales de WhatsApp
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona tus numeros de WhatsApp conectados
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="bg-volt hover:bg-volt/90 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Conectar numero
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        </>
      ) : (
        /* Vista 1: Sin canales — split card + ilustracion */
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left: info */}
              <div className="flex-1 p-8 flex flex-col justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 mb-5">
                  <MessageSquare className="h-6 w-6 text-green-600" />
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
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 shrink-0">
                        <benefit.icon className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="text-sm">{benefit.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={() => setDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Conectar con Meta
                  </Button>
                </div>
              </div>

              {/* Right: WhatsApp chat illustration */}
              <div className="hidden md:flex w-[380px] items-center justify-center p-8 border-l relative overflow-hidden bg-muted/30">
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-green-500/10 blur-[80px] pointer-events-none" />
                <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-green-500/5 blur-[60px] pointer-events-none" />

                <div
                  className="relative w-[230px] rounded-[2.5rem] bg-black border-[6px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
                  style={{ aspectRatio: "9/18.5" }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-20" />
                  <div className="bg-[#075e54] pt-7 pb-2 px-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                      <Smartphone className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white leading-none">Mi Tienda Oficial</p>
                      <p className="text-[8px] text-white/70 leading-none mt-0.5">en linea</p>
                    </div>
                  </div>
                  <div
                    className="flex-1 p-2.5 flex flex-col gap-2 bg-[#0b141a]"
                    style={{ backgroundImage: "radial-gradient(#122017 1px, transparent 1px)", backgroundSize: "16px 16px" }}
                  >
                    <div className="self-start max-w-[85%] bg-[#1f2c33] p-2 rounded-lg rounded-tl-none">
                      <p className="text-[9px] text-slate-200">Hola! En que podemos ayudarte hoy?</p>
                      <p className="text-[7px] text-slate-500 text-right mt-1">10:42 AM</p>
                    </div>
                    <div className="self-end max-w-[85%] bg-[#005c4b] p-2 rounded-lg rounded-tr-none">
                      <p className="text-[9px] text-white">Hola, busco informacion sobre precios.</p>
                      <p className="text-[7px] text-slate-300 text-right mt-1">10:43 AM</p>
                    </div>
                    <div className="self-start max-w-[85%] bg-[#1f2c33] p-2 rounded-lg rounded-tl-none border-l-2 border-green-500">
                      <p className="text-[9px] text-slate-200">
                        <span className="font-bold text-green-400 italic">IA:</span> Claro! Nuestros planes comienzan desde...
                      </p>
                      <p className="text-[7px] text-slate-500 text-right mt-1">10:43 AM</p>
                    </div>
                    <div className="self-end max-w-[85%] bg-[#005c4b] p-2 rounded-lg rounded-tr-none">
                      <p className="text-[9px] text-white">Genial! Quiero el pack de 6</p>
                      <p className="text-[7px] text-slate-300 text-right mt-1">10:44 AM</p>
                    </div>
                  </div>
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
        </div>
      )}

      {/* Dialog — loaded dynamically */}
      {dialogOpen ? (
        <ConnectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleSuccess}
        />
      ) : null}
    </div>
  );
}
