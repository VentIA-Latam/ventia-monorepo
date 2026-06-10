"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessToken } from "@/hooks/use-access-token";
import { useToast } from "@/hooks/use-toast";
import { fetchCampaignRecipients } from "@/lib/services/campaigns-service";
import type { Campaign } from "@/lib/types/campaign";
import {
  CAMPAIGN_WIZARD_STEPS,
  WizardStepper,
} from "@/components/dashboard/campaigns/wizard-stepper";

// Code-split por step para reducir initial bundle del wizard.
// react-dropzone (step 3), react-hook-form/zod (steps 1 y 3) y CSV preview rendering
// se cargan solo cuando el usuario navega al step correspondiente. `ssr: false` ya
// aplica porque este wrapper es "use client".
const StepSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-72" />
    <Skeleton className="h-32 w-full" />
    <div className="flex justify-between pt-4">
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-9 w-28" />
    </div>
  </div>
);

const Step1Basics = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step1-basics").then(
      (m) => m.Step1Basics
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);
const Step2Template = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step2-template").then(
      (m) => m.Step2Template
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);
const Step3Audience = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step3-audience").then(
      (m) => m.Step3Audience
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);
const Step4Variables = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step4-variables").then(
      (m) => m.Step4Variables
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);
const Step5Preview = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step5-preview").then(
      (m) => m.Step5Preview
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);
const Step6Schedule = dynamic(
  () =>
    import("@/components/dashboard/campaigns/step6-schedule").then(
      (m) => m.Step6Schedule
    ),
  { loading: () => <StepSkeleton />, ssr: false }
);

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
  const accessToken = useAccessToken();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [step, setStep] = useState(initialStep);

  // CSV columns — source of truth es `campaign.csv_columns` (lo trae el backend
  // en cada GET /campaigns/:id). Init desde ahí. Step 3 pushea via setCsvColumns
  // al subir el CSV (no esperamos re-fetch). El fallback de fetch abajo cubre
  // backends viejos que aún no devuelven csv_columns.
  const [csvColumns, setCsvColumns] = useState<string[]>(
    () => campaign.csv_columns ?? []
  );

  // Fallback: si la audiencia es CSV, tiene recipients y no tenemos columnas,
  // intentamos leer del primer recipient (requiere que el backend devuelva
  // `vars`).
  useEffect(() => {
    if (campaign.audience_type !== "csv") return;
    if (!accessToken) return;
    if (csvColumns.length > 0) return;
    if (campaign.recipients_count === 0) return;
    let cancelled = false;
    fetchCampaignRecipients(accessToken, campaign.id, {
      page: 1,
      per_page: 1,
    })
      .then((res) => {
        if (cancelled) return;
        const first = res.data[0] as { vars?: Record<string, unknown> } | undefined;
        if (!first) return;
        const cols = Object.keys(first.vars ?? {});
        if (cols.length > 0) setCsvColumns(cols);
      })
      .catch(() => {
        /* sin info — el step caerá a free-text */
      });
    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    campaign.id,
    campaign.audience_type,
    campaign.recipients_count,
    csvColumns.length,
  ]);

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
      // Invalidá RSC payload para que la lista refleje el nuevo status al volver.
      router.refresh();
    },
    [campaign.id, router, toast]
  );

  return (
    <div data-testid="campaign-wizard" data-step={step} className="space-y-6">
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
            onCampaignChanged={onCampaignUpdate}
            onCsvColumnsDetected={setCsvColumns}
          />
        )}
        {step === 4 && (
          <Step4Variables
            campaign={campaign}
            templates={templates}
            csvColumns={csvColumns}
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
  // Como mucho llegamos a 5 si todo anterior está OK (incluyendo step 4 implícito
  // cuando el template no tiene variables — en ese caso max queda en 3 pero el step 4
  // se "completa" automáticamente al pasar). Por eso usamos >=.
  if (max >= 4) max = 5;
  // Si el template no tiene variables y la audiencia está cargada, podemos saltar a 5.
  if (max === 3 && !templateNeedsVariables(c)) max = 5;
  return max;
}

function templateNeedsVariables(c: Campaign): boolean {
  // No tenemos el template completo acá; aproximación: si el campaign tiene
  // header_media_url O variables ya guardadas, asumimos que sí tiene.
  // Caso contrario (template sin {{N}}), el step 4 puede skiparse.
  return Object.keys(c.template_params?.variables ?? {}).length > 0;
}
