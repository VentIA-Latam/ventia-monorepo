"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  Mail,
} from "lucide-react";
import { Invoice } from "@/lib/types/invoice";
import { formatDateTime } from "@/lib/utils";
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";

interface InvoiceActionsCardProps {
  invoice: Invoice;
  isDownloadingPDF: boolean;
  isDownloadingXML: boolean;
  isCheckingStatus: boolean;
  emailDialogOpen: boolean;
  sendingEmail: boolean;
  setEmailDialogOpen: (open: boolean) => void;
  onDownloadPDF: () => Promise<void>;
  onDownloadXML: () => Promise<void>;
  onCheckStatus: () => Promise<void>;
  onOpenEmailDialog: () => void;
  onConfirmSendEmail: (email: string, includeXml: boolean) => Promise<void>;
  basePath?: string;
}

export function InvoiceActionsCard({
  invoice,
  isDownloadingPDF,
  isDownloadingXML,
  isCheckingStatus,
  emailDialogOpen,
  sendingEmail,
  setEmailDialogOpen,
  onDownloadPDF,
  onDownloadXML,
  onCheckStatus,
  onOpenEmailDialog,
  onConfirmSendEmail,
  basePath = '/dashboard',
}: InvoiceActionsCardProps) {
  return (
    <div className="space-y-6">
      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Botón Verificar Estado - visible cuando está en processing o error */}
          {(invoice.efact_status === 'processing' || invoice.efact_status === 'error') && (
            <Button
              className="w-full"
              variant="secondary"
              size="sm"
              onClick={onCheckStatus}
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Estado
                </>
              )}
            </Button>
          )}

          {/* Botón Enviar por Correo */}
          {invoice.efact_status === 'success' && (
            <Button
              variant="secondary"
              className="w-full"
              size="sm"
              onClick={onOpenEmailDialog}
              disabled={sendingEmail}
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar por Correo
            </Button>
          )}

          {/* Botón Descargar PDF */}
          <Button
            className="w-full"
            size="sm"
            onClick={onDownloadPDF}
            disabled={isDownloadingPDF || invoice.efact_status !== 'success'}
          >
            {isDownloadingPDF ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </>
            )}
          </Button>

          {/* Botón Descargar XML */}
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            onClick={onDownloadXML}
            disabled={isDownloadingXML}
          >
            {isDownloadingXML ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar XML
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Información de Emisión */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Emisión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha de Emisión
            </p>
            <p className="font-medium mt-1">{formatDateTime(invoice.created_at)}</p>
          </div>
          {invoice.efact_processed_at && (
            <div>
              <p className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Fecha de Validación
              </p>
              <p className="font-medium mt-1">{formatDateTime(invoice.efact_processed_at)}</p>
            </div>
          )}
          {invoice.efact_ticket && (
            <div>
              <p className="text-muted-foreground">Ticket eFact</p>
              <p className="font-mono text-xs mt-1 break-all">{invoice.efact_ticket}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orden Relacionada */}
      <Card>
        <CardHeader>
          <CardTitle>Orden Relacionada</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={`${basePath}/orders/${invoice.order_id}`}>
            <Button variant="outline" className="w-full" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Ver Orden #{invoice.order_id}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Modal de Envío de Email */}
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        invoice={invoice}
        onConfirm={onConfirmSendEmail}
        loading={sendingEmail}
      />
    </div>
  );
}
