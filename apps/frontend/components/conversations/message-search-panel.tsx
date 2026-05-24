"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchMessages } from "@/lib/api-client/messaging";
import type { MessageSearchResult, MessageStatus } from "@/lib/types/messaging";
import { parseTimestamp } from "@/lib/utils/messaging";
import { useToast } from "@/hooks/use-toast";

function StatusIcon({ status }: { status?: MessageStatus }) {
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-primary shrink-0" />;
    default:
      return null;
  }
}

interface MessageSearchPanelProps {
  conversationId: number | string;
  tenantId?: number;
  onClose: () => void;
  onResultClick: (messageId: number | string) => void;
}

function formatResultDate(dateValue: string | number): string {
  const date = parseTimestamp(dateValue);
  if (!date) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startOfMsg === startOfToday) return "Hoy";
  if (startOfMsg === startOfYesterday) return "Ayer";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function MessageSearchPanel({ conversationId, tenantId, onClose, onResultClick }: MessageSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchMessages(conversationId, query, tenantId);
        if (!cancelled) setResults(res.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          toast({ title: "Error al buscar mensajes", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, conversationId, tenantId]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar mensajes"
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-10 w-full md:relative md:inset-auto md:z-auto md:w-[320px] md:shrink-0 flex flex-col h-full border-l border-border/30 bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-muted/30 shrink-0 min-h-[53px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Cerrar búsqueda"
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="text-[15px] font-medium">Buscar mensajes</span>
      </div>

      {/* Search input */}
      <div className="px-3 py-2.5 shrink-0 border-b border-border/30">
        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 focus-within:border-primary transition-colors">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Buscando...</span>
          </div>
        )}

        {!isSearching && !query.trim() && (
          <p className="text-xs text-muted-foreground text-center py-10 px-4">
            Escribe para buscar en esta conversación
          </p>
        )}

        {!isSearching && query.trim() && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10 px-4">
            Sin resultados para &ldquo;{query}&rdquo;
          </p>
        )}

        {!isSearching && results.map((result) => (
          <button
            key={result.id}
            onClick={() => onResultClick(result.id)}
            className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/20 transition-colors"
          >
            <p className="text-xs text-muted-foreground mb-0.5">
              {formatResultDate(result.created_at)}
            </p>
            <div className="flex items-center gap-1">
              {result.message_type === "outgoing" && (
                <StatusIcon status={result.status} />
              )}
              <p
                className="text-sm [&_mark]:bg-transparent [&_mark]:text-primary [&_mark]:font-medium line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.snippet ?? "" }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
