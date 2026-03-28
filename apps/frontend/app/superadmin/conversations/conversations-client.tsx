"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConversationList } from "@/components/conversations/conversation-list";
import { MessageView } from "@/components/conversations/message-view";
import { ContactInfoPanel } from "@/components/conversations/contact-info-panel";
import { MessagingProvider } from "@/components/conversations/messaging-provider";
import { getConversations, getInboxes, getLabels } from "@/lib/api-client/messaging";
import type { Conversation, Label } from "@/lib/types/messaging";

interface SuperAdminConversationsClientProps {
  tenantId: number;
}

export function SuperAdminConversationsClient({ tenantId }: SuperAdminConversationsClientProps) {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch data when tenantId changes
  const prevTenantId = useRef(tenantId);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    setShowInfo(false);
    setConversations([]);
    setAllLabels([]);

    Promise.all([
      getConversations({ status: "open", tenant_id: tenantId }),
      getLabels(tenantId),
    ])
      .then(([convData, labelsData]) => {
        if (cancelled) return;
        setConversations(convData.data ?? []);
        setAllLabels(labelsData.data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading conversations:", err);
        if (!cancelled) setLoading(false);
      });

    prevTenantId.current = tenantId;
    return () => { cancelled = true; };
  }, [tenantId]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    setShowInfo(false);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setShowInfo(false);
  }, []);

  const handleOpenInfo = useCallback(() => setShowInfo(true), []);
  const handleCloseInfo = useCallback(() => setShowInfo(false), []);
  const handleConversationsChange = useCallback((c: Conversation[]) => setConversations(c), []);

  const handleDeleteConversation = useCallback((id: number) => {
    setSelectedId((prev) => {
      if (prev === id) {
        setShowInfo(false);
        return null;
      }
      return prev;
    });
  }, []);

  const handleConversationUpdate = useCallback((updated: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const handleLabelCreated = useCallback((label: Label) => {
    setAllLabels((prev) => [...prev, label]);
  }, []);

  const handleLabelDeleted = useCallback((labelId: number) => {
    setAllLabels((prev) => prev.filter((l) => l.id !== labelId));
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        labels: c.labels?.filter((l) => l.id !== labelId) ?? [],
      }))
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando conversaciones...</span>
      </div>
    );
  }

  const content = isMobile ? (
    <div className="h-full">
      {selectedId === null ? (
        <div className="h-full overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            allLabels={allLabels}
            tenantId={tenantId}
            onSelect={handleSelect}
            onConversationsChange={handleConversationsChange}
            onDeleteConversation={handleDeleteConversation}
            onLabelCreated={handleLabelCreated}
            onLabelDeleted={handleLabelDeleted}
          />
        </div>
      ) : (
        <div className="h-full overflow-hidden">
          <MessageView
            conversation={selectedConversation}
            tenantId={tenantId}
            onBack={handleBack}
            onOpenInfo={handleOpenInfo}
            onConversationUpdate={handleConversationUpdate}
          />
        </div>
      )}

      <Sheet open={showInfo} onOpenChange={setShowInfo}>
        <SheetContent side="right" className="p-0 w-80">
          <SheetHeader className="sr-only">
            <SheetTitle>Información del contacto</SheetTitle>
          </SheetHeader>
          {selectedConversation && (
            <ContactInfoPanel
              conversation={selectedConversation}
              allLabels={allLabels}
              tenantId={tenantId}
              onClose={handleCloseInfo}
              onConversationUpdate={handleConversationUpdate}
              onLabelCreated={handleLabelCreated}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  ) : (
    <div className="flex h-full w-full overflow-hidden border-t border-border/30">
      <div className={`border-r min-h-0 ${showInfo ? "w-[300px] shrink-0" : "w-[400px] shrink-0"}`}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          allLabels={allLabels}
          tenantId={tenantId}
          onSelect={handleSelect}
          onConversationsChange={handleConversationsChange}
          onLabelCreated={handleLabelCreated}
          onLabelDeleted={handleLabelDeleted}
        />
      </div>

      <MessageView
        conversation={selectedConversation}
        tenantId={tenantId}
        onOpenInfo={handleOpenInfo}
        onConversationUpdate={handleConversationUpdate}
      />

      {showInfo && selectedConversation && (
        <div className="w-80 border-l shrink-0">
          <ContactInfoPanel
            conversation={selectedConversation}
            allLabels={allLabels}
            tenantId={tenantId}
            onClose={handleCloseInfo}
            onConversationUpdate={handleConversationUpdate}
            onLabelCreated={handleLabelCreated}
          />
        </div>
      )}
    </div>
  );

  return (
    <MessagingProvider tenantId={tenantId}>
      {content}
    </MessagingProvider>
  );
}
