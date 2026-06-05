# Design: Card de Motivos de No Compra en Dashboard Cliente

**Fecha:** 2026-05-21
**Branch:** `feat/no-purchase-reason-clean`
**Status:** Diseño aprobado, pendiente plan de implementación

## 1. Contexto

El backend ya expone un KPI proxy `GET /api/v1/metrics/no-purchase-reasons` (commit `2816d65`) que devuelve, por rango de fechas, los motivos por los que conversaciones no terminaron en compra. La fuente real es la app Rails messaging, que agrupa por `conversations.custom_attributes->>'no_purchase_reason'`.

La data está disponible pero no se muestra en ningún lado del frontend. El objetivo es exponer esta KPI a los clientes en el dashboard principal (`/dashboard/get-started`) de manera consistente con los KPIs existentes.

## 2. Objetivo

Permitir al cliente ver, de un vistazo, **qué motivos de no compra fueron más frecuentes** en el período que tiene seleccionado en el dashboard. Sin drill-down, sin filtros adicionales: una vista informativa que complementa los otros KPIs.

## 3. Decisiones de UX (acordadas con el usuario)

| Decisión | Resultado |
|----------|-----------|
| Ubicación | Card dentro de `/dashboard/get-started` |
| Posición en grid | Nueva fila entre `Pedidos / Top Productos` y `Sales Map` |
| Ancho | Media columna (`lg:col-span-1` dentro de `lg:grid-cols-2`); en `md` y abajo, full width |
| Visualización | Lista ranqueada con barras de progreso (mismo lenguaje visual que Top Productos) |
| Densidad | Hasta 7 motivos; si hay más, se truncan |
| Interactividad | Solo informativa (sin click handlers, sin drill-down) |
| Date range | Comparte el global del dashboard; sin date picker propio |
| Estado vacío | Mensaje neutral cuando `total === 0` |
| Estado de error | La card se omite (Promise.allSettled aísla); resto del dashboard sigue |

## 4. Arquitectura de componentes

Patrón espejo del flujo actual de KPIs en el dashboard:

```
page.tsx (Server Component)
  ├─ getCurrentUser(accessToken)
  ├─ getDefaultDateRangeInTz(...)
  └─ Promise.allSettled([
       fetchDashboardMetrics(...),
       fetchOrders(...),
       fetchTopProducts(...),
       fetchOrdersByCity(...),
       fetchConversionRate(...),
       fetchNoPurchaseReasons(...),   ← NUEVO
     ])
       ↓
DashboardClient (Client Component)
  └─ <NoPurchaseReasonsRanking data={...} />   ← NUEVO
```

### Por qué Server Component fetcher

Alineado con `vercel-react-best-practices`:
- Sin `useEffect` para data fetching.
- Datos disponibles en initial paint (sin loading spinner ni cascadas client-side).
- `Promise.allSettled` ya está en uso → cero coste de complejidad adicional.
- Falla del fetch nuevo no rompe el resto del dashboard (status `rejected` → la card no se renderiza).

### Por qué el ranking es Client Component

Necesita `framer-motion` para animar barras (consistente con el resto del dashboard, que ya envuelve filas en `motion.div` con `variants={fadeUp}`).

## 5. Archivos a crear / modificar

### 5.1 `apps/frontend/lib/services/metrics-service.ts` (modificar)

Agregar tipos y función fetcher al final del archivo:

```ts
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

**Notas:**
- El endpoint NO acepta `period`; toma `start_date` y `end_date` directamente. Por eso la firma es distinta a `fetchTopProducts`.
- `cache: 'no-store'` es el patrón del resto del archivo.
- Error handling idéntico al resto: extrae `detail` del body si está, fallback a mensaje genérico.

### 5.2 `apps/frontend/components/dashboard/no-purchase-reasons-ranking.tsx` (nuevo)

Componente standalone (no sub-component inline) para mantener `dashboard-client.tsx` manejable.

**Estructura:**
```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoPurchaseReasonsResponse } from "@/lib/services/metrics-service";

interface Props {
  data?: NoPurchaseReasonsResponse;
}

export function NoPurchaseReasonsRanking({ data }: Props) {
  // empty state si !data || data.total === 0
  // sorted = data.results.slice(0, 7) (ya viene ordenado del backend, pero defensivo)
  // maxCount = sorted[0].count para escalar la barra visual
  // medalColors para top 3 (mismas clases que TopProductsRanking)
  // render: Card → Header con título + total → list de items con barra
}
```

**Detalles visuales (heredados de `TopProductsRanking`):**

- **Card wrapper:** `<Card className="flex flex-col w-full">`
- **Header:** `<CardTitle className="text-base font-semibold">Motivos de no compra</CardTitle>` + sub-línea con total: `<p className="text-xs text-muted-foreground mt-1">{total} conversaciones sin compra</p>`
- **Items:** mismo layout que `TopProductsRanking` (rank badge → reason → count → barra)
  - Rank badge para top 3: `medalColors[i]` (warning/muted/volt) — array idéntico al de TopProductsRanking.
  - Rank 4-7: span simple con número.
  - Reason: `text-sm text-foreground truncate`.
  - Count: `text-xs text-muted-foreground tabular-nums`.
  - Percentage: `text-xs font-semibold tabular-nums text-foreground min-w-[55px] text-right` (usa el `percentage` que viene del backend, no recalcular).
  - Barra: `bg-gradient-to-r from-volt to-aqua` con `width: ${percentage}%`.
- **Empty state:** icono `MessageCircleOff` en `text-muted-foreground/40` + texto "Sin motivos registrados en este período".

### 5.3 `apps/frontend/app/dashboard/get-started/page.tsx` (modificar)

Agregar el fetcher al `Promise.allSettled` existente (línea ~57):

```tsx
const [
  metricsRes,
  ordersRes,
  topProductsRes,
  ordersByCityRes,
  conversionRateRes,
  noPurchaseReasonsRes,  // ← NUEVO
] = await Promise.allSettled([
  fetchDashboardMetrics(accessToken, query),
  fetchOrders(accessToken, { limit: 5, skip: 0, sortBy: 'updated_at', sortOrder: 'desc' }),
  fetchTopProducts(accessToken, query),
  fetchOrdersByCity(accessToken, query),
  fetchConversionRate(accessToken, query),
  fetchNoPurchaseReasons(accessToken, startDate, endDate),  // ← NUEVO
]);

// ...resto igual...
const noPurchaseReasons =
  noPurchaseReasonsRes.status === 'fulfilled' ? noPurchaseReasonsRes.value : undefined;
```

Pasar `noPurchaseReasons` como prop al `<DashboardClient>`.

### 5.4 `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` (modificar)

Cambios:
1. Agregar `noPurchaseReasons?: NoPurchaseReasonsResponse` a las props.
2. Importar `NoPurchaseReasonsRanking` de `@/components/dashboard/no-purchase-reasons-ranking`.
3. Insertar una nueva fila entre la fila de Pedidos/Top Productos y la del Sales Map (línea ~419, antes del comentario `{/* Sales Map */}`):

```tsx
{/* No-purchase reasons */}
<motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <NoPurchaseReasonsRanking data={noPurchaseReasons} />
  {/* Columna derecha intencionalmente vacía: reservada para futura KPI */}
</motion.div>
```

La columna derecha queda vacía sin placeholder visible (en mobile, el grid colapsa y la card ocupa 100%; en `lg`, la card queda alineada a la izquierda con la columna derecha como espacio).

## 6. Aplicación de `frontend-design` (lenguaje visual)

| Elemento | Token Ventia | Justificación |
|----------|--------------|---------------|
| Barra de progreso | `bg-gradient-to-r from-volt to-aqua` | Mismo gradiente que `TopProductsRanking` — coherencia visual del dashboard |
| Medalla #1 | `bg-warning/15 text-warning border-warning/20` | Top 3 con jerarquía oro/plata/bronce (warning = oro Ventia) |
| Medalla #2 | `bg-muted/80 text-muted-foreground border-border` | Plata (neutro) |
| Medalla #3 | `bg-volt/10 text-volt border-volt/20` | Bronce → reemplazado por accent volt (alineado con stats-card) |
| Rank 4-7 | `text-muted-foreground` | Sin badge, jerarquía visual más sutil |
| Icono empty state | `text-muted-foreground/40` | Mismo tratamiento que Trophy en TopProductsRanking empty state |
| Card border | (default shadcn) | Sin border accent left, distinto a StatsCard — el accent visual ya viene de la barra |

**Icono para el empty state:** `MessageCircleOff` de lucide-react (conversación sin resultado). Si no existiera en la versión de lucide-react instalada, usar `MessageCircle` con `opacity-40`.

**No usar emojis.** Solo iconos de lucide-react.

## 7. Aplicación de `vercel-react-best-practices`

- **Server Component para fetch:** `page.tsx` es Server Component; data viaja por props, no por `useEffect`.
- **Sin client-side fetching innecesario:** el ranking recibe data ya resuelta.
- **`Promise.allSettled` (ya presente):** aísla fallos por endpoint → la card individual no rompe el dashboard.
- **Sin `useState` para data inicial:** la prop `data` se renderiza directamente.
- **`cache: 'no-store'`** en el fetcher: consistente con el resto, evita stale data en KPIs.
- **Bundle size:** el componente nuevo importa solo `Card`, `cn`, un icono de lucide → cero deps nuevas.
- **`tabular-nums`** en counts y porcentajes para alineación numérica sin jitter.
- **Sin Recharts ni librerías de chart:** la lista con barras se hace con CSS puro, evitando inflar el bundle del dashboard.

## 8. Estados

| Estado | Condición | Renderizado |
|--------|-----------|-------------|
| Datos | `data && data.total > 0` | Lista ranqueada (hasta 7 items) |
| Vacío | `data && data.total === 0` | Card con icono + "Sin motivos registrados en este período" |
| Error / no disponible | `data === undefined` (allSettled rejected) | Card con mismo empty state (no exponer error técnico al cliente) |

Tratar el estado de error igual que el vacío es deliberado: para el cliente final, una falla intermitente del proxy Rails no debe verse como un error técnico — la información simplemente no está disponible.

## 9. Lo que NO está incluido (YAGNI)

- Página dedicada `/dashboard/no-purchase-reasons`.
- Drill-down al hacer click en un motivo (filtrar conversaciones).
- Date picker propio del componente.
- Tabla con paginación / exportable.
- Comparación con período anterior.
- Visualizaciones alternativas (donut, bar chart, mapa de calor).
- Filtros por motivo específico, agente, canal.

Cualquiera de estos puede agregarse después si surge la necesidad.

## 10. Testing

No se contempla testing automatizado nuevo para este feature. Validación manual:

1. Dashboard con datos: la card muestra los motivos ordenados, las barras escalan correctamente, el total coincide con la suma de counts.
2. Dashboard con `total: 0`: la card muestra el empty state.
3. Backend caído (503 del proxy): la card muestra el empty state, el resto del dashboard se renderiza normal.
4. Cambio de date range: la card se actualiza junto con los otros KPIs (mismo SSR pass).
5. Mobile / md viewport: la card ocupa full width.
6. Dark mode: contraste correcto de la barra `volt → aqua` y los textos.

## 11. Open questions

Ninguna. Todas las decisiones de UX están cerradas en la sección 3.

## 12. Próximos pasos

1. Usuario aprueba este spec.
2. Invocar skill `writing-plans` para generar el plan de implementación detallado.
3. Implementar siguiendo el plan, aplicando `frontend-design` y `vercel-react-best-practices` en línea.
