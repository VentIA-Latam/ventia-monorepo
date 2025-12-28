"use client";

import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { HiOutlineEmojiHappy } from "react-icons/hi";

interface PersonalityFormData {
  // Personality section
  communicationStyle: string;
  salesStyle: string;
  responseLength: number;
  useEmojis: boolean;
  useOpeningSymbols: boolean;
  wordsToAvoid: string;
  allowedEmojis: string[];
  // Basic Info section
  sellerName: string;
  sellerGender: "masculino" | "femenino" | "no-especificado" | "otro" | "";
  companyName: string;
  operationCountry: string;
  companyDescription: string;
  // Audience section
  targetAudience: string;
  specialInstructions: string;
  // Messages section
  welcomeMessage: string;
  purchaseConfirmationMessage: string;
  humanHandoffMessage: string;
}

interface PersonalityFormProps {
  onDataChange?: (data: PersonalityFormData) => void;
}

export default function PersonalityForm({
  onDataChange,
}: PersonalityFormProps) {
  const [formData, setFormData] = useState<PersonalityFormData>({
    communicationStyle: "",
    salesStyle: "",
    responseLength: 4, // "Muy detallado" is at position 4
    useEmojis: true,
    useOpeningSymbols: false,
    wordsToAvoid: "",
    allowedEmojis: ["😊", "👍", "🎉"],
    sellerName: "",
    sellerGender: "",
    companyName: "",
    operationCountry: "",
    companyDescription: "",
    targetAudience: "",
    specialInstructions: "",
    welcomeMessage: "",
    purchaseConfirmationMessage: "",
    humanHandoffMessage: "",
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleChange = <K extends keyof PersonalityFormData>(
    field: K,
    value: PersonalityFormData[K]
  ) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onDataChange?.(newData);
  };

  const addCustomEmoji = (emoji: string) => {
    if (emoji && !formData.allowedEmojis.includes(emoji)) {
      handleChange("allowedEmojis", [...formData.allowedEmojis, emoji]);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    addCustomEmoji(emojiData.emoji);
  };

  const removeEmoji = (emoji: string) => {
    handleChange(
      "allowedEmojis",
      formData.allowedEmojis.filter((e) => e !== emoji)
    );
  };

  const responseLengthLabels = [
    "Muy conciso",
    "Conciso",
    "Equilibrado",
    "Detallado",
    "Muy detallado",
  ];

  return (
    <div className="space-y-8 font-inter">

      {/* Basic Information Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-6 h-6 rounded-full border-2 border-[#5ACAF0] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#5ACAF0]"></div>
          </div>
          <h2 className="text-xl font-semibold text-ventia-blue">
            Información básica
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del vendedor
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.sellerName}
              onChange={(e) => handleChange("sellerName", e.target.value)}
              placeholder="GenAssist"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Género del vendedor
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "masculino", label: "Masculino" },
                { value: "femenino", label: "Femenino" },
                { value: "no-especificado", label: "No especificado" },
                { value: "otro", label: "Otro" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="sellerGender"
                    value={option.value}
                    checked={formData.sellerGender === option.value}
                    onChange={(e) => handleChange("sellerGender", e.target.value as any)}
                    className="w-4 h-4 text-[#5ACAF0] focus:ring-[#5ACAF0]"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la empresa
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              placeholder="Nicara"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              País de operación
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={formData.operationCountry}
              onChange={(e) => handleChange("operationCountry", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            >
              <option value="">Seleccionar país</option>
              <option value="PE">🇵🇪 Perú</option>
              <option value="MX">🇲🇽 México</option>
              <option value="CO">🇨🇴 Colombia</option>
              <option value="AR">🇦🇷 Argentina</option>
              <option value="CL">🇨🇱 Chile</option>
              <option value="ES">🇪🇸 España</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción de la empresa
            <span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            value={formData.companyDescription}
            onChange={(e) => handleChange("companyDescription", e.target.value)}
            placeholder="Tienda genérica de productos variados."
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
          />
        </div>
      </div>

      {/* Audience and Instructions Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-6 h-6 rounded-full border-2 border-[#5ACAF0] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#5ACAF0]"></div>
          </div>
          <h2 className="text-xl font-semibold text-ventia-blue">
            Audiencia e instrucciones
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿A quién le vendes?
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.targetAudience}
              onChange={(e) => handleChange("targetAudience", e.target.value)}
              placeholder="broad consumer audience"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instrucciones especiales para tu vendedor
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={formData.specialInstructions}
              onChange={(e) =>
                handleChange("specialInstructions", e.target.value)
              }
              placeholder="general product support"
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>
        </div>
      </div>
      {/* Personality Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[#5ACAF0] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#5ACAF0]"></div>
            </div>
            <h2 className="text-xl font-semibold text-ventia-blue">
              Personalidad
            </h2>
          </div>
          <button className="text-sm text-ventia-blue hover:underline flex items-center gap-1">
            Plantillas
          </button>
        </div>

        <div className="space-y-6">
          {/* Estilo de comunicación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Estilo de comunicación
                <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.communicationStyle}
                  onChange={(e) =>
                    handleChange("communicationStyle", e.target.value)
                  }
                  placeholder="friendly, concise, and clear"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
                />
                <div className="absolute right-3 top-3 text-xs text-gray-400">
                  28/200
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Estilo de ventas
                <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.salesStyle}
                  onChange={(e) => handleChange("salesStyle", e.target.value)}
                  placeholder="consultative"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
                />
                <div className="absolute right-3 top-3 text-xs text-gray-400">
                  12/200
                </div>
              </div>
            </div>
          </div>

          {/* Longitud de respuesta */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                Longitud de respuesta
                <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
              </label>
              <span className="text-sm text-ventia-blue font-medium">
                {responseLengthLabels[formData.responseLength]}
              </span>
            </div>
            <div className="space-y-2">
              {/* Slider container */}
              <div
                className="relative h-10 cursor-pointer"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={formData.responseLength}
                aria-valuetext={responseLengthLabels[formData.responseLength]}
              >
                {/* Background track with border */}
                <div className="absolute inset-0 bg-gray-100 border border-gray-300 rounded-full overflow-hidden">
                  {/* Clickable segments - invisible but functional */}
                  <div className="absolute inset-0 flex">
                    {responseLengthLabels.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleChange("responseLength", index)}
                        className="flex-1 h-full bg-transparent transition-colors hover:bg-black/5"
                        aria-label={`Seleccionar nivel ${responseLengthLabels[index]}`}
                      />
                    ))}
                  </div>

                  {/* Divider lines between segments */}
                  <div className="absolute inset-0 flex pointer-events-none z-10">
                    {responseLengthLabels.slice(1).map((_, index) => (
                      <div
                        key={index}
                        className="h-full shrink-0 grow-0 border-l border-gray-100/70"
                        style={{
                          width: `${100 / responseLengthLabels.length}%`,
                          marginLeft: index === 0 ? `${100 / responseLengthLabels.length}%` : '0'
                        }}
                      />
                    ))}
                  </div>

                  {/* Progress fill - from start to end of selected segment */}
                  <div
                    className="absolute left-0 top-0 h-full bg-gray-300/30 rounded-l-full transition-all duration-300"
                    style={{
                      width: `${((formData.responseLength + 1) / responseLengthLabels.length) * 100}%`,
                    }}
                  />

                  {/* Position indicators - one per segment, centered */}
                  <div className="absolute inset-0 flex pointer-events-none z-20">
                    {responseLengthLabels.map((_, index) => (
                      <div
                        key={index}
                        className="flex-1 flex items-center justify-center"
                      >
                        <div
                          className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-all duration-300 ${
                            index === formData.responseLength
                              ? "bg-gray-500 scale-100"
                              : "bg-transparent scale-0"
                          }`}
                        >
                          {index === formData.responseLength && (
                            <div className="flex items-end justify-center gap-0.5 h-5 w-5">
                              <div className="w-0.5 h-2 bg-white rounded-t-sm" />
                              <div className="w-0.5 h-2.5 bg-white rounded-t-sm" />
                              <div className="w-0.5 h-3 bg-white rounded-t-sm" />
                              <div className="w-0.5 h-3.5 bg-white rounded-t-sm" />
                              <div className="w-0.5 h-4 bg-white rounded-t-sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hidden range input for keyboard accessibility */}
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={formData.responseLength}
                  onChange={(e) =>
                    handleChange("responseLength", parseInt(e.target.value))
                  }
                  className="absolute w-full opacity-0 cursor-pointer z-30 inset-0"
                />
              </div>

              {/* Labels */}
              <div className="flex">
                {responseLengthLabels.map((label, index) => (
                  <button
                    key={label}
                    onClick={() => handleChange("responseLength", index)}
                    className={`flex-1 text-center text-xs transition-all ${
                      index === formData.responseLength
                        ? "font-semibold text-ventia-blue"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                ¿Usar emojis?
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useEmojis}
                  onChange={(e) => handleChange("useEmojis", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#5ACAF0] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5ACAF0]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                ¿Usar signos de apertura (¿)?
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useOpeningSymbols}
                  onChange={(e) =>
                    handleChange("useOpeningSymbols", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#5ACAF0] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5ACAF0]"></div>
              </label>
            </div>
          </div>

          {/* Palabras a evitar */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Palabras a evitar
              <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
            </label>
            <input
              type="text"
              value={formData.wordsToAvoid}
              onChange={(e) => handleChange("wordsToAvoid", e.target.value)}
              placeholder="Escribe palabras separadas por comas"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>

          {/* Paleta de emojis permitidos */}
          <div className="relative">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Paleta de emojis permitidos
              <FaInfoCircle className="text-gray-400 text-xs cursor-help" />
            </label>

            <div className="flex gap-2 items-stretch">
              {/* Input con emojis seleccionados dentro */}
              <div className="flex-1 border border-gray-300 rounded-lg p-2 bg-gray-50 min-h-12 flex flex-wrap gap-2 items-center">
                {formData.allowedEmojis.map((emoji) => (
                  <div
                    key={emoji}
                    className="relative group inline-flex items-center"
                  >
                    <span className="text-xl cursor-pointer hover:scale-110 transition-transform">
                      {emoji}
                    </span>
                    <button
                      onClick={() => removeEmoji(emoji)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {formData.allowedEmojis.length === 0 && (
                  <span className="text-sm text-gray-400">
                    Escribe o selecciona emojis de la paleta
                  </span>
                )}
              </div>

              {/* Botón selector de emojis a la derecha */}
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-xl transition-colors"
              >
                <HiOutlineEmojiHappy />

              </button>
            </div>

            {/* Emoji picker - positioned absolutely */}
            {showEmojiPicker && (
              <>
                {/* Backdrop para cerrar el picker */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowEmojiPicker(false)}
                />

                {/* Emoji picker superpuesto - aparece hacia arriba */}
                <div className="absolute right-0 bottom-full mb-2 z-50">
                  <div className="border border-gray-300 rounded-lg overflow-hidden shadow-2xl bg-white">
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      width={350}
                      height={450}
                      searchPlaceHolder="Buscar emoji..."
                      previewConfig={{
                        showPreview: false,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-6 h-6 rounded-full border-2 border-[#5ACAF0] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#5ACAF0]"></div>
          </div>
          <h2 className="text-xl font-semibold text-ventia-blue">
            Mensajes
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mensaje de bienvenida */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de bienvenida
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={formData.welcomeMessage}
              onChange={(e) => handleChange("welcomeMessage", e.target.value)}
              placeholder="¡Hola! Soy GenAssist. ¿En qué puedo ayudarte hoy?"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>

          {/* Mensaje de confirmación de compra */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de confirmación de compra
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={formData.purchaseConfirmationMessage}
              onChange={(e) => handleChange("purchaseConfirmationMessage", e.target.value)}
              placeholder="¡Gracias por tu compra! Estamos procesando tu pedido y pronto recibirás la confirmación."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
            />
          </div>
        </div>

        {/* Mensaje de derivación humana */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mensaje de derivación humana
            <span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            value={formData.humanHandoffMessage}
            onChange={(e) => handleChange("humanHandoffMessage", e.target.value)}
            placeholder="Te conectaré con un agente humano para brindarte más ayuda."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-gray-50"
          />
          <p className="mt-2 text-xs text-gray-500">
            Mensaje que se envía cuando el asistente deriva la conversación a un humano
          </p>
        </div>
      </div>

    </div>
  );
}
