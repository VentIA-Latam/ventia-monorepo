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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Facturación
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona y emite tus comprobantes electrónicos
          </p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Emitir Comprobante
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comprobantes Emitidos</CardTitle>
          <CardDescription>
            Lista de todas las facturas y boletas generadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, RUC/DNI o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter by Type */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px]">
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
              <SelectTrigger className="w-full md:w-[200px]">
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>RUC/DNI</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-12 w-12 text-gray-300" />
                        <p className="text-sm text-gray-500">No se encontraron comprobantes</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  mockInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {invoice.serie}-{invoice.correlativo}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.client}
                      </TableCell>
                      <TableCell>{invoice.ruc}</TableCell>
                      <TableCell>
                        {new Date(invoice.date).toLocaleDateString("es-PE")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.currency} {invoice.total.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/invoices/${invoice.id}`} className="cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalle
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Descargar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
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

          {/* Pagination (placeholder) */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Mostrando {mockInvoices.length} de {mockInvoices.length} comprobantes
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled>
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
