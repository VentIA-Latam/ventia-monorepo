# Plan: Card de Motivos de No Compra en Dashboard Cliente

**Fecha:** 2026-05-21
**Branch:** `feat/no-purchase-reason-clean`
**Spec:** `docs/superpowers/specs/2026-05-21-no-purchase-reasons-dashboard-card-design.md`
**Status:** Listo para ejecutar

## Resumen

Cuatro cambios pequeños y aislados, en este orden:

1. Agregar tipos y función fetcher en `metrics-service.ts`.
2. Crear el componente `no-purchase-reasons-ranking.tsx`.
3. Sumar el fetch al `Promise.allSettled` de `page.tsx`.
4. Renderizar el componente en una nueva fila del grid de `dashboard-client.tsx`.

Cada paso es funcional por sí solo (compila + lintea); los pasos 2-4 dependen del paso 1.

---

## Paso 1 — Tipos + fetcher en `metrics-service.ts`

**Archivo:** `apps/frontend/lib/services/metrics-service.ts`

**Cambio:** Agregar al final del archivo (después de la sección `--- Conversion Rate (US-CONV-004) ---`):

```ts
// --- No-Purchase Reasons ---

export interface NoPurchaseReasonItem {
  reason: string;
  count: number;
  percentage: number;
}

export interface NoPurchaseReasonsResponse {
  total: number;
  results: NoPurchaseReasonItem[];
}

export async function fetchNoPurchaseReasons(
  accessToken: string,
  start_date: string,
  end_date: string,
): Promise<NoPurchaseReasonsResponse> {
  const params = new URLSearchParams({ start_date, end_date });
  const url = `${API_URL}/metrics/no-purchase-reasons?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch no-purchase reasons' }));
    throw new Error(error.detail || 'Failed to fetch no-purchase reasons');
  }

  return response.json();
}
```

**Por qué la firma es diferente al resto:** el endpoint backend (`GET /metrics/no-purchase-reasons`) no acepta `period`; solo `start_date` y `end_date`. Mantener la firma fiel evita pasar params silenciosos que el backend ignora.

**Criterio de éxito:**
- `cd apps/frontend && pnpm tsc --noEmit` pasa.
- `pnpm lint` pasa.

---

## Paso 2 — Crear `no-purchase-reasons-ranking.tsx`

**Archivo nuevo:** `apps/frontend/components/dashboard/no-purchase-reasons-ranking.tsx`

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoPurchaseReasonsResponse } from "@/lib/services/metrics-service";

interface NoPurchaseReasonsRankingProps {
  data?: NoPurchaseReasonsResponse;
}

const medalColors = [
  "bg-warning/15 text-warning border-warning/20",
  "bg-muted/80 text-muted-foreground border-border",
  "bg-volt/10 text-volt border-volt/20",
];

export function NoPurchaseReasonsRanking({ data }: NoPurchaseReasonsRankingProps) {
  if (!data || data.total === 0) {
    return (
      <Card className="flex flex-col w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Motivos de no compra</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pt-0">
          <div className="flex flex-col items-center py-10 text-center">
            <MessageCircleOff className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Sin motivos registrados en este período
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = data.results.slice(0, 7);

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Motivos de no compra</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {data.total} {data.total === 1 ? "conversación" : "conversaciones"} sin compra
        </p>
      </CardHeader>
      <CardContent className="flex-1 pt-0 space-y-5">
        {sorted.map((item, i) => (
          <div key={item.reason} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pt-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {i < 3 ? (
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold border",
                      medalColors[i]
                    )}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <span className="text-sm text-foreground truncate">{item.reason}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.count}
                </span>
                <span className="text-xs font-semibold tabular-nums text-foreground min-w-[55px] text-right">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt to-aqua transition-all duration-500"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Notas de diseño aplicadas:**
- Gradiente `from-volt to-aqua` (consistente con TopProductsRanking, tokens Ventia).
- Medallas top 3: warning/muted/volt (espejo de TopProductsRanking).
- `tabular-nums` en count y percentage para evitar jitter visual.
- `MessageCircleOff` para el empty state (lucide-react v0.554 lo expone). Si fallara el import, sustituir por `<MessageCircle className="h-8 w-8 text-muted-foreground/30" />`.
- Usar `item.percentage` directo del backend (que ya viene calculado y redondeado a 1 decimal); no recalcular en frontend.
- Ancho del bloque de porcentaje `min-w-[55px]` (más corto que el de productos porque no hay revenue al lado).

**Criterio de éxito:**
- Archivo importable: `import { NoPurchaseReasonsRanking } from "@/components/dashboard/no-purchase-reasons-ranking";`
- `pnpm tsc --noEmit` y `pnpm lint` pasan.

---

## Paso 3 — Sumar fetch a `page.tsx`

**Archivo:** `apps/frontend/app/dashboard/get-started/page.tsx`

**3.1.** En el import de `@/lib/services/metrics-service` (línea 2-8) agregar `fetchNoPurchaseReasons` y el tipo:

```diff
 import {
   fetchDashboardMetrics,
   fetchTopProducts,
   fetchOrdersByCity,
   fetchConversionRate,
+  fetchNoPurchaseReasons,
   ConversionRate,
+  NoPurchaseReasonsResponse,
 } from "@/lib/services/metrics-service";
```

**3.2.** Declarar la variable junto a las demás (después de la línea 47, `let conversionRate: ConversionRate | undefined;`):

```diff
   let conversionRate: ConversionRate | undefined;
+  let noPurchaseReasons: NoPurchaseReasonsResponse | undefined;
   let error: Error | null = null;
```

**3.3.** Extender el `Promise.allSettled` (líneas 58-64):

```diff
-    const [metricsRes, ordersRes, topProductsRes, ordersByCityRes, conversionRateRes] = await Promise.allSettled([
+    const [
+      metricsRes,
+      ordersRes,
+      topProductsRes,
+      ordersByCityRes,
+      conversionRateRes,
+      noPurchaseReasonsRes,
+    ] = await Promise.allSettled([
       fetchDashboardMetrics(accessToken, query),
       fetchOrders(accessToken, { limit: 5, skip: 0, sortBy: 'updated_at', sortOrder: 'desc' }),
       fetchTopProducts(accessToken, query),
       fetchOrdersByCity(accessToken, query),
       fetchConversionRate(accessToken, query),
+      fetchNoPurchaseReasons(accessToken, startDate, endDate),
     ]);
```

**3.4.** Después del bloque que asigna `conversionRate` (línea 71) y antes del `if (conversionRateRes.status === 'rejected')`:

```diff
     conversionRate = conversionRateRes.status === 'fulfilled' ? conversionRateRes.value : conversionRateFallback;
+    noPurchaseReasons =
+      noPurchaseReasonsRes.status === 'fulfilled' ? noPurchaseReasonsRes.value : undefined;
+
+    if (noPurchaseReasonsRes.status === 'rejected') {
+      console.error('Error loading no-purchase reasons:', noPurchaseReasonsRes.reason);
+    }

     if (conversionRateRes.status === 'rejected') {
       console.error('Error loading conversion rate:', conversionRateRes.reason);
     }
```

**3.5.** Pasar la prop al `<DashboardClient>` (línea 96-106):

```diff
       <DashboardClient
         initialMetrics={metrics!}
         recentOrders={recentOrders?.items || []}
         topProducts={topProducts?.data || []}
         ordersByCity={ordersByCity?.data || []}
         initialConversionRate={conversionRate!}
+        noPurchaseReasons={noPurchaseReasons}
         startDate={startDate}
         endDate={endDate}
         defaultStartDate={defaults.start}
         defaultEndDate={defaults.end}
       />
```

**Criterio de éxito:**
- El dashboard sigue cargando como antes.
- En `Network` se observa una request adicional a `/metrics/no-purchase-reasons?start_date=...&end_date=...`.
- Si el backend devuelve 503, la consola muestra `Error loading no-purchase reasons:` pero el resto del dashboard funciona.

---

## Paso 4 — Renderizar en `dashboard-client.tsx`

**Archivo:** `apps/frontend/app/dashboard/get-started/dashboard-client.tsx`

**4.1.** Agregar import (después de la línea 27, junto a los demás imports de `@/components`):

```diff
 import { StatsCard } from "@/components/dashboard/stats-card";
+import { NoPurchaseReasonsRanking } from "@/components/dashboard/no-purchase-reasons-ranking";
```

**4.2.** Importar el tipo (línea 25-26):

```diff
-import { DashboardMetrics, ConversionRate } from "@/lib/services/metrics-service";
-import type { TopProduct, CityOrderCount } from "@/lib/services/metrics-service";
+import { DashboardMetrics, ConversionRate } from "@/lib/services/metrics-service";
+import type { TopProduct, CityOrderCount, NoPurchaseReasonsResponse } from "@/lib/services/metrics-service";
```

**4.3.** Agregar la prop a la interfaz (líneas 45-55):

```diff
 interface DashboardClientProps {
   initialMetrics: DashboardMetrics;
   recentOrders: Order[];
   topProducts: TopProduct[];
   ordersByCity: CityOrderCount[];
   initialConversionRate: ConversionRate;
+  noPurchaseReasons?: NoPurchaseReasonsResponse;
   startDate: string;
   endDate: string;
   defaultStartDate: string;
   defaultEndDate: string;
 }
```

**4.4.** Desestructurar la prop en el componente. Buscar la línea donde se desestructuran las props del componente `DashboardClient` (cerca del comienzo del cuerpo) y agregar `noPurchaseReasons`.

**4.5.** Insertar la nueva fila entre la fila de Pedidos/Top Productos y el Sales Map. Después de la línea 419 (cierre del `</div>` de la fila Two-column) y antes de la línea 421 (`{/* Sales Map */}`):

```diff
       {/* Two-column: Recent Orders + Top Products Ranking */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <motion.div variants={fadeUp} className="flex">
           <RecentOrdersCard orders={recentOrders} timezone={timezone} />
         </motion.div>
         <motion.div variants={fadeUp} className="flex">
           <TopProductsRanking products={topProducts} />
         </motion.div>
       </div>

+      {/* No-purchase reasons */}
+      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
+        <NoPurchaseReasonsRanking data={noPurchaseReasons} />
+      </motion.div>
+
       {/* Sales Map */}
```

En `lg:`, la card ocupa la primera columna; la segunda queda vacía (sin placeholder visible). En `md` y abajo colapsa a una sola columna.

**Criterio de éxito:**
- Dashboard renderiza la nueva card entre Pedidos/Top Productos y Sales Map.
- En desktop, la card ocupa exactamente la mitad izquierda del ancho.
- En mobile, full width.

---

## Validación final

**1. Type check + lint:**
```bash
cd apps/frontend
pnpm tsc --noEmit
pnpm lint
```

**2. Run dev y revisar en navegador:**
```bash
pnpm dev:frontend
# abrir http://localhost:3000/dashboard/get-started
```

Checklist visual:
- [ ] La card "Motivos de no compra" aparece entre la fila de Pedidos/Top Productos y el Mapa de ventas.
- [ ] Si hay datos: lista ranqueada con barras gradient `volt → aqua`, top 3 con medalla.
- [ ] Si `total === 0`: mensaje "Sin motivos registrados en este período" con icono `MessageCircleOff`.
- [ ] Si el backend devuelve 503 / 500: la card muestra el empty state, el dashboard no se rompe.
- [ ] Cambiar el date range del dashboard: la card se actualiza en el mismo SSR pass que los demás KPIs.
- [ ] Mobile (< 1024px): card en full width.
- [ ] Dark mode: contraste correcto, gradiente sigue visible.

**3. Smoke test rápido por terminal (opcional):**
```bash
# El endpoint backend (proxy) debe responder
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/metrics/no-purchase-reasons?start_date=2026-05-14&end_date=2026-05-21" | jq
```
Esperado: `{ total: N, results: [{reason, count, percentage}, ...] }`.

---

## Riesgos y consideraciones

| Riesgo | Mitigación |
|--------|-----------|
| `MessageCircleOff` no exportado en lucide-react instalado | Fallback documentado: `MessageCircle` con `opacity-30`. Verificar antes de implementar con `grep MessageCircleOff node_modules/lucide-react/dist/lucide-react.d.ts` |
| Backend devuelve `results` no ordenado por count | El backend Rails ya hace `.sort_by { |_, v| -v }`. Defensivo: no reordenar en frontend (confiar en el contrato del API documentado en el spec) |
| Suma de percentages ≠ 100% por redondeo | Aceptable; no se muestra suma total — cada item lleva su % |
| Cambio en el grid rompe responsive del Sales Map | El Sales Map ya está en su propia `motion.div` independiente, no afectado por el grid nuevo |

---

## Lo que NO se hace (YAGNI)

- No se agregan tests (alineado con la sección 10 del spec).
- No se agrega entrada en el sidebar (la card vive solo en el dashboard principal).
- No se modifica el backend.
- No se extrae un `RankedListCard` genérico — duplicación visual aceptable por ahora.
- No se agrega navegación al hacer clic en un motivo.

---

## Orden de commits sugerido

1. `feat(frontend): add NoPurchaseReasons types and fetcher in metrics-service`
2. `feat(frontend): add NoPurchaseReasonsRanking component`
3. `feat(frontend): wire NoPurchaseReasons into dashboard page + client`

Alternativamente, un solo commit si se prefiere: `feat(frontend): add no-purchase reasons card to client dashboard`.
