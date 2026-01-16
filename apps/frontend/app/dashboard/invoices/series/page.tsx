import { InvoiceSerie } from "@/lib/types/invoice";
import { getAccessToken } from "@/lib/auth0";
import { InvoiceSeriesClientView } from "./series-client";

/**
 * Server Component - Carga de series de facturación
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchInvoiceSeries(): Promise<InvoiceSerie[]> {
  try {
    const token = await getAccessToken();

    if (!token) {
      console.error("No access token available");
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/invoice-series`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch invoice series:", response.statusText);
      return [];
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching invoice series:", error);
    return [];
  }
}

export default async function InvoiceSeriesPage() {
  const series = await fetchInvoiceSeries();
  return <InvoiceSeriesClientView initialSeries={series} />;
}
