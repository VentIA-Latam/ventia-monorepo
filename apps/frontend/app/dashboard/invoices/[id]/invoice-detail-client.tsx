"use client";

import { Invoice } from "@/lib/types/invoice";
import { useInvoiceActions } from "@/hooks/use-invoice-actions";
import { InvoiceHeader } from "@/components/invoices/invoice-header";
import { InvoiceEmissorCard } from "@/components/invoices/invoice-emissor-card";
import { InvoiceClientCard } from "@/components/invoices/invoice-client-card";
import { InvoiceItemsTable } from "@/components/invoices/invoice-items-table";
import { InvoiceBreakdown } from "@/components/invoices/invoice-breakdown";
import { InvoiceActionsCard } from "@/components/invoices/invoice-actions-card";

interface InvoiceDetailClientProps {
  invoice: Invoice;
}

const formatCurrency = (amount: number | undefined, currency: string) => {
  if (amount === undefined || amount === null) return '-';
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PEN': 'S/',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
  };
  return `${symbols[currency] || currency} ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function InvoiceDetailClient({ invoice: initialInvoice }: InvoiceDetailClientProps) {
  const {
    invoice,
    isDownloadingPDF,
    isDownloadingXML,
    isCheckingStatus,
    emailDialogOpen,
    sendingEmail,
    setEmailDialogOpen,
    handleDownloadPDF,
    handleDownloadXML,
    handleCheckStatus,
    handleOpenEmailDialog,
    handleConfirmSendEmail,
  } = useInvoiceActions(initialInvoice);

  return (
    <div className="space-y-6">
      <InvoiceHeader invoice={invoice} />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <InvoiceEmissorCard invoice={invoice} />
          <InvoiceClientCard invoice={invoice} />
          <InvoiceItemsTable invoice={invoice} formatCurrency={formatCurrency} />
          <InvoiceBreakdown invoice={invoice} formatCurrency={formatCurrency} />
        </div>

        {/* Sidebar */}
        <InvoiceActionsCard
          invoice={invoice}
          isDownloadingPDF={isDownloadingPDF}
          isDownloadingXML={isDownloadingXML}
          isCheckingStatus={isCheckingStatus}
          emailDialogOpen={emailDialogOpen}
          sendingEmail={sendingEmail}
          setEmailDialogOpen={setEmailDialogOpen}
          onDownloadPDF={handleDownloadPDF}
          onDownloadXML={handleDownloadXML}
          onCheckStatus={handleCheckStatus}
          onOpenEmailDialog={handleOpenEmailDialog}
          onConfirmSendEmail={handleConfirmSendEmail}
        />
      </div>
    </div>
  );
}
