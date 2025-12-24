"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { PaymentRecord } from "@/lib/types/payment-record"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/* -------------------- COLUMNAS -------------------- */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

export const paymentColumns: ColumnDef<PaymentRecord>[] = [
  {
    accessorKey: "fechaIngresada",
    header: "FECHA INGRESADA",
    cell: ({ row }) => (
      <span className="text-xs text-slate-600">
        {formatDate(row.original.fechaIngresada)}
      </span>
    ),
  },
  {
    accessorKey: "fechaEntrega",
    header: "FECHA DE ENTREGA DEL PEDIDO",
    cell: ({ row }) => (
      <span className="text-xs text-slate-600">
        {formatDate(row.original.fechaEntrega)}
      </span>
    ),
  },
  {
    accessorKey: "horarioDespacho",
    header: "HORARIO DE DESPACHO",
    cell: ({ row }) => (
      <span className="text-xs text-slate-600">
        {row.original.horarioDespacho}
      </span>
    ),
  },
  {
    accessorKey: "resumenPedido",
    header: "RESUMEN DEL PEDIDO",
    cell: ({ row }) => (
      <span className="text-xs text-slate-700 whitespace-pre-line">
        {row.original.resumenPedido}
      </span>
    ),
  },
  {
    accessorKey: "correo",
    header: "CORREO",
    cell: ({ row }) => (
      <span className="text-xs text-sky-700 underline underline-offset-2">
        {row.original.correo}
      </span>
    ),
  },
  {
    accessorKey: "marcaEmpresa",
    header: "MARCA O EMPRESA",
    cell: ({ row }) => (
      <span className="text-xs text-slate-700">
        {row.original.marcaEmpresa}
      </span>
    ),
  },
  {
    accessorKey: "montoTotal",
    header: "MONTO TOTAL DEL PAGO",
    cell: ({ row }) => (
      <span className="text-xs font-semibold text-right block">
        {row.original.moneda} {row.original.montoTotal.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "tipoValidacion",
    header: "TIPO DE VALIDACIÓN",
    cell: ({ row }) => (
      <span className="text-xs text-slate-700">
        {row.original.tipoValidacion}
      </span>
    ),
  },
  {
    accessorKey: "validado",
    header: "VALIDADO?",
    cell: ({ row }) => {
      const validado = row.original.validado
      return (
        <Badge
          variant={validado ? "default" : "outline"}
          className={cn(
            "text-[11px] px-3 py-0.5",
            validado
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          )}
        >
          {validado ? "SÍ" : "NO"}
        </Badge>
      )
    },
  },
]

/* -------------------- GENERIC DATA TABLE (docs) -------------------- */

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Toolbar / Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          placeholder="Buscar por resumen, correo o marca..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-md"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {"<<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-xl bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-slate-50/60">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold min-w-[140px]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="align-top hover:bg-slate-50/60"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-xs">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-slate-500"
                >
                  No se encontraron registros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info de paginación */}
      <div className="flex justify-end text-xs text-slate-500">
        Página {table.getState().pagination.pageIndex + 1} de{" "}
        {table.getPageCount() || 1}
      </div>
    </div>
  )
}

/* -------------------- WRAPPER PARA USAR EN LA PÁGINA -------------------- */

interface PaymentsTableProps {
  records: PaymentRecord[]
}

export function PaymentsTable({ records }: PaymentsTableProps) {
  return <DataTable columns={paymentColumns} data={records} />
}
