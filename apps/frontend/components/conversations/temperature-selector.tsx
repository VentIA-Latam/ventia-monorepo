"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Snowflake, Thermometer, Flame } from "lucide-react";
import { updateConversation } from "@/lib/api-client/messaging";
import type { ConversationTemperature } from "@/lib/types/messaging";

interface TemperatureSelectorProps {
  conversationId: number;
  value: ConversationTemperature;
  onChange?: (value: ConversationTemperature) => void;
}

const TEMPERATURES: {
  value: ConversationTemperature;
  label: string;
  icon: typeof Snowflake;
  activeClass: string;
}[] = [
  { value: "cold", label: "Frío", icon: Snowflake, activeClass: "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  { value: "warm", label: "Tibio", icon: Thermometer, activeClass: "bg-orange-100 text-orange-600 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  { value: "hot", label: "Caliente", icon: Flame, activeClass: "bg-red-100 text-red-600 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
];

export function TemperatureSelector({ conversationId, value, onChange }: TemperatureSelectorProps) {
  const handleClick = useCallback(
    async (temp: ConversationTemperature) => {
      const newValue = value === temp ? null : temp;
      onChange?.(newValue);
      try {
        await updateConversation(conversationId, { temperature: newValue });
      } catch (err) {
        console.error("Error updating temperature:", err);
        onChange?.(value);
      }
    },
    [conversationId, value, onChange]
  );

  return (
    <div className="flex gap-2">
      {TEMPERATURES.map((temp) => {
        const Icon = temp.icon;
        const isActive = value === temp.value;
        return (
          <button
            key={temp.value}
            onClick={() => handleClick(temp.value)}
            title={temp.label}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
              isActive
                ? temp.activeClass
                : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {temp.label}
          </button>
        );
      })}
    </div>
  );
}
