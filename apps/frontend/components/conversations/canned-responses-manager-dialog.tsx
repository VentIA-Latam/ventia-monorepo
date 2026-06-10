"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, ArrowLeft, Pencil, Trash2, MessageSquareText, Smile } from "lucide-react";
import {
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from "@/lib/api-client/messaging";
import { ClientApiError } from "@/lib/api-client/client";
import { useToast } from "@/hooks/use-toast";
import type { CannedResponse } from "@/lib/types/messaging";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface CannedResponsesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: number;
  /** Notifies the parent (picker) that the catalog changed so it can refresh. */
  onChanged?: () => void;
}

type View = "list" | "form";

export function CannedResponsesManagerDialog({
  open,
  onOpenChange,
  tenantId,
  onChanged,
}: CannedResponsesManagerDialogProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [shortCode, setShortCode] = useState("");
  const [content, setContent] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CannedResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCannedResponses({ tenantId });
      setItems(result.data ?? []);
    } catch (err) {
      console.error("Error fetching canned responses:", err);
      toast({ title: "No se pudieron cargar las respuestas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  // Reset to a clean list view every time the dialog opens.
  useEffect(() => {
    if (open) {
      setView("list");
      setSearch("");
      setEditing(null);
      fetchItems();
    }
  }, [open, fetchItems]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (r) => r.short_code.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setShortCode("");
    setContent("");
    setEmojiOpen(false);
    setView("form");
  }, []);

  const openEdit = useCallback((item: CannedResponse) => {
    setEditing(item);
    setShortCode(item.short_code);
    setContent(item.content);
    setEmojiOpen(false);
    setView("form");
  }, []);

  // Insert an emoji at the current caret position within the content textarea.
  const insertEmoji = useCallback(
    (emojiData: { emoji: string }) => {
      const ta = contentRef.current;
      const emoji = emojiData.emoji;
      if (!ta) {
        setContent((prev) => prev + emoji);
      } else {
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        setContent((prev) => prev.slice(0, start) + emoji + prev.slice(end));
        requestAnimationFrame(() => {
          const pos = start + emoji.length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
        });
      }
      setEmojiOpen(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const code = shortCode.trim();
    const body = content.trim();
    if (!code || !body) {
      toast({ title: "Completa el atajo y el contenido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCannedResponse(editing.id, { short_code: code, content: body }, tenantId);
      } else {
        await createCannedResponse({ short_code: code, content: body }, tenantId);
      }
      await fetchItems();
      onChanged?.();
      setView("list");
    } catch (err) {
      const friendly =
        err instanceof ClientApiError && err.message
          ? err.message
          : "No se pudo guardar la respuesta.";
      toast({ title: "Error al guardar", description: friendly, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [shortCode, content, editing, tenantId, fetchItems, onChanged, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCannedResponse(deleteTarget.id, tenantId);
      await fetchItems();
      onChanged?.();
      setDeleteTarget(null);
    } catch (err) {
      const friendly =
        err instanceof ClientApiError && err.message
          ? err.message
          : "No se pudo eliminar la respuesta.";
      toast({ title: "Error al eliminar", description: friendly, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, tenantId, fetchItems, onChanged, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            {view === "form" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setView("list")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-base">
              {view === "form"
                ? editing
                  ? "Editar respuesta"
                  : "Nueva respuesta"
                : "Respuestas predefinidas"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === "list" ? (
          <>
            {/* Search + create */}
            <div className="px-4 pb-2 flex gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar respuesta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Button className="h-9 shrink-0 gap-1" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<MessageSquareText className="h-6 w-6" />}
                  title="Sin respuestas"
                  description={
                    search
                      ? "No hay respuestas que coincidan con la búsqueda."
                      : "Aún no hay respuestas predefinidas. Crea la primera con el botón Nueva."
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filtered.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-start gap-2 rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate">/{item.short_code}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(item)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Form */
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-short-code">Atajo</Label>
              <Input
                autoFocus
                id="cr-short-code"
                placeholder="saludo"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Se invoca escribiendo <span className="font-mono">/{shortCode || "atajo"}</span> en el chat.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-content">Contenido</Label>
              <div className="relative">
                <Textarea
                  ref={contentRef}
                  id="cr-content"
                  placeholder="Escribe el texto de la respuesta..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="text-sm resize-none pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Insertar emoji"
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setView("list")} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear"}
              </Button>
            </div>
          </div>
        )}

        {/* Emoji picker — rendered inside the Dialog subtree (not a portal) so its
            internal scroll isn't blocked by the Dialog's scroll-lock. */}
        {emojiOpen && view === "form" && (
          <>
            <div
              className="absolute inset-0 z-40"
              onClick={() => setEmojiOpen(false)}
              aria-hidden
            />
            <div className="absolute bottom-4 right-4 z-50 shadow-lg rounded-lg overflow-hidden">
              <EmojiPicker onEmojiClick={insertEmoji} width={300} height={360} />
            </div>
          </>
        )}
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar respuesta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-mono">/{deleteTarget?.short_code}</span> de forma
              permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
