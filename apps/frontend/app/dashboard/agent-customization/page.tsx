"use client";

import { Bot } from "lucide-react";

export default function AgentCustomizationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-luma/20 rounded-lg">
          <Bot className="w-6 h-6 text-volt" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Personalización del Agente</h1>
          <p className="text-muted-foreground">Configura y personaliza tu asistente virtual</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-volt/10 rounded-full">
              <Bot className="w-12 h-12 text-volt" />
            </div>
          </div>
          <h2 className="text-xl font-semibold font-heading text-foreground">Próximamente</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Esta sección estará disponible muy pronto. Aquí podrás personalizar el comportamiento,
            la personalidad y las respuestas de tu agente de ventas.
          </p>
        </div>
      </div>
    </div>
  );
}
