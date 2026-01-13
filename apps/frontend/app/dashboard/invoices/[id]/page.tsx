"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Download,
  Mail,
  ExternalLink,
  AlertCircle,
  MapPin,
  Phone,
  ShoppingBag,
  RefreshCw,
  Home,
  Calendar,
  Clock,
} from "lucide-react";
import Link from "next/link";

// Tipos
interface ComprobanteItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  igv: number;
  total: number;
}

// Mock data - Base de datos completa de comprobantes
const mockComprobantesDatabase: Record<string, any> = {
  "1": {
    id: "1",
    numero_completo: "F001-00123",
    serie: "F001",
    correlativo: "00123",
    tipo_comprobante: "Factura Electrónica",
    moneda: "PEN",
    estado_ose: "VALIDADO",
    fecha_emision: "5 Ene, 2026",
    hora_emision: "09:15 AM",
    fecha_validacion: "5 Ene, 2026 09:17 AM",
    ticket_efact: "3456",
    cliente: {
      nombre: "Tecnologías y Servicios S.A.C.",
      tipo_documento: "RUC",
      numero_documento: "20548923011",
      direccion: "Av. Javier Prado 123, San Isidro, Lima - Peru",
      email: "contacto@tecnologias.com",
      telefono: "+51 944 555 666",
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "PROD-001",
        descripcion: "Software de Gestión Empresarial - Licencia Anual",
        cantidad: 1,
        unidad: "UNI",
        precio_unitario: 2402.54,
        igv: 432.46,
        total: 2835.00,
      },
    ],
    desglose: {
      op_gravada: 2402.54,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 432.46,
      descuento: 0.00,
      total: 2835.00,
      total_letras: "DOS MIL OCHOCIENTOS TREINTA Y CINCO Y 00/100 SOLES",
    },
    observaciones: "Licencia válida por 12 meses desde la fecha de emisión",
    info_tecnica: {
      id_interno: "factura_789012",
      tenant_id: "tenant_abc",
      created_at: "2026-01-05T09:15:30Z",
      updated_at: "2026-01-05T09:17:15Z",
    },
    error_mensaje: null,
    url_efact: "https://efact-ose.pe/consulta/3456",
  },
  "2": {
    id: "2",
    numero_completo: "B001-000458",
    serie: "B001",
    correlativo: "000458",
    tipo_comprobante: "Boleta de Venta Electrónica",
    moneda: "PEN",
    estado_ose: "VALIDADO",
    fecha_emision: "12 Oct, 2023",
    hora_emision: "10:23 AM",
    fecha_validacion: "12 Oct, 2023 10:25 AM",
    ticket_efact: "2184",
    cliente: {
      nombre: "Juan Perez",
      tipo_documento: "DNI",
      numero_documento: "10255280121",
      direccion: "Av. Larco 123, Of. 405, Miraflores, Lima - Peru",
      email: "juan.perez@email.com",
      telefono: "+51 999 888 777",
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "SERV-001",
        descripcion: "Servicio de Mantenimiento Preventivo",
        cantidad: 1,
        unidad: "UNI",
        precio_unitario: 100.00,
        igv: 18.00,
        total: 118.00,
      },
      {
        codigo: "RP-7823",
        descripcion: "Repuesto Filtro de Aire",
        cantidad: 2,
        unidad: "PZA",
        precio_unitario: 16.10,
        igv: 5.80,
        total: 38.00,
      },
    ],
    desglose: {
      op_gravada: 127.12,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 22.88,
      descuento: 0.00,
      total: 150.00,
      total_letras: "CIENTO CINCUENTA Y 00/100 SOLES",
    },
    observaciones: null,
    info_tecnica: {
      id_interno: "boleta_123456",
      tenant_id: "tenant_abc",
      created_at: "2023-10-12T10:23:15Z",
      updated_at: "2023-10-12T10:25:42Z",
    },
    error_mensaje: null,
    url_efact: "https://efact-ose.pe/consulta/2184",
  },
  "3": {
    id: "3",
    numero_completo: "B001-000459",
    serie: "B001",
    correlativo: "000459",
    tipo_comprobante: "Boleta de Venta Electrónica",
    moneda: "PEN",
    estado_ose: "PENDIENTE",
    fecha_emision: "12 Oct, 2023",
    hora_emision: "11:45 AM",
    fecha_validacion: null,
    ticket_efact: "2185",
    cliente: {
      nombre: "Ana Castillo",
      tipo_documento: "DNI",
      numero_documento: "41253987",
      direccion: "Jr. Los Pinos 456, Surco, Lima - Peru",
      email: "ana.castillo@email.com",
      telefono: "+51 987 654 321",
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "PROD-055",
        descripcion: "Laptop HP ProBook 450 G9",
        cantidad: 1,
        unidad: "UNI",
        precio_unitario: 1060.08,
        igv: 190.82,
        total: 1250.90,
      },
    ],
    desglose: {
      op_gravada: 1060.08,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 190.82,
      descuento: 0.00,
      total: 1250.90,
      total_letras: "MIL DOSCIENTOS CINCUENTA Y 90/100 SOLES",
    },
    observaciones: "Comprobante en proceso de validación",
    info_tecnica: {
      id_interno: "boleta_123457",
      tenant_id: "tenant_abc",
      created_at: "2023-10-12T11:45:20Z",
      updated_at: "2023-10-12T11:45:20Z",
    },
    error_mensaje: null,
    url_efact: "https://efact-ose.pe/consulta/2185",
  },
  "4": {
    id: "4",
    numero_completo: "B001-000457",
    serie: "B001",
    correlativo: "000457",
    tipo_comprobante: "Boleta de Venta Electrónica",
    moneda: "PEN",
    estado_ose: "RECHAZADO",
    fecha_emision: "11 Oct, 2023",
    hora_emision: "03:30 PM",
    fecha_validacion: null,
    ticket_efact: null,
    cliente: {
      nombre: "Carlos Lopez",
      tipo_documento: "RUC",
      numero_documento: "20011223322",
      direccion: null,
      email: null,
      telefono: null,
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "SERV-003",
        descripcion: "Consultoría Técnica",
        cantidad: 1,
        unidad: "UNI",
        precio_unitario: 38.14,
        igv: 6.86,
        total: 45.00,
      },
    ],
    desglose: {
      op_gravada: 38.14,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 6.86,
      descuento: 0.00,
      total: 45.00,
      total_letras: "CUARENTA Y CINCO Y 00/100 SOLES",
    },
    observaciones: null,
    info_tecnica: {
      id_interno: "boleta_123455",
      tenant_id: "tenant_abc",
      created_at: "2023-10-11T15:30:10Z",
      updated_at: "2023-10-11T15:32:45Z",
    },
    error_mensaje: "Rechazo por SUNAT/OSE: Código del establecimiento ha sido rechazado. El numero de documento de identidad del receptor no cumple con el formato establecido para el tipo de documento. Verifique el RUC/DNI e intente nuevamente.",
    url_efact: null,
  },
  "5": {
    id: "5",
    numero_completo: "F001-00122",
    serie: "F001",
    correlativo: "00122",
    tipo_comprobante: "Factura Electrónica",
    moneda: "PEN",
    estado_ose: "VALIDADO",
    fecha_emision: "3 Ene, 2026",
    hora_emision: "02:45 PM",
    fecha_validacion: "3 Ene, 2026 02:47 PM",
    ticket_efact: "3400",
    cliente: {
      nombre: "Distribuidora Lima S.A.",
      tipo_documento: "RUC",
      numero_documento: "20345678901",
      direccion: "Av. Argentina 890, Callao - Peru",
      email: "ventas@distribuidoralima.com",
      telefono: "+51 955 111 222",
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "PROD-200",
        descripcion: "Equipos de Protección Personal - Lote 50 unidades",
        cantidad: 50,
        unidad: "UNI",
        precio_unitario: 88.14,
        igv: 793.56,
        total: 5200.00,
      },
    ],
    desglose: {
      op_gravada: 4406.78,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 793.22,
      descuento: 0.00,
      total: 5200.00,
      total_letras: "CINCO MIL DOSCIENTOS Y 00/100 SOLES",
    },
    observaciones: "Entrega programada para el 10 de enero",
    info_tecnica: {
      id_interno: "factura_789010",
      tenant_id: "tenant_abc",
      created_at: "2026-01-03T14:45:20Z",
      updated_at: "2026-01-03T14:47:15Z",
    },
    error_mensaje: null,
    url_efact: "https://efact-ose.pe/consulta/3400",
  },
  "6": {
    id: "6",
    numero_completo: "B001-000455",
    serie: "B001",
    correlativo: "000455",
    tipo_comprobante: "Boleta de Venta Electrónica",
    moneda: "PEN",
    estado_ose: "VALIDADO",
    fecha_emision: "10 Oct, 2023",
    hora_emision: "05:20 PM",
    fecha_validacion: "10 Oct, 2023 05:22 PM",
    ticket_efact: "2180",
    cliente: {
      nombre: "Tech Solutions SAC",
      tipo_documento: "RUC",
      numero_documento: "20558877569",
      direccion: "Calle Las Begonias 234, San Isidro, Lima - Peru",
      email: "info@techsolutions.pe",
      telefono: "+51 933 444 555",
    },
    orden_relacionada: null,
    items: [
      {
        codigo: "SERV-100",
        descripcion: "Desarrollo Web - Sitio Corporativo",
        cantidad: 1,
        unidad: "UNI",
        precio_unitario: 2924.58,
        igv: 526.42,
        total: 3451.00,
      },
    ],
    desglose: {
      op_gravada: 2923.73,
      op_inafecta: 0.00,
      op_exonerada: 0.00,
      igv: 526.27,
      descuento: 0.00,
      total: 3450.00,
      total_letras: "TRES MIL CUATROCIENTOS CINCUENTA Y 00/100 SOLES",
    },
    observaciones: "Proyecto incluye hosting por 1 año",
    info_tecnica: {
      id_interno: "boleta_123453",
      tenant_id: "tenant_abc",
      created_at: "2023-10-10T17:20:30Z",
      updated_at: "2023-10-10T17:22:15Z",
    },
    error_mensaje: null,
    url_efact: "https://efact-ose.pe/consulta/2180",
  },
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isInfoTecnicaOpen, setIsInfoTecnicaOpen] = useState(false);

  // Obtener comprobante según el ID de la URL
  const comprobante = mockComprobantesDatabase[params.id as string];

  // Si no existe el comprobante, mostrar mensaje de error
  if (!comprobante) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Comprobante no encontrado</h1>
          <p className="text-gray-600 mb-4">El comprobante con ID {params.id} no existe.</p>
          <Link href="/dashboard/invoices">
            <Button>Volver a Facturación</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      VALIDADO: {
        className: "bg-green-100 text-green-700 hover:bg-green-100",
        label: "✓ Emitida"
      },
      PENDIENTE: {
        className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        label: "Pendiente"
      },
      RECHAZADO: {
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        label: "✗ Rechazada"
      },
    };
    const config = variants[status] || variants.PENDIENTE;
    return (
      <Badge className={`${config.className} text-sm px-3 py-1`}>
        {config.label}
      </Badge>
    );
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-indigo-500",
    ];
    const charCode = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
    return colors[charCode % colors.length];
  };

  const getInitials = (name: string) => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleDownloadPDF = () => {
    console.log("Descargar PDF");
  };

  const handleDownloadXML = () => {
    console.log("Descargar XML");
  };

  const handleDownloadCDR = () => {
    console.log("Descargar CDR");
  };

  const handleSendEmail = () => {
    console.log("Enviar por Email");
  };

  const handleRetry = () => {
    console.log("Reintentar emisión");
  };

  // Determinar el tipo de comprobante para el título
  const tipoComprobante = comprobante.serie.startsWith("F") ? "Factura" : "Boleta";

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500 mb-4">
          <Link href="/dashboard" className="hover:text-gray-900 flex items-center gap-1">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 mx-2" />
          <Link href="/dashboard/invoices" className="hover:text-gray-900">
            Facturación
          </Link>
          <ChevronRight className="h-4 w-4 mx-2" />
          <span className="text-gray-900 font-medium">{comprobante.numero_completo}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {tipoComprobante} {comprobante.numero_completo}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Emitida el {comprobante.fecha_emision}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {comprobante.hora_emision}
              </span>
              {comprobante.orden_relacionada && (
                <>
                  <span>•</span>
                  <Link
                    href={`/dashboard/orders/${comprobante.orden_relacionada.order_id}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Orden #{comprobante.orden_relacionada.order_id}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 lg:mt-0">
            {getStatusBadge(comprobante.estado_ose)}
          </div>
        </div>

        {/* Alert de Rechazo */}
        {comprobante.estado_ose === "RECHAZADO" && comprobante.error_mensaje && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Rechazo por SUNAT/OSE</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm">{comprobante.error_mensaje}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 bg-white"
                onClick={handleRetry}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Corregir y Reemitir
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información del Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Avatar className={`h-16 w-16 ${getAvatarColor(comprobante.cliente.nombre)}`}>
                    <AvatarFallback className="bg-transparent text-white font-semibold text-xl">
                      {getInitials(comprobante.cliente.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {comprobante.cliente.nombre}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {comprobante.cliente.tipo_documento}: {comprobante.cliente.numero_documento}
                      </p>
                    </div>

                    {comprobante.cliente.direccion && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                        <span>{comprobante.cliente.direccion}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 text-sm">
                      {comprobante.cliente.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{comprobante.cliente.email}</span>
                        </div>
                      )}
                      {comprobante.cliente.telefono && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{comprobante.cliente.telefono}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalle de Productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ítems del Comprobante</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-center w-24">Unidad</TableHead>
                        <TableHead className="text-center w-20">Cant.</TableHead>
                        <TableHead className="text-right w-28">P. Unitario</TableHead>
                        <TableHead className="text-right w-28">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprobante.items.map((item: ComprobanteItem, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{item.descripcion}</p>
                              <p className="text-xs text-gray-500">Código: {item.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm">{item.unidad}</TableCell>
                          <TableCell className="text-center">{item.cantidad}</TableCell>
                          <TableCell className="text-right">{item.precio_unitario.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{item.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator className="my-4" />

                {/* Desglose Financiero */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Op. Gravada</span>
                    <span className="font-medium">S/ {comprobante.desglose.op_gravada.toFixed(2)}</span>
                  </div>
                  {comprobante.desglose.op_inafecta > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Op. Inafecta</span>
                      <span className="font-medium">S/ {comprobante.desglose.op_inafecta.toFixed(2)}</span>
                    </div>
                  )}
                  {comprobante.desglose.op_exonerada > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Op. Exonerada</span>
                      <span className="font-medium">S/ {comprobante.desglose.op_exonerada.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IGV (18%)</span>
                    <span className="font-medium">S/ {comprobante.desglose.igv.toFixed(2)}</span>
                  </div>
                  {comprobante.desglose.descuento > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuentos</span>
                      <span className="font-medium">- S/ {comprobante.desglose.descuento.toFixed(2)}</span>
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total a Pagar</span>
                    <span className="text-2xl font-bold text-gray-900">S/ {comprobante.desglose.total.toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-gray-500 text-right mt-1">
                    Son: {comprobante.desglose.total_letras}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Observaciones */}
            {comprobante.observaciones && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Observaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{comprobante.observaciones}</p>
                </CardContent>
              </Card>
            )}

            {/* Información Técnica */}
            <Card>
              <Collapsible open={isInfoTecnicaOpen} onOpenChange={setIsInfoTecnicaOpen}>
                <CardHeader className="cursor-pointer" onClick={() => setIsInfoTecnicaOpen(!isInfoTecnicaOpen)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Información Técnica (OSE)</CardTitle>
                    {isInfoTecnicaOpen ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-3 bg-gray-900 text-gray-100 rounded-b-lg font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">ID Interno:</span>
                      <span>{comprobante.info_tecnica.id_interno}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tenant ID:</span>
                      <span>{comprobante.info_tecnica.tenant_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Creado:</span>
                      <span>{new Date(comprobante.info_tecnica.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Actualizado:</span>
                      <span>{new Date(comprobante.info_tecnica.updated_at).toLocaleString()}</span>
                    </div>
                    {comprobante.ticket_efact && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ticket Efact:</span>
                        <span className="text-green-400">{comprobante.ticket_efact}</span>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </div>

          {/* Sidebar de Acciones */}
          <div className="space-y-6">
            {/* Resumen Financiero */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm text-blue-900">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-800">Total a Pagar</span>
                  <span className="font-bold text-blue-900">S/ {comprobante.desglose.total.toFixed(2)}</span>
                </div>
                <Separator className="bg-blue-200" />
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">Op. Gravada</span>
                  <span className="text-blue-900">S/ {comprobante.desglose.op_gravada.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-700">IGV (18%)</span>
                  <span className="text-blue-900">S/ {comprobante.desglose.igv.toFixed(2)}</span>
                </div>
                {comprobante.desglose.descuento > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-700">Descuentos</span>
                    <span className="text-blue-900">S/ {comprobante.desglose.descuento.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalles de Emisión */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detalles de Emisión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Fecha de Emisión</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {comprobante.fecha_emision}
                  </p>
                </div>
                {comprobante.fecha_validacion && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Fecha Validación</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {comprobante.fecha_validacion}
                    </p>
                  </div>
                )}
                {comprobante.orden_relacionada && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Orden Relacionada</p>
                    <Link
                      href={`/dashboard/orders/${comprobante.orden_relacionada.order_id}`}
                      className="font-medium text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      #{comprobante.orden_relacionada.order_id}
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs mb-1">Moneda</p>
                  <p className="font-medium">Soles (PEN)</p>
                </div>
              </CardContent>
            </Card>

            {/* Acciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Archivos Legales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleDownloadPDF}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadXML}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar XML
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadCDR}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar CDR
                </Button>

                <Separator />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar por Email
                </Button>

                {comprobante.url_efact && (
                  <a
                    href={comprobante.url_efact}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    Ver en SUNAT
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
