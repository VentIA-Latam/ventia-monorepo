"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { getConversations, getInboxes, getLabels, getTemperatureConfig, getWsToken } from "@/lib/api-client/messaging";
import type { Conversation, Label, TemperatureDefinition } from "@/lib/types/messaging";

interface SuperAdminConversationsClientProps {
  tenantId: number;
  section?: string;
  initialConversationId?: number;
}

export function SuperAdminConversationsClient({ tenantId, section = "all", initialConversationId }: SuperAdminConversationsClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [temperatureConfig, setTemperatureConfig] = useState<TemperatureDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  const [targetNonce, setTargetNonce] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialApplied = useRef(false);
  // Capturado al montar — no reacciona a cambios del prop (evita re-aplicación en cada click)
  const initialIdRef = useRef(initialConversationId);

  // Fetch data when tenantId changes
  const prevTenantId = useRef(tenantId);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    setShowInfo(false);
    setConversations([]);
    setAllLabels([]);

    async function loadData() {
      try {
        // Happy path: account already exists — parallel fetch, no waterfall
        const [convData, labelsData, tempConfigData] = await Promise.all([
          getConversations({
            status: "open",
            tenant_id: tenantId,
            ...(section === "sale" && { stage: "sale" }),
            ...(section === "unattended" && { conversation_type: "unattended" }),
          }),
          getLabels(tenantId),
          getTemperatureConfig(tenantId),
        ]);
        if (cancelled) return;
        setConversations(convData.data ?? []);
        setAllLabels(labelsData.data ?? []);
        setTemperatureConfig(tempConfigData.data ?? []);
      } catch {
        // Account likely not provisioned — trigger auto-provisioning via ws-token
        try {
          await getWsToken(tenantId);
        } catch { /* provisioning attempted */ }
        if (cancelled) return;

        // Retry after provisioning
        try {
          const [convData, labelsData, tempConfigData] = await Promise.all([
            getConversations({
            status: "open",
            tenant_id: tenantId,
            ...(section === "sale" && { stage: "sale" }),
            ...(section === "unattended" && { conversation_type: "unattended" }),
          }),
            getLabels(tenantId),
            getTemperatureConfig(tenantId),
          ]);
          if (cancelled) return;
          setConversations(convData.data ?? []);
          setAllLabels(labelsData.data ?? []);
          setTemperatureConfig(tempConfigData.data ?? []);
        } catch (retryErr) {
          console.error("Error loading conversations after provisioning:", retryErr);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    prevTenantId.current = tenantId;
    return () => { cancelled = true; };
  }, [tenantId]);

  // Al cargar desde un link compartido, abrir la conversación indicada en la URL
  useEffect(() => {
    if (!loading && !initialApplied.current && initialIdRef.current) {
      initialApplied.current = true;
      const exists = conversations.some((c) => c.id === initialIdRef.current);
      if (exists) setSelectedId(initialIdRef.current!);
    }
  }, [loading, conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = useCallback((id: number, msgId?: number) => {
    setSelectedId(id);
    setTargetMessageId(msgId ?? null);
    if (msgId) setTargetNonce((n) => n + 1);
    setShowInfo(false);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
    // Actualiza la URL para que sea compartible con otros superadmins
    router.replace(
      `/superadmin/conversations?section=${section}&id=${id}&tenant_id=${tenantId}`,
      { scroll: false }
    );
  }, [router, section, tenantId]);

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
            temperatureConfig={temperatureConfig}
            section={section}
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
            targetMessageId={targetMessageId}
              targetNonce={targetNonce}
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
              temperatureConfig={temperatureConfig}
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
    <div className="relative flex h-full w-full overflow-hidden border-t border-border/30">
      <div className="border-r min-h-0 shrink-0 w-[340px]">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          allLabels={allLabels}
          temperatureConfig={temperatureConfig}
          section={section}
          tenantId={tenantId}
          onSelect={handleSelect}
          onConversationsChange={handleConversationsChange}
          onLabelCreated={handleLabelCreated}
          onLabelDeleted={handleLabelDeleted}
        />
      </div>

      <div className="flex-1 min-w-0">
        <MessageView
          conversation={selectedConversation}
          tenantId={tenantId}
          targetMessageId={targetMessageId}
              targetNonce={targetNonce}
          onOpenInfo={handleOpenInfo}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>

      {showInfo && selectedConversation && (
        <>
          <div className="absolute inset-0 z-30" onClick={handleCloseInfo} />
          <div className="absolute top-0 right-0 z-40 h-full w-80 max-w-sm bg-background border-l shadow-lg overflow-hidden transition-transform duration-300 ease-in-out">
            <ContactInfoPanel
              conversation={selectedConversation}
              allLabels={allLabels}
              temperatureConfig={temperatureConfig}
              tenantId={tenantId}
              onClose={handleCloseInfo}
              onConversationUpdate={handleConversationUpdate}
              onLabelCreated={handleLabelCreated}
            />
          </div>
        </>
      )}
    </div>
  );

  return content;
}
