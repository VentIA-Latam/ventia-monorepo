import { fetchReminderMessages } from "@/lib/services/reminder-service";
import { getAccessToken } from "@/lib/auth0";
import { RemindersClient } from "./reminders-client";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  let error: string | null = null;
  let data = null;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("No estas autenticado");
    }
    data = await fetchReminderMessages(accessToken);
  } catch (err) {
    console.error("Error loading reminders:", err);
    error = err instanceof Error ? err.message : "Error al cargar recordatorios";
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Recordatorios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los mensajes de seguimiento automatico
          </p>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar recordatorios</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return <RemindersClient initialData={data} />;
}
