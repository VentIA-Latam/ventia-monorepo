"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus, Radio } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa6";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChannelCard as WhatsAppChannelCard } from "@/components/whatsapp/channel-card";
import { ChannelCard as InstagramChannelCard } from "@/components/instagram/channel-card";
import type {
  WhatsAppChannel,
  InstagramChannel,
  WhatsAppConnectResponse,
} from "@/lib/types/messaging";

const ConnectDialog = dynamic(
  () =>
    import("@/components/whatsapp/connect-dialog").then((m) => ({
      default: m.ConnectDialog,
    })),
  { ssr: false }
);

type Filter = "all" | "whatsapp" | "instagram";

interface ChannelsClientProps {
  whatsappChannels: WhatsAppChannel[];
  instagramChannels: InstagramChannel[];
}

const WA_ACCENT = "#25D366";
const IG_ACCENT = "#d62976";
const IG_GRADIENT =
  "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#962fbf]";
const IG_GRADIENT_ROW =
  "bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#962fbf]";

export function ChannelsClient({
  whatsappChannels: initialWA,
  instagramChannels: initialIG,
}: ChannelsClientProps) {
  const [waChannels, setWaChannels] = useState(initialWA);
  const [igChannels] = useState(initialIG);
  const [filter, setFilter] = useState<Filter>("all");
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Toast + URL cleanup when arriving from an OAuth callback (Instagram) or any
  // future channel that lands back here with ?status=...
  useEffect(() => {
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    if (!status) return;

    const channelName =
      channel === "instagram"
        ? "Instagram"
        : channel === "whatsapp"
          ? "WhatsApp"
          : "Canal";

    if (status === "success") {
      toast({
        title: `${channelName} conectado`,
        description: "Ya puedes empezar a recibir y responder mensajes.",
      });
    } else {
      toast({
        title: `No se pudo conectar ${channelName}`,
        description:
          "Hubo un problema al conectar. Intentalo nuevamente en unos minutos.",
        variant: "destructive",
      });
    }
    router.replace("/dashboard/channels");
  }, [searchParams, toast, router]);

  const handleWhatsappSuccess = useCallback(
    (data: WhatsAppConnectResponse["data"]) => {
      setWaChannels((prev) => [
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
      setWhatsappDialogOpen(false);
    },
    []
  );

  const connectInstagram = useCallback(() => {
    window.location.assign("/dashboard/instagram-connect/consent");
  }, []);

  const totalChannels = waChannels.length + igChannels.length;
  const isEmpty = totalChannels === 0;

  if (isEmpty) {
    return (
      <>
        <EmptyState
          onConnectWhatsapp={() => setWhatsappDialogOpen(true)}
          onConnectInstagram={connectInstagram}
        />
        {whatsappDialogOpen ? (
          <ConnectDialog
            open={whatsappDialogOpen}
            onOpenChange={setWhatsappDialogOpen}
            onSuccess={handleWhatsappSuccess}
          />
        ) : null}
      </>
    );
  }

  const showWA = filter === "all" || filter === "whatsapp";
  const showIG = filter === "all" || filter === "instagram";
  const hasBoth = waChannels.length > 0 && igChannels.length > 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2.5">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-volt/15 ring-1 ring-volt/30">
              <Radio className="h-5 w-5 text-volt" strokeWidth={2.5} />
            </span>
            Canales
          </h1>
          <p className="text-sm text-muted-foreground mt-2 ml-0.5">
            {totalChannels === 1
              ? "1 canal conectado"
              : `${totalChannels} canales conectados`}{" "}
            · Gestiona todas tus integraciones de mensajería desde aquí
          </p>
        </div>
        <ConnectChannelButton
          onConnectWhatsapp={() => setWhatsappDialogOpen(true)}
          onConnectInstagram={connectInstagram}
        />
      </header>

      {/* Filter pills (only when there's a mix of channel types) */}
      {hasBoth ? (
        <div data-testid="channels-filter-pills" className="flex items-center gap-2 flex-wrap">
          <FilterPill
            testId="filter-pill-all"
            active={filter === "all"}
            onClick={() => setFilter("all")}
            count={totalChannels}
          >
            Todos
          </FilterPill>
          <FilterPill
            testId="filter-pill-whatsapp"
            active={filter === "whatsapp"}
            onClick={() => setFilter("whatsapp")}
            count={waChannels.length}
            accent={WA_ACCENT}
          >
            <FaWhatsapp className="h-3.5 w-3.5" /> WhatsApp
          </FilterPill>
          <FilterPill
            testId="filter-pill-instagram"
            active={filter === "instagram"}
            onClick={() => setFilter("instagram")}
            count={igChannels.length}
            accent={IG_ACCENT}
          >
            <FaInstagram className="h-3.5 w-3.5" /> Instagram
          </FilterPill>
        </div>
      ) : null}

      {/* Channels grid */}
      <div data-testid="channels-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {showWA
          ? waChannels.map((c) => (
              <div
                key={`wa-${c.id}`}
                data-testid={`channel-card-wa-${c.id}`}
                data-channel-kind="whatsapp"
              >
                <WhatsAppChannelCard channel={c} />
              </div>
            ))
          : null}
        {showIG
          ? igChannels.map((c) => (
              <div
                key={`ig-${c.id}`}
                data-testid={`channel-card-ig-${c.id}`}
                data-channel-kind="instagram"
              >
                <InstagramChannelCard channel={c} />
              </div>
            ))
          : null}
      </div>

      {whatsappDialogOpen ? (
        <ConnectDialog
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
          onSuccess={handleWhatsappSuccess}
        />
      ) : null}
    </div>
  );
}

// --- Connect Channel dropdown ---

interface ConnectChannelButtonProps {
  onConnectWhatsapp: () => void;
  onConnectInstagram: () => void;
}

function ConnectChannelButton({
  onConnectWhatsapp,
  onConnectInstagram,
}: ConnectChannelButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid="connect-channel-button" className="bg-volt hover:bg-volt/90 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Conectar canal
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuItem
          data-testid="connect-dropdown-whatsapp"
          onClick={onConnectWhatsapp}
          className="gap-3 cursor-pointer p-2.5 rounded-md focus:bg-muted/60"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] shrink-0">
            <FaWhatsapp className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">WhatsApp</p>
            <p className="text-xs text-muted-foreground">Business Cloud API</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="connect-dropdown-instagram"
          onClick={onConnectInstagram}
          className={cn(
            "gap-3 cursor-pointer p-2.5 rounded-md focus:bg-muted/60"
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
              IG_GRADIENT
            )}
          >
            <FaInstagram className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Instagram</p>
            <p className="text-xs text-muted-foreground">Direct Messages</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Filter pill ---

interface FilterPillProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
  accent?: string;
  testId?: string;
}

function FilterPill({
  children,
  active,
  onClick,
  count,
  accent,
  testId,
}: FilterPillProps) {
  // When active without a brand accent, fall back to bg-foreground (Tailwind v4
  // with oklch tokens — using inline `hsl(var(--foreground))` would be invalid).
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? cn(
              "border-transparent text-white shadow-sm",
              !accent && "bg-foreground"
            )
          : "border-border bg-card hover:border-foreground/30 hover:bg-muted/50 text-foreground"
      )}
      style={active && accent ? { backgroundColor: accent } : undefined}
    >
      <span className="inline-flex items-center gap-1.5">{children}</span>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none min-w-[1.25rem] h-5",
          active ? "bg-white/20 text-white" : "bg-muted/60 text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// --- Empty state ---

interface EmptyStateProps {
  onConnectWhatsapp: () => void;
  onConnectInstagram: () => void;
}

function EmptyState({
  onConnectWhatsapp,
  onConnectInstagram,
}: EmptyStateProps) {
  return (
    <div
      data-testid="channels-empty-state"
      className="mx-auto max-w-5xl flex items-center justify-center min-h-[calc(100vh-12rem)] py-8"
    >
      <div className="w-full space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-volt/15 ring-1 ring-volt/30">
            <Radio className="h-8 w-8 text-volt" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-volt animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
            Centra tu mensajería
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Conecta los canales por los que tus clientes te escriben. Recibe,
            asigna y responde todo desde un solo lugar — con respuestas
            automáticas de IA cuando lo necesites.
          </p>
        </div>

        {/* Two channel tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChannelTile
            name="WhatsApp Business"
            description="Para conversaciones por WhatsApp"
            accentBarClass="bg-[#25D366]"
            iconBgClass="bg-[#25D366]"
            bulletClass="bg-[#25D366]"
            buttonClass="bg-[#25D366] hover:bg-[#1ebe57] text-white"
            icon={<FaWhatsapp className="h-6 w-6 text-white" />}
            bullets={[
              "Plantillas aprobadas por Meta",
              "Notas de voz, imágenes y documentos",
              "Ventana de respuesta de 24 horas",
            ]}
            ctaLabel="Conectar WhatsApp"
            onClick={onConnectWhatsapp}
          />
          <ChannelTile
            name="Instagram"
            description="Para responder DMs de Instagram"
            accentBarClass={IG_GRADIENT_ROW}
            iconBgClass={IG_GRADIENT}
            bulletClass="bg-[#d62976]"
            buttonClass={cn(IG_GRADIENT_ROW, "hover:opacity-90 text-white")}
            icon={<FaInstagram className="h-6 w-6 text-white" />}
            bullets={[
              "Texto, fotos y notas de voz",
              "Respuestas a historias",
              "Ventana de respuesta de 7 días",
            ]}
            ctaLabel="Conectar Instagram"
            onClick={onConnectInstagram}
          />
        </div>

        {/* Future channels hint */}
        <p className="text-center text-xs text-muted-foreground tracking-wide">
          Más canales próximamente · Messenger · Telegram · SMS
        </p>
      </div>
    </div>
  );
}

interface ChannelTileProps {
  name: string;
  description: string;
  accentBarClass: string;
  iconBgClass: string;
  bulletClass: string;
  buttonClass: string;
  icon: React.ReactNode;
  bullets: string[];
  ctaLabel: string;
  onClick: () => void;
}

function ChannelTile({
  name,
  description,
  accentBarClass,
  iconBgClass,
  bulletClass,
  buttonClass,
  icon,
  bullets,
  ctaLabel,
  onClick,
}: ChannelTileProps) {
  return (
    <Card className="overflow-hidden flex flex-col group transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className={cn("h-1", accentBarClass)} />
      <div className="p-6 flex-1 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl shrink-0",
              iconBgClass
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "h-1 w-1 rounded-full shrink-0 mt-2",
                  bulletClass
                )}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button onClick={onClick} className={cn("mt-auto w-full", buttonClass)}>
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
}
