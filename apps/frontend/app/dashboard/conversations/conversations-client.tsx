"use client";

import { useState, useCallback, useMemo } from "react";
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
import { MessagingProvider } from "@/components/conversations/messaging-provider";
import type { Conversation, Inbox, Team } from "@/lib/types/messaging";

interface ConversationsClientProps {
  initialConversations: unknown[];
  initialInboxes: unknown[];
}

export function ConversationsClient({
  initialConversations,
  initialInboxes,
}: ConversationsClientProps) {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations as Conversation[]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [teams] = useState<Team[]>([]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowInfo(false);
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

  const handleDeleteConversation = useCallback((id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setShowInfo(false);
    }
  }, [selectedId]);

  const handleConversationUpdate = useCallback((updated: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  // Mobile layout: stack navigation
  if (isMobile) {
    return (
      <MessagingProvider>
      <div className="h-[calc(100vh-8rem)]">
        {selectedId === null ? (
          <div className="h-full rounded-lg border overflow-hidden">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={handleSelect}
              onConversationsChange={handleConversationsChange}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>
        ) : (
          <div className="h-full rounded-lg border overflow-hidden">
            <MessageView
              conversation={selectedConversation}
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
                teams={teams}
                onClose={handleCloseInfo}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
      </MessagingProvider>
    );
  }

  // Desktop layout: 3 panels
  return (
    <MessagingProvider>
    <div className="flex h-[calc(100vh-8rem)] rounded-lg border overflow-hidden">
      {/* Conversation list */}
      <div className="w-80 border-r shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          onConversationsChange={handleConversationsChange}
        />
      </div>

      {/* Message view */}
      <MessageView
        conversation={selectedConversation}
        onOpenInfo={handleOpenInfo}
        onConversationUpdate={handleConversationUpdate}
      />

      {/* Contact info panel */}
      {showInfo && selectedConversation && (
        <div className="w-80 border-l shrink-0">
          <ContactInfoPanel
            conversation={selectedConversation}
            teams={teams}
            onClose={handleCloseInfo}
          />
        </div>
      )}
    </div>
    </MessagingProvider>
  );
}
