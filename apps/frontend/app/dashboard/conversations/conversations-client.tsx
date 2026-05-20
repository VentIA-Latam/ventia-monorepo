"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConversationList } from "@/components/conversations/conversation-list";
import { MessageView } from "@/components/conversations/message-view";
import { ContactInfoPanel } from "@/components/conversations/contact-info-panel";
import type { Conversation, Label, TemperatureDefinition } from "@/lib/types/messaging";

interface ConversationsClientProps {
  initialConversations: unknown[];
  initialInboxes: unknown[];
  initialLabels: unknown[];
  initialTemperatureConfig?: unknown[];
  initialSection?: string;
  initialConversationId?: number;
}

export function ConversationsClient({
  initialConversations,
  initialInboxes,
  initialLabels,
  initialTemperatureConfig = [],
  initialSection = "all",
  initialConversationId,
}: ConversationsClientProps) {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations as Conversation[]
  );
  const [selectedId, setSelectedId] = useState<number | null>(initialConversationId ?? null);
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [allLabels, setAllLabels] = useState<Label[]>(initialLabels as Label[]);
  const [temperatureConfig] = useState<TemperatureDefinition[]>(initialTemperatureConfig as TemperatureDefinition[]);

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

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = useCallback((id: number, msgId?: number) => {
    setSelectedId(id);
    setTargetMessageId(msgId ?? null);
    setShowInfo(false);
    // Optimistic: clear unread badge immediately
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setShowInfo(false);
  }, []);

  const handleOpenInfo = useCallback(() => {
    setShowInfo(true);
  }, []);

  const handleCloseInfo = useCallback(() => {
    setShowInfo(false);
  }, []);

  const handleConversationsChange = useCallback((newConversations: Conversation[]) => {
    setConversations(newConversations);
  }, []);

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

  // Mobile layout: stack navigation
  if (isMobile) {
    return (
      <div className="h-full">
        {selectedId === null ? (
          <div className="h-full overflow-hidden">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              allLabels={allLabels}
              temperatureConfig={temperatureConfig}
              section={initialSection}
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
              targetMessageId={targetMessageId}
              onBack={handleBack}
              onOpenInfo={handleOpenInfo}
              onConversationUpdate={handleConversationUpdate}
            />
          </div>
        )}

        {/* Contact info sheet (mobile) */}
        <Sheet open={showInfo} onOpenChange={setShowInfo}>
          <SheetContent side="right" className="p-0 w-80">
            <SheetHeader className="sr-only">
              <SheetTitle>Información del contacto</SheetTitle>
            </SheetHeader>
            {selectedConversation && (
              <ContactInfoPanel
                conversation={selectedConversation}
                allLabels={allLabels}
                temperatureConfig={temperatureConfig}
                onClose={handleCloseInfo}
                onConversationUpdate={handleConversationUpdate}
                onLabelCreated={handleLabelCreated}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop layout: 3 panels
  return (
    <div className="relative flex h-full w-full overflow-hidden border-t border-border/30">
      {/* Conversation list */}
      <div className="border-r min-h-0 shrink-0 w-[340px]">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          allLabels={allLabels}
          temperatureConfig={temperatureConfig}
          section={initialSection}
          onSelect={handleSelect}
          onConversationsChange={handleConversationsChange}
          onLabelCreated={handleLabelCreated}
          onLabelDeleted={handleLabelDeleted}
        />
      </div>

      {/* Message view */}
      <div className="flex-1 min-w-0">
        <MessageView
          conversation={selectedConversation}
          targetMessageId={targetMessageId}
          onOpenInfo={handleOpenInfo}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>

      {/* Contact info panel — overlay (Chatwoot pattern) */}
      {showInfo && selectedConversation && (
        <>
          <div className="absolute inset-0 z-30" onClick={handleCloseInfo} />
          <div className="absolute top-0 right-0 z-40 h-full w-80 max-w-sm bg-background border-l shadow-lg overflow-hidden transition-transform duration-300 ease-in-out">
            <ContactInfoPanel
              conversation={selectedConversation}
              allLabels={allLabels}
              temperatureConfig={temperatureConfig}
              onClose={handleCloseInfo}
              onConversationUpdate={handleConversationUpdate}
              onLabelCreated={handleLabelCreated}
            />
          </div>
        </>
      )}
    </div>
  );
}
