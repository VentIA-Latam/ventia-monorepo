"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Thermometer } from "lucide-react";
import { updateConversation } from "@/lib/api-client/messaging";
import { TEMPERATURE_ICON_MAP } from "@/lib/utils/temperature-icons";
import type { ConversationTemperature, TemperatureDefinition } from "@/lib/types/messaging";

interface TemperatureSelectorProps {
  conversationId: number;
  value: ConversationTemperature;
  temperatureConfig: TemperatureDefinition[];
  tenantId?: number;
  onChange?: (value: ConversationTemperature) => void;
}

export function TemperatureSelector({
  conversationId,
  value,
  temperatureConfig,
  tenantId,
  onChange,
}: TemperatureSelectorProps) {
  const handleClick = useCallback(
    async (temp: string) => {
      const newValue = value === temp ? null : temp;
      onChange?.(newValue);
      try {
        await updateConversation(conversationId, { temperature: newValue }, tenantId);
      } catch (err) {
        console.error("Error updating temperature:", err);
        onChange?.(value);
      }
    },
    [conversationId, value, tenantId, onChange]
  );

  if (!temperatureConfig.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {temperatureConfig
        .sort((a, b) => a.position - b.position)
        .map((temp) => {
          const Icon = TEMPERATURE_ICON_MAP[temp.icon] ?? Thermometer;
          const isActive = value === temp.key;
          return (
            <button
              key={temp.key}
              onClick={() => handleClick(temp.key)}
              title={temp.name}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                !isActive && "border-border text-muted-foreground hover:bg-muted/50"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: `${temp.color}18`,
                      color: temp.color,
                      borderColor: `${temp.color}50`,
                    }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {temp.name}
            </button>
          );
        })}
    </div>
  );
}
