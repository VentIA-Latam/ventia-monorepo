"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Receipt,
  Search,
  Trash2,
  Plus,
  Eye,
  FileText,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  User,
  ShoppingBag,
  DollarSign,
  Loader2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tipos de datos
type DocumentType = "01" | "03";
type CurrencyType = "PEN" | "USD";
type ClientDocType = "DNI" | "RUC";

interface InvoiceItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  igv: number;
  total: number;
}

interface ClientInfo {
  docType: ClientDocType;
  docNumber: string;
  name: string;
  address: string;
  email: string;
}

export default function NewInvoicePage() {
  // Estados del comprobante
  const [documentType, setDocumentType] = useState<DocumentType>("03");
  const [serie, setSerie] = useState<string>("");
  const [correlativo, setCorrelativo] = useState<string>("00001");
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState<CurrencyType>("PEN");

  // Estados del cliente
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    docType: "DNI",
    docNumber: "",
    name: "",
    address: "",
    email: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [documentValid, setDocumentValid] = useState<boolean | null>(null);

  // Estados de items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: "1",
      sku: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      igv: 0,
      total: 0,
    },
  ]);

  // Estado de descuento global
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  // Estado del modal de confirmación
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [observations, setObservations] = useState<string>("");

  // Estados de emisión
  type EmissionState = "idle" | "confirming" | "loading" | "success" | "error";
  const [emissionState, setEmissionState] = useState<EmissionState>("idle");
  const [emissionError, setEmissionError] = useState<string>("");
  const [generatedDocumentId, setGeneratedDocumentId] = useState<string>("");
  const [emissionTimeout, setEmissionTimeout] = useState<NodeJS.Timeout | null>(null);

  // Series disponibles (mock - debe venir del backend)
  const availableSeries = [
    { value: "F001", label: "F001" },
    { value: "B001", label: "B001" },
    { value: "B002", label: "B002" },
  ];

  // Cálculos automáticos
  const calculateItemTotal = (quantity: number, unitPrice: number) => {
    const subtotal = quantity * unitPrice;
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    return { igv, total };
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          if (field === "quantity" || field === "unitPrice") {
            const { igv, total } = calculateItemTotal(
              field === "quantity" ? value : item.quantity,
              field === "unitPrice" ? value : item.unitPrice
            );
            updatedItem.igv = igv;
            updatedItem.total = total;
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      sku: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      igv: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  // Cálculos del resumen
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    return sum + itemSubtotal;
  }, 0);

  const totalIGV = subtotal * 0.18;
  const totalToPay = subtotal + totalIGV - globalDiscount;

  // Validación de documento
  const validateDocument = (docType: ClientDocType, docNumber: string) => {
    if (docType === "DNI") {
      return /^\d{8}$/.test(docNumber);
    } else if (docType === "RUC") {
      return /^\d{11}$/.test(docNumber);
    }
    return false;
  };

  useEffect(() => {
    if (clientInfo.docNumber) {
      const isValid = validateDocument(clientInfo.docType, clientInfo.docNumber);
      setDocumentValid(isValid);
    } else {
      setDocumentValid(null);
    }
  }, [clientInfo.docNumber, clientInfo.docType]);

  // Búsqueda SUNAT (mock)
  const searchSUNAT = async () => {
    setIsSearching(true);

    // Simulación de llamada API
    setTimeout(() => {
      if (clientInfo.docType === "RUC" && clientInfo.docNumber === "20548923011") {
        setClientInfo({
          ...clientInfo,
          name: "Tecnologías y Servicios S.A.C.",
          address: "Av. Javier Prado Este 456, San Isidro, Lima",
          email: "facturacion@tecniservicios.pe",
        });
      } else if (clientInfo.docType === "DNI" && clientInfo.docNumber === "20548892") {
        setClientInfo({
          ...clientInfo,
          name: "Juan Carlos Pérez López",
          address: "Calle Las Flores 123, Lima",
          email: "",
        });
      }
      setIsSearching(false);
    }, 1000);
  };

  // Validación del formulario
  const isFormValid = () => {
    return (
      documentType &&
      serie &&
      correlativo &&
      issueDate &&
      currency &&
      clientInfo.docNumber &&
      documentValid &&
      clientInfo.name &&
      items.length > 0 &&
      items.every((item) => item.description && item.quantity > 0 && item.unitPrice > 0)
    );
  };

  const handlePreview = () => {
    console.log("Previsualizando documento...");
    // Implementar lógica de previsualización
  };

  const handleGenerate = () => {
    // Abrir modal de confirmación
    setEmissionState("confirming");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmEmission = async () => {
    // Cambiar a estado loading
    setEmissionState("loading");
    setEmissionError("");

    let timedOut = false;

    // Configurar timeout de 30 segundos
    const timeout = setTimeout(() => {
      timedOut = true;
      setEmissionState("error");
      setEmissionError("Tiempo de espera agotado. El servidor no respondió en 30 segundos. Por favor, intente nuevamente.");
    }, 30000);

    setEmissionTimeout(timeout);

    try {
      // Simulación de llamada al API (reemplazar con llamada real)
      await new Promise((resolve) => setTimeout(resolve, 6000)); // Simular 35 segundos para forzar timeout

      // Limpiar timeout si la respuesta llega antes
      clearTimeout(timeout);

      // Solo establecer éxito si no hubo timeout
      if (!timedOut) {
        // Simulación de respuesta exitosa
        const mockDocumentId = `${serie}-${correlativo}`;
        setGeneratedDocumentId(mockDocumentId);
        setEmissionState("success");
      }

    } catch (error) {
      clearTimeout(timeout);
      if (!timedOut) {
        setEmissionState("error");
        setEmissionError("Error al emitir el comprobante. Por favor, verifique los datos e intente nuevamente.");
      }
    }
  };

  const handleCancelEmission = () => {
    if (emissionTimeout) {
      clearTimeout(emissionTimeout);
    }
    setEmissionState("idle");
    setIsConfirmModalOpen(false);
    setEmissionError("");
  };

  const handleRetryEmission = () => {
    setEmissionState("confirming");
    setEmissionError("");
  };

  return (
    <div className="mx-auto w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Nueva Emisión Electrónica
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Complete la información para generar el comprobante fiscal
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
        >
          Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal - Formulario */}
        <div className="lg:col-span-2 space-y-6">

          {/* Datos del Comprobante */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Datos del Comprobante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo de Documento */}
                <div className="space-y-2">
                  <Label htmlFor="documentType">Tipo de Documento</Label>
                  <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                    <SelectTrigger id="documentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Factura Electrónica (01)</SelectItem>
                      <SelectItem value="03">Boleta de Venta (03)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Serie */}
                <div className="space-y-2">
                  <Label htmlFor="serie">Serie</Label>
                  <Select value={serie} onValueChange={setSerie}>
                    <SelectTrigger id="serie">
                      <SelectValue placeholder="Seleccione serie" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSeries.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Correlativo */}
                <div className="space-y-2">
                  <Label htmlFor="correlativo">Correlativo</Label>
                  <Input
                    id="correlativo"
                    value={correlativo}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                {/* Fecha de Emisión */}
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Fecha de Emisión</Label>
                  <div className="relative">
                    <Input
                      id="issueDate"
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      min={
                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split("T")[0]
                      }
                      className="pr-10"
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Moneda */}
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyType)}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PEN">Soles (PEN)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5" />
                Información del Cliente
              </CardTitle>
              <CardDescription>
                Buscar Cliente (RUC / DNI)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Documento del Cliente */}
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clientDocType"
                      value="DNI"
                      checked={clientInfo.docType === "DNI"}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, docType: "DNI", docNumber: "" })
                      }
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">DNI</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clientDocType"
                      value="RUC"
                      checked={clientInfo.docType === "RUC"}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, docType: "RUC", docNumber: "" })
                      }
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">RUC</span>
                  </label>
                </div>
              </div>

              {/* Número de Documento con Búsqueda */}
              <div className="space-y-2">
                <Label htmlFor="clientDoc">
                  Número de Documento
                  {documentValid === true && (
                    <CheckCircle2 className="inline-block ml-2 h-4 w-4 text-green-500" />
                  )}
                  {documentValid === false && (
                    <AlertCircle className="inline-block ml-2 h-4 w-4 text-red-500" />
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="clientDoc"
                    placeholder={
                      clientInfo.docType === "DNI"
                        ? "Ingrese DNI (8 dígitos)"
                        : "Ingrese RUC (11 dígitos)"
                    }
                    value={clientInfo.docNumber}
                    onChange={(e) =>
                      setClientInfo({ ...clientInfo, docNumber: e.target.value })
                    }
                    maxLength={clientInfo.docType === "DNI" ? 8 : 11}
                    className={cn(
                      documentValid === false && "border-red-500"
                    )}
                  />
                  <Button
                    onClick={searchSUNAT}
                    disabled={!documentValid || isSearching}
                    className="shrink-0"
                  >
                    {isSearching ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
                {documentValid === true && clientInfo.docNumber && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Documento válido en SUNAT
                  </p>
                )}
              </div>

              <Separator />

              {/* Nombre / Razón Social */}
              <div className="space-y-2">
                <Label htmlFor="clientName">
                  {clientInfo.docType === "RUC" ? "Razón Social" : "Nombre Completo"}
                </Label>
                <Input
                  id="clientName"
                  placeholder="Nombre del cliente"
                  value={clientInfo.name}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, name: e.target.value })
                  }
                />
              </div>

              {/* Dirección Fiscal */}
              <div className="space-y-2">
                <Label htmlFor="clientAddress">Dirección Fiscal</Label>
                <Input
                  id="clientAddress"
                  placeholder="Dirección completa"
                  value={clientInfo.address}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, address: e.target.value })
                  }
                />
              </div>

              {/* Correo Electrónico */}
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Correo Electrónico</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={clientInfo.email}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, email: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Detalle de Venta */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Receipt className="h-5 w-5" />
                  Detalle de Venta
                </CardTitle>
                <Button onClick={addItem} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">
                        Código SKU
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">
                        Descripción
                      </th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-600">
                        Cant.
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">
                        P. Unit.
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">
                        IGV Item
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">
                        Total
                      </th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <Input
                            placeholder="SKU"
                            value={item.sku}
                            onChange={(e) => updateItem(item.id, "sku", e.target.value)}
                            className="min-w-[100px]"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            placeholder="Descripción del producto"
                            value={item.description}
                            onChange={(e) =>
                              updateItem(item.id, "description", e.target.value)
                            }
                            className="min-w-[200px]"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, "quantity", parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-right"
                          />
                        </td>
                        <td className="py-3 px-2 text-right text-sm">
                          {currency} {item.igv.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-sm font-medium">
                          {currency} {item.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Lateral - Resumen */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Resumen de Importes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Op. Gravada */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Op. Gravada</span>
                <span className="text-sm font-medium">
                  {currency} {subtotal.toFixed(2)}
                </span>
              </div>

              <Separator />

              {/* Op. Inafecta */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Op. Inafecta</span>
                <span className="text-sm font-medium">
                  {currency} 0.00
                </span>
              </div>

              <Separator />

              {/* IGV (18%) */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IGV (18%)</span>
                <span className="text-sm font-medium">
                  {currency} {totalIGV.toFixed(2)}
                </span>
              </div>

              <Separator />

              {/* Descuento Global */}
              <div className="space-y-2">
                <Label htmlFor="discount" className="text-sm text-gray-600">
                  Descuento Global
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">-</span>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                    className="text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <Separator className="my-4" />

              {/* Total a Pagar */}
              <div className="bg-primary/5 rounded-lg p-4 space-y-1">
                <p className="text-sm text-gray-600">Total a Pagar</p>
                <p className="text-3xl font-bold text-primary">
                  {currency} {totalToPay.toFixed(2)}
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-3 pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handlePreview}
                  disabled={!isFormValid()}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Previsualizar PDF
                </Button>
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!isFormValid()}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Documento
                </Button>
              </div>

              {/* Advertencia de validación */}
              {!isFormValid() && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    Complete todos los campos requeridos para generar el documento
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Confirmación de Emisión */}
      <Dialog open={isConfirmModalOpen} onOpenChange={(open) => {
        if (!open && emissionState !== "loading") {
          handleCancelEmission();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto backdrop-blur-sm">
          {/* Estado: Confirmación */}
          {emissionState === "confirming" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                  Emitir {documentType === "01" ? "Factura" : "Boleta"} Electrónica
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Serie: <span className="font-semibold text-blue-600">{serie || (documentType === "01" ? "F001" : "B001")}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Datos del Cliente */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <User className="h-4 w-4" />
                    <span>Datos del Cliente</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Cliente</p>
                        <p className="text-sm font-medium text-gray-900">{clientInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">{clientInfo.docType} / RUC</p>
                        <p className="text-sm font-medium text-gray-900">{clientInfo.docNumber}</p>
                      </div>
                    </div>
                    {clientInfo.address && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Dirección Fiscal</p>
                        <p className="text-sm text-gray-700">{clientInfo.address}</p>
                      </div>
                    )}
                    {clientInfo.email && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Email</p>
                        <p className="text-sm text-gray-700">{clientInfo.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Detalle de Productos */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <ShoppingBag className="h-4 w-4" />
                    <span>Detalle de Productos</span>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase">
                              Producto
                            </th>
                            <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 uppercase">
                              Cant.
                            </th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase">
                              P. Unit.
                            </th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 px-3 text-gray-900">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 text-center text-gray-700">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700">
                                {currency} {item.unitPrice.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-gray-900">
                                {currency} {item.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Desglose Financiero */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <DollarSign className="h-4 w-4" />
                    <span>Resumen Financiero</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Op. Gravada</span>
                      <span className="text-sm font-medium text-gray-900">
                        {currency} {subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">IGV (18%)</span>
                      <span className="text-sm font-medium text-gray-900">
                        {currency} {totalIGV.toFixed(2)}
                      </span>
                    </div>
                    {globalDiscount > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-600">Descuento</span>
                        <span className="text-sm font-medium text-red-600">
                          - {currency} {globalDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-4">
                      <span className="text-base font-semibold text-gray-900">Total a Pagar</span>
                      <span className="text-2xl font-bold text-[#2F7CF4]">
                        {currency} {totalToPay.toFixed(2)}
                      </span>
                    </div>
                    {currency === "USD" && (
                      <p className="text-xs text-gray-500 text-right">
                        Equivalente: S/ {(totalToPay * 3.75).toFixed(2)} (T.C: 3.75)
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Observaciones */}
                <div className="space-y-2">
                  <Label htmlFor="observations" className="text-sm font-medium text-gray-700">
                    Observaciones (Opcional)
                  </Label>
                  <Textarea
                    id="observations"
                    placeholder="Ej: Ingrese notas adicionales para el comprobante (condiciones de pago, referencia interna...)"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEmission}
                  className="min-w-[120px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmEmission}
                  className="min-w-[120px] bg-[#2F7CF4] hover:bg-[#2F7CF4]/90"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Emitir {documentType === "01" ? "Factura" : "Boleta"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Estado: Loading */}
          {emissionState === "loading" && (
            <div className="py-12 px-6 text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-[#2F7CF4] animate-spin" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  Emitiendo {documentType === "01" ? "factura" : "boleta"}...
                </h3>
                <p className="text-gray-600">
                  Por favor espere, estamos enviando la información a Efact-OSE
                </p>
              </div>

              {/* Barra de progreso indeterminada */}
              <div className="w-full max-w-md mx-auto">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2F7CF4] animate-[loading_2s_ease-in-out_infinite]" style={{
                    animation: 'loading 2s ease-in-out infinite',
                    width: '40%',
                  }} />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-500 font-mono">
                  Conectando de forma segura con SUNAT/OSE...
                </p>
                <p className="text-gray-400 text-xs">
                  Este proceso toma 5-8 segundos
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleCancelEmission}
                className="mt-4"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>

              <style jsx>{`
                @keyframes loading {
                  0% { margin-left: 0%; width: 0%; }
                  50% { margin-left: 25%; width: 50%; }
                  100% { margin-left: 100%; width: 0%; }
                }
              `}</style>
            </div>
          )}

          {/* Estado: Success */}
          {emissionState === "success" && (
            <>
              <button
                onClick={handleCancelEmission}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              >
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </button>

              <div className="py-8 px-6 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-500 p-3">
                    <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-gray-900">
                    ¡{documentType === "01" ? "Factura" : "Boleta"} Emitida Correctamente!
                  </h3>
                  <p className="text-sm text-gray-500">
                    {documentType === "01" ? "Factura" : "Boleta"} <span className="font-medium text-gray-700">{generatedDocumentId}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button
                    className="bg-[#2F7CF4] hover:bg-[#2F7CF4]/90 min-w-[140px]"
                    onClick={() => {
                      // Navegar a la página de detalle
                      window.location.href = `/dashboard/invoices/${generatedDocumentId.split('-').join('')}`;
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver {documentType === "01" ? "Factura" : "Boleta"}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-w-[140px]"
                    onClick={() => {
                      console.log("Descargar PDF");
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </Button>
                </div>

                <button
                  onClick={handleCancelEmission}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}

          {/* Estado: Error */}
          {emissionState === "error" && (
            <>
              <button
                onClick={handleCancelEmission}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              >
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </button>

              <div className="py-8 px-6 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-red-500 p-3">
                    <XCircle className="h-12 w-12 text-white" strokeWidth={2.5} />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Error al Emitir {documentType === "01" ? "Factura" : "Boleta"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    No se pudo procesar la emisión del documento
                  </p>
                </div>

                <div className="bg-white border-2 border-red-500 rounded-lg p-4 text-left">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <div className="rounded-full bg-red-500 p-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-600 text-sm mb-1">Error 2334</p>
                      <p className="text-sm text-gray-700">
                        {emissionError || "Documento inválido - Los montos no cuadran con el total calculado. Por favor verifique las líneas de orden."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelEmission}
                    className="min-w-[120px]"
                  >
                    Cerrar
                  </Button>
                  <Button
                    onClick={handleRetryEmission}
                    className="bg-[#2F7CF4] hover:bg-[#2F7CF4]/90 min-w-[120px]"
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
