"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types/messaging";

const MAX_LENGTH = 2000;

interface ContactNoteItemProps {
  note: Note;
  editable: boolean;
  onUpdate: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ContactNoteItem({
  note,
  editable,
  onUpdate,
  onDelete,
}: ContactNoteItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [editing]);

  const handleStartEdit = useCallback(() => {
    setDraft(note.content);
    setEditing(true);
  }, [note.content]);

  const handleCancelEdit = useCallback(() => {
    setDraft(note.content);
    setEditing(false);
  }, [note.content]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === note.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, note.content, onUpdate]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setDialogOpen(false);
    }
  }, [onDelete]);

  const authorLabel = note.user?.name ?? note.user?.email ?? "Usuario eliminado";

  const createdAt = (() => {
    try {
      return formatDistanceToNow(new Date(note.created_at), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return note.created_at;
    }
  })();

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-background p-3 transition-colors",
        editable && "hover:border-foreground/15 hover:bg-muted/40",
        editing && "border-foreground/15 bg-muted/40"
      )}
    >
      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            disabled={saving}
            rows={3}
            className="w-full resize-vertical rounded-md border border-border bg-background px-2.5 py-1.5 text-sm leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Editar nota..."
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {draft.length > MAX_LENGTH - 200
                ? `${draft.length} / ${MAX_LENGTH}`
                : ""}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-7 px-2 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !draft.trim() || draft.trim() === note.content}
                className="h-7 px-2 text-xs"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground pr-14">
            {note.content}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/85">{authorLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{createdAt}</span>
          </div>
          {editable && (
            <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={handleStartEdit}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Editar nota"
                aria-label="Editar nota"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Eliminar nota"
                aria-label="Eliminar nota"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
