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
import { Zap, MessageSquareText } from "lucide-react";
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
  /** Text typed after the "/" trigger, used to filter the list. */
  query: string;
  tenantId?: number;
  /** Receives the full response so the caller can both insert text and "arm" its actions. */
  onSelect: (response: CannedResponse) => void;
  onClose: () => void;
}

export const CannedResponsePicker = forwardRef<
  CannedResponsePickerHandle,
  CannedResponsePickerProps
>(function CannedResponsePicker({ open, query, tenantId, onSelect, onClose }, ref) {
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [rawActiveIndex, setRawActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch the (account-scoped) catalog once each time the picker opens.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getCannedResponses({ tenantId }, controller.signal)
      .then((result) => setItems(result.data ?? []))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Error fetching canned responses:", err);
        setItems([]);
      });
    return () => controller.abort();
  }, [open, tenantId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [items, query]);

  // Clamp the highlighted index into range as the filtered list changes, without
  // a setState-in-effect (which can cascade renders). The raw state is reset to 0
  // by the input handlers; clamping covers list shrink while typing.
  const activeIndex = filtered.length === 0 ? 0 : Math.min(rawActiveIndex, filtered.length - 1);

  const select = useCallback(
    (item: CannedResponse | undefined) => {
      if (!item) return;
      onSelect(item);
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

  // Imperative keyboard handling (focus stays on the composer textarea).
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
            } else {
              // No matches: dismiss the picker instead of letting the composer
              // send the literal "/command". A second Enter (picker closed) sends.
              onClose();
            }
            return true;
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

  if (!open) return null;

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-[55]" onClick={onClose} aria-hidden />

      <div className="absolute bottom-full left-0 right-0 mx-3 mb-2 z-[60] rounded-lg border border-border/60 bg-popover shadow-lg overflow-hidden">
        <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
              <MessageSquareText className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {items.length === 0
                  ? "No hay respuestas rápidas."
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
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-primary truncate">/{item.short_code}</p>
                  {item.actions?.length > 0 && (
                    <Zap className="h-3 w-3 text-volt shrink-0" aria-label="Tiene acciones" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{item.content}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
});
