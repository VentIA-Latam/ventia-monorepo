import { Megaphone } from "lucide-react";

/**
 * Loader del wizard. El skeleton denso anterior (header + stepper + content
 * bars) generaba layout shift fuerte porque el caller suele ser el EmptyState
 * (un solo panel centrado) o la lista (cards). Esta versión mantiene la
 * continuidad visual con el EmptyState — mismo bloque volt + megáfono —
 * pulsando suave para reducir el "salto" hacia el wizard real.
 */
export default function WizardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-pulse">
        <div className="rounded-lg bg-volt/10 p-4">
          <Megaphone className="h-6 w-6 text-volt" />
        </div>
        <p className="text-xs text-muted-foreground">Cargando editor</p>
      </div>
    </div>
  );
}
