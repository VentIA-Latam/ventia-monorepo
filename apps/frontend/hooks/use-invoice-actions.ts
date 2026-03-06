"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Invoice } from "@/lib/types/invoice";

interface UseInvoiceActionsReturn {
  invoice: Invoice;
  isDownloadingPDF: boolean;
  isDownloadingXML: boolean;
  isCheckingStatus: boolean;
  emailDialogOpen: boolean;
  sendingEmail: boolean;
  setEmailDialogOpen: (open: boolean) => void;
  handleDownloadPDF: () => Promise<void>;
  handleDownloadXML: () => Promise<void>;
  handleCheckStatus: () => Promise<void>;
  handleOpenEmailDialog: () => void;
  handleConfirmSendEmail: (email: string, includeXml: boolean) => Promise<void>;
}

export function useInvoiceActions(initialInvoice: Invoice): UseInvoiceActionsReturn {
  const router = useRouter();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingXML, setIsDownloadingXML] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleCheckStatus = async () => {
    try {
      setIsCheckingStatus(true);

      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', response.status, errorData);
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const updatedInvoice = await response.json();
      setInvoice(updatedInvoice);

      if (updatedInvoice.efact_status === 'success') {
        alert('✅ Factura validada exitosamente por SUNAT');
      } else if (updatedInvoice.efact_status === 'error') {
        alert(`❌ Error de validación: ${updatedInvoice.efact_error || 'Error desconocido'}`);
      } else if (updatedInvoice.efact_status === 'processing') {
        alert('⏳ La factura aún está en proceso de validación. Intenta nuevamente en unos segundos.');
      }

      if (updatedInvoice.efact_status !== "processing") {
        router.refresh();
      }
    } catch (err) {
      console.error("Error checking status:", err);
      alert(err instanceof Error ? err.message : "Error al verificar estado");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);

      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al descargar PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.full_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      router.refresh();
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert(err instanceof Error ? err.message : "Error al descargar el PDF");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadXML = async () => {
    try {
      setIsDownloadingXML(true);

      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/xml`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error("Error al descargar XML");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.full_number}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading XML:", err);
      alert(err instanceof Error ? err.message : "Error al descargar el XML");
    } finally {
      setIsDownloadingXML(false);
    }
  };

  const handleOpenEmailDialog = () => {
    if (invoice.efact_status !== "success") {
      toast({
        title: "No se puede enviar",
        description: "Solo se pueden enviar comprobantes con estado exitoso.",
        variant: "destructive",
      });
      return;
    }

    if (!invoice.cliente_email) {
      toast({
        title: "Advertencia",
        description: "El comprobante no tiene un email registrado. Deberás ingresarlo manualmente.",
        variant: "default",
      });
    }

    setEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async (email: string, includeXml: boolean) => {
    setSendingEmail(true);
    try {
      const response = await fetch(`/api/invoices/send-email/${invoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: email,
          include_xml: includeXml,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el email");
      }

      toast({
        title: "Email enviado",
        description: `El comprobante ha sido enviado a ${data.sent_to}`,
      });

      setEmailDialogOpen(false);
    } catch (err) {
      console.error("Error sending email:", err);
      toast({
        title: "Error al enviar email",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return {
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
  };
}
