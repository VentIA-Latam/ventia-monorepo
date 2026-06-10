"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, Pencil, Trash2, MessageSquareText, Smile, Zap } from "lucide-react";
import {
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  getLabels,
} from "@/lib/api-client/messaging";
import { ClientApiError } from "@/lib/api-client/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { CannedResponse, CannedResponseAction, Label as MessagingLabel } from "@/lib/types/messaging";
import { CannedResponseActionsBuilder } from "@/components/conversations/canned-response-actions-builder";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function CannedResponsesClient() {
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  const [items, setItems] = useState<CannedResponse[]>([]);
  const [labels, setLabels] = useState<MessagingLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [shortCode, setShortCode] = useState("");
  const [content, setContent] = useState("");
  const [actions, setActions] = useState<CannedResponseAction[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CannedResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [crResult, labelResult] = await Promise.all([
        getCannedResponses(),
        getLabels().catch(() => ({ success: false, data: [] as MessagingLabel[] })),
      ]);
      setItems(crResult.data ?? []);
      setLabels(labelResult.data ?? []);
    } catch (err) {
      console.error("Error fetching canned responses:", err);
      toast({ title: "No se pudieron cargar las respuestas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
    setActions([]);
    setEmojiOpen(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: CannedResponse) => {
    setEditing(item);
    setShortCode(item.short_code);
    setContent(item.content);
    setActions(item.actions ?? []);
    setEmojiOpen(false);
    setFormOpen(true);
  }, []);

  // Insert an emoji at the current caret position within the content textarea.
  const insertEmoji = useCallback((emojiData: { emoji: string }) => {
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
  }, []);

  const handleSave = useCallback(async () => {
    const code = shortCode.trim();
    const body = content.trim();
    if (!code || !body) {
      toast({ title: "Completa el atajo y el contenido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = { short_code: code, content: body, actions };
      if (editing) {
        await updateCannedResponse(editing.id, payload);
      } else {
        await createCannedResponse(payload);
      }
      await fetchItems();
      setFormOpen(false);
    } catch (err) {
      const friendly =
        err instanceof ClientApiError && err.message ? err.message : "No se pudo guardar la respuesta.";
      toast({ title: "Error al guardar", description: friendly, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [shortCode, content, actions, editing, fetchItems, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCannedResponse(deleteTarget.id);
      await fetchItems();
      setDeleteTarget(null);
    } catch (err) {
      const friendly =
        err instanceof ClientApiError && err.message ? err.message : "No se pudo eliminar la respuesta.";
      toast({ title: "Error al eliminar", description: friendly, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchItems, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Respuestas rápidas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mensajes predefinidos que se insertan con <span className="font-mono">/atajo</span> en el chat.
            {canManage && " Asóciales acciones que se ejecutan al enviarlas."}
          </p>
        </div>
        {canManage && (
          <Button className="gap-1.5 shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva respuesta
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar respuesta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
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
              : canManage
                ? "Aún no hay respuestas rápidas. Crea la primera con el botón Nueva respuesta."
                : "Aún no hay respuestas rápidas configuradas."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px]">Código corto</TableHead>
              <TableHead>Contenido</TableHead>
              {canManage && <TableHead className="w-[100px] text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium align-top">
                  <span className="inline-flex items-center gap-1.5">
                    {item.short_code}
                    {item.actions?.length > 0 && (
                      <Zap
                        className="h-3.5 w-3.5 text-volt shrink-0"
                        aria-label={`${item.actions.length} ${item.actions.length === 1 ? "acción" : "acciones"}`}
                      />
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground align-top">
                  <span className="line-clamp-2">{item.content}</span>
                </TableCell>
                {canManage && (
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / edit form dialog (managers only) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="text-base">
              {editing ? "Editar respuesta" : "Nueva respuesta"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">
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
                {emojiOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} aria-hidden />
                    <div className="absolute bottom-10 right-0 z-50 shadow-lg rounded-lg overflow-hidden">
                      <EmojiPicker onEmojiClick={insertEmoji} width={300} height={360} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Acciones al enviar</Label>
              <p className="text-[11px] text-muted-foreground -mt-0.5">
                Se ejecutan automáticamente cuando se envía un mensaje con esta respuesta.
              </p>
              <CannedResponseActionsBuilder
                value={actions}
                onChange={setActions}
                labels={labels}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter className="px-5 py-4 shrink-0 border-t border-border/40">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
