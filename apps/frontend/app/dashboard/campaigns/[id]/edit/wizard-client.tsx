"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Campaign } from "@/lib/types/campaign";
import {
  CAMPAIGN_WIZARD_STEPS,
  WizardStepper,
} from "../../_components/wizard-stepper";
import { Step1Basics } from "../../_components/step1-basics";
import { Step2Template } from "../../_components/step2-template";
import { Step3Audience } from "../../_components/step3-audience";
import { Step4Variables } from "../../_components/step4-variables";
import { Step5Preview } from "../../_components/step5-preview";
import { Step6Schedule } from "../../_components/step6-schedule";

interface Props {
  campaign: Campaign;
  inboxes: unknown[];
  templates: unknown[];
  labels: unknown[];
  initialStep: number;
}

export function WizardClient({
  campaign: initialCampaign,
  inboxes,
  templates,
  labels,
  initialStep,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [step, setStep] = useState(initialStep);

  // Derivamos cuál es el step máximo que el usuario "completó" según el state del campaign.
  // Esto permite navegar atrás pero NO saltar adelante.
  const maxCompletedStep = useMemo(
    () => computeMaxCompletedStep(campaign),
    [campaign]
  );

  const goToStep = useCallback(
    (next: number) => {
      setStep(next);
      router.replace(`/dashboard/campaigns/${campaign.id}/edit?step=${next}`, {
        scroll: false,
      });
    },
    [campaign.id, router]
  );

  // Helper para que cada step pueda mutar la campaign localmente cuando guarda.
  const onCampaignUpdate = useCallback((updated: Campaign) => {
    setCampaign(updated);
  }, []);

  const onCancel = useCallback(() => {
    router.push("/dashboard/campaigns");
  }, [router]);

  const onTriggered = useCallback(
    (mode: "now" | "scheduled") => {
      toast({
        title:
          mode === "now"
            ? "Campaña enviándose"
            : "Campaña programada",
        description:
          mode === "now"
            ? "Los mensajes se están encolando. Verás el progreso en tiempo real."
            : "Se disparará en la fecha indicada.",
      });
      router.push(`/dashboard/campaigns/${campaign.id}`);
    },
    [campaign.id, router, toast]
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a campañas
        </button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <WizardStepper
          steps={CAMPAIGN_WIZARD_STEPS}
          currentStep={step}
          maxCompletedStep={maxCompletedStep}
          onStepClick={goToStep}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {step === 1 && (
          <Step1Basics
            campaign={campaign}
            inboxes={inboxes}
            onSaved={(updated) => {
              onCampaignUpdate(updated);
              goToStep(2);
            }}
          />
        )}
        {step === 2 && (
          <Step2Template
            campaign={campaign}
            templates={templates}
            onSaved={(updated) => {
              onCampaignUpdate(updated);
              goToStep(3);
            }}
            onBack={() => goToStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Audience
            campaign={campaign}
            labels={labels}
            onSaved={(updated) => {
              onCampaignUpdate(updated);
              goToStep(4);
            }}
            onBack={() => goToStep(2)}
          />
        )}
        {step === 4 && (
          <Step4Variables
            campaign={campaign}
            templates={templates}
            onSaved={(updated) => {
              onCampaignUpdate(updated);
              goToStep(5);
            }}
            onBack={() => goToStep(3)}
          />
        )}
        {step === 5 && (
          <Step5Preview
            campaign={campaign}
            onContinue={() => goToStep(6)}
            onBack={() => goToStep(4)}
          />
        )}
        {step === 6 && (
          <Step6Schedule
            campaign={campaign}
            onTriggered={onTriggered}
            onBack={() => goToStep(5)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Decide cuál es el paso máximo "completado" para habilitar navegación clickeable.
 * Lógica:
 * - 1: siempre completado (campaign existe)
 * - 2: completado si template_params.name está set
 * - 3: completado si recipients_count > 0
 * - 4: completado si template_params.variables tiene al menos una entry o el template no tiene vars
 * - 5: completado si el preview fue visto (no se persiste; consideramos completado si llegamos a 6)
 * - 6: la campaña ya no es :draft después del trigger
 */
function computeMaxCompletedStep(c: Campaign): number {
  let max = 1;
  const tp = c.template_params;
  if (tp?.name) max = 2;
  if (c.recipients_count > 0) max = Math.max(max, 3);
  if (tp?.variables && Object.keys(tp.variables).length > 0) {
    max = Math.max(max, 4);
  }
  // Preview/schedule no persisten state previo al trigger.
  // Como mucho llegamos a 5 si todo anterior está OK.
  if (max === 4) max = 5;
  return max;
}
