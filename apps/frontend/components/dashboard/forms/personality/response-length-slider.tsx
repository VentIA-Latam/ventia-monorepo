"use client";

import { FaInfoCircle } from "react-icons/fa";

const RESPONSE_LENGTH_LABELS = [
  "Muy conciso",
  "Conciso",
  "Equilibrado",
  "Detallado",
  "Muy detallado",
];

interface ResponseLengthSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function ResponseLengthSlider({
  value,
  onChange,
}: ResponseLengthSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          Longitud de respuesta
          <FaInfoCircle className="text-muted-foreground text-xs cursor-help" />
        </label>
        <span className="text-sm text-ventia-blue font-medium">
          {RESPONSE_LENGTH_LABELS[value]}
        </span>
      </div>
      <div className="space-y-2">
        {/* Slider container */}
        <div
          className="relative h-10 cursor-pointer"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={value}
          aria-valuetext={RESPONSE_LENGTH_LABELS[value]}
        >
          {/* Background track with border */}
          <div className="absolute inset-0 bg-muted border border-border rounded-full overflow-hidden">
            {/* Clickable segments - invisible but functional */}
            <div className="absolute inset-0 flex">
              {RESPONSE_LENGTH_LABELS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => onChange(index)}
                  className="flex-1 h-full bg-transparent transition-colors hover:bg-black/5"
                  aria-label={`Seleccionar nivel ${RESPONSE_LENGTH_LABELS[index]}`}
                />
              ))}
            </div>

            {/* Divider lines between segments */}
            <div className="absolute inset-0 flex pointer-events-none z-10">
              {RESPONSE_LENGTH_LABELS.slice(1).map((_, index) => (
                <div
                  key={index}
                  className="h-full shrink-0 grow-0 border-l border-border/70"
                  style={{
                    width: `${100 / RESPONSE_LENGTH_LABELS.length}%`,
                    marginLeft: index === 0 ? `${100 / RESPONSE_LENGTH_LABELS.length}%` : '0'
                  }}
                />
              ))}
            </div>

            {/* Progress fill - from start to end of selected segment */}
            <div
              className="absolute left-0 top-0 h-full bg-muted/30 rounded-l-full transition-all duration-300"
              style={{
                width: `${((value + 1) / RESPONSE_LENGTH_LABELS.length) * 100}%`,
              }}
            />

            {/* Position indicators - one per segment, centered */}
            <div className="absolute inset-0 flex pointer-events-none z-20">
              {RESPONSE_LENGTH_LABELS.map((_, index) => (
                <div
                  key={index}
                  className="flex-1 flex items-center justify-center"
                >
                  <div
                    className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-all duration-300 ${
                      index === value
                        ? "bg-muted-foreground scale-100"
                        : "bg-transparent scale-0"
                    }`}
                  >
                    {index === value && (
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
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute w-full opacity-0 cursor-pointer z-30 inset-0"
          />
        </div>

        {/* Labels */}
        <div className="flex">
          {RESPONSE_LENGTH_LABELS.map((label, index) => (
            <button
              key={label}
              onClick={() => onChange(index)}
              className={`flex-1 text-center text-xs transition-all ${
                index === value
                  ? "font-semibold text-ventia-blue"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
