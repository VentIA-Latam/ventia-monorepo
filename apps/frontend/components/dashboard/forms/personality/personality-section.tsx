"use client";

import { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { HiOutlineEmojiHappy } from "react-icons/hi";
import ResponseLengthSlider from "./response-length-slider";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface PersonalitySectionProps {
  communicationStyle: string;
  salesStyle: string;
  responseLength: number;
  useEmojis: boolean;
  useOpeningSymbols: boolean;
  wordsToAvoid: string;
  allowedEmojis: string[];
  onCommunicationStyleChange: (value: string) => void;
  onSalesStyleChange: (value: string) => void;
  onResponseLengthChange: (value: number) => void;
  onUseEmojisChange: (value: boolean) => void;
  onUseOpeningSymbolsChange: (value: boolean) => void;
  onWordsToAvoidChange: (value: string) => void;
  onAllowedEmojisChange: (value: string[]) => void;
}

export default function PersonalitySection({
  communicationStyle,
  salesStyle,
  responseLength,
  useEmojis,
  useOpeningSymbols,
  wordsToAvoid,
  allowedEmojis,
  onCommunicationStyleChange,
  onSalesStyleChange,
  onResponseLengthChange,
  onUseEmojisChange,
  onUseOpeningSymbolsChange,
  onWordsToAvoidChange,
  onAllowedEmojisChange,
}: PersonalitySectionProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const addCustomEmoji = (emoji: string) => {
    if (emoji && !allowedEmojis.includes(emoji)) {
      onAllowedEmojisChange([...allowedEmojis, emoji]);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    addCustomEmoji(emojiData.emoji);
  };

  const removeEmoji = (emoji: string) => {
    onAllowedEmojisChange(allowedEmojis.filter((e) => e !== emoji));
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-aqua"></div>
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
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              {"Estilo de comunicaci\u00f3n"}
              <FaInfoCircle className="text-muted-foreground text-xs cursor-help" />
            </label>
            <div className="relative">
              <input
                type="text"
                value={communicationStyle}
                onChange={(e) => onCommunicationStyleChange(e.target.value)}
                placeholder="friendly, concise, and clear"
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
              />
              <div className="absolute right-3 top-3 text-xs text-muted-foreground">
                28/200
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              Estilo de ventas
              <FaInfoCircle className="text-muted-foreground text-xs cursor-help" />
            </label>
            <div className="relative">
              <input
                type="text"
                value={salesStyle}
                onChange={(e) => onSalesStyleChange(e.target.value)}
                placeholder="consultative"
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
              />
              <div className="absolute right-3 top-3 text-xs text-muted-foreground">
                12/200
              </div>
            </div>
          </div>
        </div>

        {/* Longitud de respuesta */}
        <ResponseLengthSlider
          value={responseLength}
          onChange={onResponseLengthChange}
        />

        {/* Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
            <span className="text-sm font-medium text-muted-foreground">
              {"\u00bfUsar emojis?"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useEmojis}
                onChange={(e) => onUseEmojisChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
            <span className="text-sm font-medium text-muted-foreground">
              {"\u00bfUsar signos de apertura (\u00bf)?"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useOpeningSymbols}
                onChange={(e) => onUseOpeningSymbolsChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
            </label>
          </div>
        </div>

        {/* Palabras a evitar */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            Palabras a evitar
            <FaInfoCircle className="text-muted-foreground text-xs cursor-help" />
          </label>
          <input
            type="text"
            value={wordsToAvoid}
            onChange={(e) => onWordsToAvoidChange(e.target.value)}
            placeholder="Escribe palabras separadas por comas"
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>

        {/* Paleta de emojis permitidos */}
        <div className="relative">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            Paleta de emojis permitidos
            <FaInfoCircle className="text-muted-foreground text-xs cursor-help" />
          </label>

          <div className="flex gap-2 items-stretch">
            {/* Input con emojis seleccionados dentro */}
            <div className="flex-1 border border-border rounded-lg p-2 bg-muted min-h-12 flex flex-wrap gap-2 items-center">
              {allowedEmojis.map((emoji) => (
                <div
                  key={emoji}
                  className="relative group inline-flex items-center"
                >
                  <span className="text-xl cursor-pointer hover:scale-110 transition-transform">
                    {emoji}
                  </span>
                  <button
                    onClick={() => removeEmoji(emoji)}
                    className="absolute -top-1 -right-1 bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {"\u00d7"}
                  </button>
                </div>
              ))}

              {allowedEmojis.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Escribe o selecciona emojis de la paleta
                </span>
              )}
            </div>

            {/* Botón selector de emojis a la derecha */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 border border-border rounded-lg bg-muted hover:bg-muted flex items-center justify-center text-xl transition-colors"
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
                <div className="border border-border rounded-lg overflow-hidden shadow-2xl bg-white">
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
  );
}
