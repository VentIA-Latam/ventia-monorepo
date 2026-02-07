import { Invoice } from "@/lib/types/invoice";
import { fetchInvoices } from "@/lib/services/invoice-service";
import { getAccessToken } from "@/lib/auth0";
import { InvoicesClientView } from "./invoices-client";
import { FileText } from "lucide-react";

// Forzar renderizado dinámico (SSR) porque usa cookies para auth
export const dynamic = 'force-dynamic';

/**
 * Server Component - Carga de datos segura
 * 
 * Esta página es un Server Component (sin "use client"), lo que significa:
 * 1. Se ejecuta SOLO en el servidor de Next.js
 * 2. Puede usar getAccessToken() directamente de Auth0
 * 3. El token NUNCA llega al navegador del usuario
 * 4. Hace el fetch al backend de forma segura usando invoice-service
 * 5. Pasa los datos ya cargados al Client Component para la interactividad
 */

export default async function InvoicesPage() {
  let invoices: Invoice[] = [];
  let error: string | null = null;

  try {
    // 1. Obtener el token directamente desde Auth0 (en el servidor)
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("No estás autenticado");
    }

    // 2. Hacer el fetch al backend con el token (usando el service)
    const response = await fetchInvoices(accessToken, {
      skip: 0,
      limit: 1000,
    });

    invoices = response.items;
  } catch (err) {
    console.error("Error loading invoices:", err);
    error = err instanceof Error ? err.message : "Error al cargar comprobantes";
  }

  // Si hay un error, mostramos un mensaje
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Comprobantes Electrónicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona facturas, boletas y comprobantes electrónicos
          </p>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar comprobantes</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // 3. Pasar los comprobantes al Client Component para manejar la interactividad
  return <InvoicesClientView initialInvoices={invoices} />;
}


