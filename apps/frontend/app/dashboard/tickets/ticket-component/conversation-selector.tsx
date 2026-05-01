"use client"

import type { RefObject } from "react"
import { MessageSquare, ChevronDown, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Conversation } from "@/lib/types/messaging"

interface ConversationSelectorProps {
  open: boolean
  onTriggerClick: () => void
  conversations: Conversation[]
  loadingConvs: boolean
  search: string
  onSearchChange: (v: string) => void
  selected: Conversation | null
  onSelect: (conv: Conversation) => void
  getLabel: (conv: Conversation) => string
  hasError: boolean
  dropdownRef: RefObject<HTMLDivElement | null>
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function ConversationSelector({
  open,
  onTriggerClick,
  conversations,
  loadingConvs,
  search,
  onSearchChange,
  selected,
  onSelect,
  getLabel,
  hasError,
  dropdownRef,
  triggerRef,
}: ConversationSelectorProps) {
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={onTriggerClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors",
          hasError ? "border-destructive" : "border-border hover:border-muted-foreground/40"
        )}
      >
        <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
        {selected ? (
          <span className="flex-1 text-sm font-medium truncate">{getLabel(selected)}</span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">
            Selecciona una conversación reciente...
          </span>
        )}
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-background border border-border rounded-xl shadow-lg z-30 flex flex-col overflow-hidden max-h-80"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {loadingConvs ? (
              <div className="flex flex-col gap-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay conversaciones recientes. Completa la descripción con detalles del problema.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selected?.id === conv.id
                return (
                  <button
                    key={conv.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelect(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-border/50 last:border-0 transition-colors",
                      isSelected ? "bg-cielo/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="w-7 h-7 rounded-lg bg-cielo/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-cielo" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getLabel(conv)}</p>
                      <p className="text-xs text-muted-foreground font-mono">#{conv.id}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cielo shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
