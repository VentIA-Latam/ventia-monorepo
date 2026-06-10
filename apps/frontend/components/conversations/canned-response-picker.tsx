"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Input } from "@/components/ui/input";
import { Search, Settings, MessageSquareText } from "lucide-react";
import { getCannedResponses } from "@/lib/api-client/messaging";
import { cn } from "@/lib/utils";
import type { CannedResponse } from "@/lib/types/messaging";

export interface CannedResponsePickerHandle {
  /** Handle a key event coming from the composer textarea.
   *  Returns true if the picker consumed it (caller should preventDefault). */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

interface CannedResponsePickerProps {
  open: boolean;
  /** Filter text. In "trigger" mode this is the text typed after "/". */
  query: string;
  mode: "trigger" | "button";
  tenantId?: number;
  canManage: boolean;
  onSelect: (content: string) => void;
  onClose: () => void;
  onManage: () => void;
}

export const CannedResponsePicker = forwardRef<
  CannedResponsePickerHandle,
  CannedResponsePickerProps
>(function CannedResponsePicker(
  { open, query, mode, tenantId, canManage, onSelect, onClose, onManage },
  ref
) {
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [internalSearch, setInternalSearch] = useState("");
  const [rawActiveIndex, setRawActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch the (account-scoped) catalog once each time the picker opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCannedResponses({ tenantId })
      .then((result) => {
        if (!cancelled) setItems(result.data ?? []);
      })
      .catch((err) => {
        console.error("Error fetching canned responses:", err);
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  const effectiveQuery = mode === "trigger" ? query : internalSearch;

  const filtered = useMemo(() => {
    const q = effectiveQuery.trim().toLowerCase();
    if (!q) return items;
    // Prioritise short_code prefix matches, then any substring match.
    return items
      .filter(
        (r) => r.short_code.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const ap = a.short_code.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.short_code.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.short_code.localeCompare(b.short_code);
      });
  }, [items, effectiveQuery]);

  // Clamp the highlighted index into range as the filtered list changes, without
  // a setState-in-effect (which can cascade renders). The raw state is reset to 0
  // by the input handlers; clamping covers list shrink while typing in "/" mode.
  const activeIndex = filtered.length === 0 ? 0 : Math.min(rawActiveIndex, filtered.length - 1);

  const select = useCallback(
    (item: CannedResponse | undefined) => {
      if (!item) return;
      onSelect(item.content);
    },
    [onSelect]
  );

  const move = useCallback(
    (delta: number) => {
      if (filtered.length === 0) return;
      const next = (activeIndex + delta + filtered.length) % filtered.length;
      setRawActiveIndex(next);
      // Scroll the newly active row into view.
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector(`[data-index="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    },
    [filtered.length, activeIndex]
  );

  // Imperative keyboard handling for "trigger" mode (focus stays on textarea).
  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown: (e: React.KeyboardEvent) => {
        if (!open) return false;
        switch (e.key) {
          case "ArrowDown":
            move(1);
            return true;
          case "ArrowUp":
            move(-1);
            return true;
          case "Enter":
            if (filtered.length > 0) {
              select(filtered[activeIndex]);
              return true;
            }
            return false;
          case "Escape":
            onClose();
            return true;
          default:
            return false;
        }
      },
    }),
    [open, move, select, filtered, activeIndex, onClose]
  );

  // Local keyboard handling for "button" mode (focus is on the search input).
  const handleLocalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        select(filtered[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [move, select, filtered, activeIndex, onClose]
  );

  if (!open) return null;

  return (
    <>
      {/* Click-away backdrop (button mode mainly; harmless in trigger mode) */}
      <div className="fixed inset-0 z-[55]" onClick={onClose} aria-hidden />

      <div className="absolute bottom-full left-0 right-0 mx-3 mb-2 z-[60] rounded-lg border border-border/60 bg-popover shadow-lg overflow-hidden">
        {mode === "button" && (
          <div className="relative border-b border-border/40 p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar respuesta..."
              value={internalSearch}
              onChange={(e) => {
                setInternalSearch(e.target.value);
                setRawActiveIndex(0);
              }}
              onKeyDown={handleLocalKeyDown}
              className="pl-9 h-9 text-sm border-0 shadow-none focus-visible:ring-0"
            />
          </div>
        )}

        <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
              <MessageSquareText className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {items.length === 0
                  ? "No hay respuestas predefinidas."
                  : "Sin coincidencias."}
              </p>
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                data-index={index}
                type="button"
                onMouseEnter={() => setRawActiveIndex(index)}
                onClick={() => select(item)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 transition-colors",
                  index === activeIndex ? "bg-accent" : "hover:bg-muted/50"
                )}
              >
                <p className="text-sm font-medium text-primary truncate">/{item.short_code}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{item.content}</p>
              </button>
            ))
          )}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={onManage}
            className="flex w-full items-center gap-2 border-t border-border/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Gestionar respuestas
          </button>
        )}
      </div>
    </>
  );
});
