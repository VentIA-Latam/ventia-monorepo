"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail } from "lucide-react";
import { Invoice } from "@/lib/types/invoice";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onConfirm: (email: string, includeXml: boolean) => Promise<void>;
  loading: boolean;
}

/**
 * Dialog de confirmación para envío de facturas por email
 *
 * Características:
 * - Campo de email pre-llenado y editable
 * - Opción para incluir XML firmado
 * - Validación HTML5 de formato de email
 * - Manejo de estados de carga
 */
export function SendEmailDialog({
  open,
  onOpenChange,
  invoice,
  onConfirm,
  loading,
}: SendEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [includeXml, setIncludeXml] = useState(false);

  // Pre-llenar email cuando se abre el dialog
  useEffect(() => {
    if (open && invoice?.cliente_email) {
      setEmail(invoice.cliente_email);
    }
  }, [open, invoice]);

  // Reset state cuando se cierra
  useEffect(() => {
    if (!open) {
      setIncludeXml(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación adicional
    if (!email.trim()) {
      return;
    }

    await onConfirm(email.trim(), includeXml);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Comprobante por Email
            </DialogTitle>
            <DialogDescription>
              Enviar {invoice.full_number} a tu cliente por correo electrónico
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Campo de Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email del destinatario <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
              <p className="text-xs text-gray-500">
                El comprobante será enviado a esta dirección de email
              </p>
            </div>

            {/* Checkbox para incluir XML */}
            <div className="flex items-start space-x-3 space-y-0">
              <Checkbox
                id="includeXml"
                checked={includeXml}
                onCheckedChange={(checked) => setIncludeXml(checked === true)}
                disabled={loading}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="includeXml"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Incluir archivo XML firmado
                </Label>
                <p className="text-xs text-gray-500">
                  Adjuntar el XML electrónico validado por SUNAT (opcional)
                </p>
              </div>
            </div>

            {/* Información del comprobante */}
            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Comprobante:</span>
                <span className="font-medium">{invoice.full_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium">{invoice.cliente_razon_social}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">
                  {invoice.currency} {invoice.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
