"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Invoice,
  INVOICE_TYPE_NAMES,
  INVOICE_STATUS_NAMES,
  INVOICE_STATUS_COLORS,
} from "@/lib/types/invoice";

interface InvoiceHeaderProps {
  invoice: Invoice;
  basePath?: string;
}

export function InvoiceHeader({ invoice, basePath = '/dashboard' }: InvoiceHeaderProps) {
  const tipoComprobante = INVOICE_TYPE_NAMES[invoice.invoice_type] || invoice.invoice_type;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`${basePath}/invoices`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Facturación
            </Button>
          </Link>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex text-sm text-muted-foreground">
        <Link href={basePath} className="hover:text-foreground">
          {basePath === '/dashboard' ? 'Dashboard' : 'SuperAdmin'}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`${basePath}/invoices`} className="hover:text-foreground">
          Facturación
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{invoice.full_number}</span>
      </nav>

      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading">
            {tipoComprobante}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">{invoice.full_number}</p>
        </div>
        <Badge className={`${INVOICE_STATUS_COLORS[invoice.efact_status]} text-sm px-3 py-1`}>
          {invoice.efact_status === 'success' && <CheckCircle className="h-4 w-4 mr-1" />}
          {invoice.efact_status === 'error' && <XCircle className="h-4 w-4 mr-1" />}
          {invoice.efact_status === 'processing' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {INVOICE_STATUS_NAMES[invoice.efact_status]}
        </Badge>
      </div>

      {/* Error message */}
      {invoice.efact_status === 'error' && invoice.efact_error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de SUNAT</AlertTitle>
          <AlertDescription>{invoice.efact_error}</AlertDescription>
        </Alert>
      )}

      {/* Processing message */}
      {invoice.efact_status === 'processing' && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>En proceso</AlertTitle>
          <AlertDescription>
            La factura está siendo procesada por SUNAT. Esto puede tomar unos minutos.
            {invoice.efact_ticket && ` Ticket: ${invoice.efact_ticket}`}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
