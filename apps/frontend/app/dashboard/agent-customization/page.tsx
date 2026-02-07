"use client";

import { Bot } from "lucide-react";

export default function AgentCustomizationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-lg">
          <Bot className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personalización del Agente</h1>
          <p className="text-gray-600">Configura y personaliza tu asistente virtual</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-purple-50 rounded-full">
              <Bot className="w-12 h-12 text-purple-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Próximamente</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Esta sección estará disponible muy pronto. Aquí podrás personalizar el comportamiento,
            la personalidad y las respuestas de tu agente de ventas.
          </p>
        </div>
      </div>
    </div>
  );
}
