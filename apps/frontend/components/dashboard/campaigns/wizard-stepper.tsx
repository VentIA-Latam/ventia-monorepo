"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  index: number; // 1-based
  label: string;
}

interface Props {
  steps: WizardStep[];
  currentStep: number; // 1-based
  /** Cuál es el máximo step ya completado (pasos previos clickeables). */
  maxCompletedStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepper({
  steps,
  currentStep,
  maxCompletedStep,
  onStepClick,
}: Props) {
  return (
    <ol data-testid="wizard-stepper" className="flex w-full items-center gap-2">
      {steps.map((step, i) => {
        const status: "completed" | "current" | "upcoming" =
          step.index < currentStep
            ? "completed"
            : step.index === currentStep
              ? "current"
              : "upcoming";
        const clickable = step.index <= maxCompletedStep && step.index !== currentStep;

        return (
          <li key={step.index} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              data-testid={`wizard-step-${step.index}`}
              data-status={status}
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step.index)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md py-2 text-left text-xs font-medium transition",
                clickable && "cursor-pointer hover:bg-muted",
                !clickable && "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  status === "completed" &&
                    "bg-[var(--marino)] text-background",
                  status === "current" && "bg-volt text-background",
                  status === "upcoming" && "bg-muted text-muted-foreground"
                )}
              >
                {status === "completed" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.index
                )}
              </span>
              <span
                className={cn(
                  "truncate",
                  status === "current"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1",
                  step.index < currentStep
                    ? "bg-[var(--marino)]"
                    : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Default steps usados en el wizard de campañas
export const CAMPAIGN_WIZARD_STEPS: WizardStep[] = [
  { index: 1, label: "Datos" },
  { index: 2, label: "Template" },
  { index: 3, label: "Audiencia" },
  { index: 4, label: "Variables" },
  { index: 5, label: "Preview" },
  { index: 6, label: "Programar" },
];
