"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, Plus, Search, Download, Eye, Filter, MoreVertical } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data - Facturas y Boletas juntas
const mockInvoices = [
  {
    id: "1",
    serie: "F001",
    correlativo: "00123",
    type: "Factura Electrónica",
    client: "Tecnologías y Servicios S.A.C.",
    ruc: "20548923011",
    date: "2026-01-05",
    total: 2835.00,
    status: "emitido",
    currency: "PEN",
  },
  {
    id: "2",
    serie: "B001",
    correlativo: "000458",
    type: "Boleta de Venta",
    client: "Juan Perez",
    ruc: "10255280121",
    date: "2023-10-12",
    total: 150.00,
    status: "emitido",
    currency: "PEN",
  },
  {
    id: "3",
    serie: "B001",
    correlativo: "000459",
    type: "Boleta de Venta",
    client: "Ana Castillo",
    ruc: "41253987",
    date: "2023-10-12",
    total: 1250.90,
    status: "pendiente",
    currency: "PEN",
  },
  {
    id: "4",
    serie: "B001",
    correlativo: "000457",
    type: "Boleta de Venta",
    client: "Carlos Lopez",
    ruc: "20011223322",
    date: "2023-10-11",
    total: 45.00,
    status: "rechazado",
    currency: "PEN",
  },
  {
    id: "5",
    serie: "F001",
    correlativo: "00122",
    type: "Factura Electrónica",
    client: "Distribuidora Lima S.A.",
    ruc: "20345678901",
    date: "2026-01-03",
    total: 5200.00,
    status: "emitido",
    currency: "PEN",
  },
  {
    id: "6",
    serie: "B001",
    correlativo: "000455",
    type: "Boleta de Venta",
    client: "Tech Solutions SAC",
    ruc: "20558877569",
    date: "2023-10-10",
    total: 3450.00,
    status: "emitido",
    currency: "PEN",
  },
];

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      emitido: {
        className: "bg-green-100 text-green-700 hover:bg-green-100",
        label: "Emitido"
      },
      rechazado: {
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        label: "Rechazado"
      },
      pendiente: {
        className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        label: "Pendiente"
      },
    };
    const config = variants[status] || variants.pendiente;
    return (
      <Badge className={`${config.className} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
            Facturación
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Gestiona y emite tus comprobantes electrónicos
          </p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button className="w-full md:w-auto text-sm" size="sm">
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            Emitir Comprobante
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Comprobantes Emitidos</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Lista de todas las facturas y boletas generadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center mb-4 sm:mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, RUC/DNI o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 sm:pl-10 text-sm"
              />
            </div>

            {/* Filter by Type */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px] text-sm">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="factura">Factura</SelectItem>
                <SelectItem value="boleta">Boleta</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[200px] text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="emitido">Emitido</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] text-xs sm:text-sm">Comprobante</TableHead>
                    <TableHead className="min-w-[150px] text-xs sm:text-sm">Tipo</TableHead>
                    <TableHead className="min-w-[180px] text-xs sm:text-sm">Cliente</TableHead>
                    <TableHead className="min-w-[100px] text-xs sm:text-sm">RUC/DNI</TableHead>
                    <TableHead className="min-w-[100px] text-xs sm:text-sm">Fecha</TableHead>
                    <TableHead className="text-right min-w-[100px] text-xs sm:text-sm">Monto</TableHead>
                    <TableHead className="min-w-[100px] text-xs sm:text-sm">Estado</TableHead>
                    <TableHead className="text-right min-w-[80px] text-xs sm:text-sm">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300" />
                          <p className="text-xs sm:text-sm text-gray-500">No se encontraron comprobantes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    mockInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {invoice.serie}-{invoice.correlativo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{invoice.type}</TableCell>
                        <TableCell className="max-w-[150px] sm:max-w-[200px] truncate text-xs sm:text-sm">
                          {invoice.client}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{invoice.ruc}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {new Date(invoice.date).toLocaleDateString("es-PE")}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                          {invoice.currency} {invoice.total.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/invoices/${invoice.id}`} className="cursor-pointer text-xs sm:text-sm">
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  Ver Detalle
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs sm:text-sm">
                                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Descargar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs sm:text-sm">
                                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Descargar XML
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination (placeholder) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <p className="text-xs sm:text-sm text-gray-600">
              Mostrando {mockInvoices.length} de {mockInvoices.length} comprobantes
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="text-xs sm:text-sm">
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled className="text-xs sm:text-sm">
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
