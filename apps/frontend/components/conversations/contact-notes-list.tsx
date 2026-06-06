"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createContactNote,
  deleteContactNote,
  getContactNotes,
  updateContactNote,
} from "@/lib/api-client/messaging";
import type { Note } from "@/lib/types/messaging";
import { ContactNoteItem } from "./contact-note-item";

const MAX_LENGTH = 2000;
const SKELETON_DELAY_MS = 800;

interface ContactNotesListProps {
  contactId: number;
  tenantId?: number;
  editable: boolean;
  onCountChange?: (count: number) => void;
}

export function ContactNotesList({
  contactId,
  tenantId,
  editable,
  onCountChange,
}: ContactNotesListProps) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    skeletonTimerRef.current = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    try {
      const data = await getContactNotes(contactId, tenantId);
      setNotes(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error("Failed to load notes", err);
      setError("No pudimos cargar las notas.");
    } finally {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      setShowSkeleton(false);
      setLoading(false);
    }
  }, [contactId, tenantId, onCountChange]);

  useEffect(() => {
    refresh();
    return () => {
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    };
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setCreating(true);

    // Optimistic add
    const tempId = -Date.now();
    const optimistic: Note = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: null,
    };
    setNotes((prev) => (prev ? [optimistic, ...prev] : [optimistic]));
    setNewNote("");

    try {
      const created = await createContactNote(contactId, trimmed, tenantId);
      setNotes((prev) =>
        prev ? prev.map((n) => (n.id === tempId ? created : n)) : [created]
      );
      onCountChange?.((notes?.length ?? 0) + 1);
    } catch (err) {
      console.error("Failed to create note", err);
      setNotes((prev) => (prev ? prev.filter((n) => n.id !== tempId) : prev));
      setNewNote(trimmed);
      toast({
        title: "No pudimos crear la nota",
        description: "Probá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }, [newNote, contactId, tenantId, notes, onCountChange, toast]);

  const handleUpdate = useCallback(
    async (noteId: number, content: string) => {
      const previous = notes;
      setNotes((prev) =>
        prev
          ? prev.map((n) =>
              n.id === noteId
                ? { ...n, content, updated_at: new Date().toISOString() }
                : n
            )
          : prev
      );
      try {
        const updated = await updateContactNote(contactId, noteId, content, tenantId);
        setNotes((prev) => (prev ? prev.map((n) => (n.id === noteId ? updated : n)) : prev));
      } catch (err) {
        console.error("Failed to update note", err);
        setNotes(previous);
        toast({
          title: "No pudimos actualizar la nota",
          variant: "destructive",
        });
        throw err;
      }
    },
    [contactId, tenantId, notes, toast]
  );

  const handleDelete = useCallback(
    async (noteId: number) => {
      const previous = notes;
      const idx = previous?.findIndex((n) => n.id === noteId) ?? -1;
      setNotes((prev) => (prev ? prev.filter((n) => n.id !== noteId) : prev));

      try {
        await deleteContactNote(contactId, noteId, tenantId);
        onCountChange?.(Math.max(0, (previous?.length ?? 1) - 1));
      } catch (err) {
        console.error("Failed to delete note", err);
        if (previous && idx >= 0) {
          setNotes(previous);
        }
        toast({
          title: "No pudimos eliminar la nota",
          variant: "destructive",
        });
      }
    },
    [contactId, tenantId, notes, onCountChange, toast]
  );

  // Skeleton loading
  if (loading && showSkeleton && !notes) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="mb-2 text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      {notes && notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) => (
            <ContactNoteItem
              key={note.id}
              note={note}
              editable={editable && note.id > 0}
              onUpdate={(content) => handleUpdate(note.id, content)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}

      {notes && notes.length === 0 && !editable && (
        <p className="text-sm text-muted-foreground">Sin notas todavía.</p>
      )}

      {editable && (
        <div className="pt-1">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={
              notes && notes.length === 0
                ? "Escribir la primera nota..."
                : "Escribir nueva nota..."
            }
            rows={2}
            className="w-full resize-vertical rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {newNote.length > MAX_LENGTH - 200
                ? `${newNote.length} / ${MAX_LENGTH}`
                : ""}
            </span>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newNote.trim()}
              className="h-7 px-3 text-xs"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Agregando
                </>
              ) : (
                "Agregar"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
