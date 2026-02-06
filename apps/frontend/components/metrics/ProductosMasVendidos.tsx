"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface ProductData {
  product: string;
  total_sold: number;
  total_revenue: number;
}

interface ProductosMasVendidosProps {
  data: ProductData[];
}

// Tonal palette derived from the theme's chart tokens — slate-blue base
const BAR_COLORS = [
  "oklch(0.55 0.15 250)",
  "oklch(0.60 0.13 220)",
  "oklch(0.65 0.11 200)",
  "oklch(0.70 0.09 190)",
  "oklch(0.75 0.07 180)",
  "oklch(0.80 0.05 170)",
  "oklch(0.84 0.04 160)",
  "oklch(0.88 0.03 150)",
];

const MEDAL_STYLES = [
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-gray-50 text-gray-500 border-gray-200",
  "bg-orange-50 text-orange-600 border-orange-200",
];

const formatPEN = (value: number) =>
  `S/ ${new Intl.NumberFormat("es-PE").format(value)}`;

const ProductosMasVendidos = ({ data }: ProductosMasVendidosProps) => {
  const chartData = data
    .map((item) => ({
      producto: item.product,
      ventas: item.total_sold,
      ingresos: item.total_revenue,
    }))
    .sort((a, b) => b.ventas - a.ventas);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
          <CardDescription>Ranking por unidades vendidas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos disponibles para el período seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
        <CardDescription>Ranking por unidades vendidas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-3 pb-8">
          {chartData.slice(0, 3).map((item, index) => (
            <div
              key={index}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-4 ${MEDAL_STYLES[index]}`}
            >
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                <span className="text-lg font-bold">#{index + 1}</span>
              </div>
              <span className="text-xs font-medium text-center leading-tight line-clamp-2">
                {item.producto}
              </span>
              <span className="text-[11px] tabular-nums">
                {item.ventas} uds
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {formatPEN(item.ingresos)}
              </span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 200)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="oklch(0.922 0 0)"
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="producto"
              type="category"
              width={110}
              tick={{ fontSize: 11, fill: "oklch(0.4 0 0)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid oklch(0.922 0 0)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                fontSize: "12px",
              }}
              formatter={(value: any, name: any) => {
                if (name === "ventas")
                  return [value + " unidades", "Ventas"];
                if (name === "ingresos")
                  return [formatPEN(value), "Ingresos"];
                return [value, name];
              }}
            />
            <Bar
              dataKey="ventas"
              name="ventas"
              radius={[0, 6, 6, 0]}
              maxBarSize={32}
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProductosMasVendidos;
