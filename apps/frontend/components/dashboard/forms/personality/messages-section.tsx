"use client";

interface MessagesSectionProps {
  welcomeMessage: string;
  purchaseConfirmationMessage: string;
  humanHandoffMessage: string;
  onWelcomeMessageChange: (value: string) => void;
  onPurchaseConfirmationMessageChange: (value: string) => void;
  onHumanHandoffMessageChange: (value: string) => void;
}

export default function MessagesSection({
  welcomeMessage,
  purchaseConfirmationMessage,
  humanHandoffMessage,
  onWelcomeMessageChange,
  onPurchaseConfirmationMessageChange,
  onHumanHandoffMessageChange,
}: MessagesSectionProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Mensajes
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mensaje de bienvenida */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Mensaje de bienvenida
            <span className="text-danger ml-1">*</span>
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => onWelcomeMessageChange(e.target.value)}
            placeholder={"\u00a1Hola! Soy GenAssist. \u00bfEn qu\u00e9 puedo ayudarte hoy?"}
            rows={4}
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>

        {/* Mensaje de confirmación de compra */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {"Mensaje de confirmaci\u00f3n de compra"}
            <span className="text-danger ml-1">*</span>
          </label>
          <textarea
            value={purchaseConfirmationMessage}
            onChange={(e) => onPurchaseConfirmationMessageChange(e.target.value)}
            placeholder={"\u00a1Gracias por tu compra! Estamos procesando tu pedido y pronto recibir\u00e1s la confirmaci\u00f3n."}
            rows={4}
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>
      </div>

      {/* Mensaje de derivación humana */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          {"Mensaje de derivaci\u00f3n humana"}
          <span className="text-danger ml-1">*</span>
        </label>
        <textarea
          value={humanHandoffMessage}
          onChange={(e) => onHumanHandoffMessageChange(e.target.value)}
          placeholder={"Te conectar\u00e9 con un agente humano para brindarte m\u00e1s ayuda."}
          rows={4}
          className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {"Mensaje que se env\u00eda cuando el asistente deriva la conversaci\u00f3n a un humano"}
        </p>
      </div>
    </div>
  );
}
