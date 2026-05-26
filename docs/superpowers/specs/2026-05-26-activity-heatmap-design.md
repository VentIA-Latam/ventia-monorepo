# Spec: Métrica — Distribución de mensajes por hora

**Fecha:** 2026-05-26
**Rama:** `feat/dashboard-activity-heatmap`
**Tarea ClickUp:** [86ahf9j8a](https://app.clickup.com/t/86ahf9j8a)
**Estimación:** 2 días

---

## Objetivo

Widget heatmap que muestra la distribución de actividad de mensajería por hora del día (0–23) y día de semana (0=domingo, 6=sábado), para identificar picos de demanda y dimensionar staffing.

---

## Arquitectura y flujo de datos

```
Browser
  └─ DashboardClient (usa startDate/endDate del URL)
       └─ ActivityHeatmapWidget (Client Component)
            └─ GET /api/dashboard/activity-by-hour?start=X&end=Y  (Next.js API Route)
                 └─ GET /api/v1/metrics/activity-by-hour  (FastAPI)
                      └─ MetricsService.get_activity_by_hour()
                           ├─ TTLCache hit → devuelve inmediato
                           └─ TTLCache miss → messaging_service.get_activity_by_hour()
                                └─ GET /api/v1/analytics/activity_by_hour  (Rails)
                                     └─ Message.group_by(day_of_week, hour).count()
```

### Estructura de respuesta (Rails → Python → Frontend)

```json
{
  "matrix": [[0,3,1,...], [5,12,8,...], ...],
  "max_count": 47,
  "period": "custom",
  "start_date": "2026-05-01",
  "end_date": "2026-05-26",
  "timezone_note": null
}
```

- `matrix[0]` = domingo, `matrix[6]` = sábado
- Cada índice del array = hora (0–23)
- `timezone_note` = `"UTC"` solo cuando SUPERADMIN consulta cross-tenant (todos los tenants)

---

## Backend Rails

### Nuevo endpoint

`GET /api/v1/analytics/activity_by_hour`

**Parámetros:** `start_date`, `end_date`, `timezone`, `tenant_id` (opcional)

**Archivo:** `apps/messaging/app/controllers/api/v1/analytics_controller.rb`

```ruby
def activity_by_hour
  tz = params[:timezone].presence || 'America/Lima'
  scope = Message.where(created_at: start_date..end_date)
  scope = scope.where(account_id: params[:tenant_id]) if params[:tenant_id].present?

  counts = scope
    .group("EXTRACT(DOW FROM created_at AT TIME ZONE '#{tz}')")
    .group("EXTRACT(HOUR FROM created_at AT TIME ZONE '#{tz}')")
    .count

  matrix = Array.new(7) { Array.new(24, 0) }
  counts.each do |(dow, hour), count|
    matrix[dow.to_i][hour.to_i] = count
  end

  render json: {
    success: true,
    data: { matrix: matrix, max_count: matrix.flatten.max }
  }
end
```

**Notas:**
- El timezone se aplica en SQL para reflejar la hora local del negocio
- Query única, sin N+1
- `max_count` se calcula en Rails para evitar iteración en el cliente
- Cuando `tenant_id` está ausente, Rails agrega todos los tenants (solo SUPERADMIN)

**Ruta Rails:** se agrega junto a `conversations_count` y `no_purchase_reasons` en el router de analytics.

---

## Backend Python (FastAPI)

### `messaging_service.py` — nuevo método

```python
async def get_activity_by_hour(
    self,
    tenant_id: int | None,
    start_date: str,
    end_date: str,
    timezone: str = "America/Lima",
) -> tuple[Optional[dict], int]:
    params = {"start_date": start_date, "end_date": end_date, "timezone": timezone}
    if tenant_id is not None:
        params["tenant_id"] = tenant_id
    # Usa _request_with_status (igual que get_ads_summary / get_no_purchase_reasons)
    # que retorna (payload, status_code) donde status_code=0 indica fallo de red.
    # Nota de implementación: _request_with_status requiere un tenant_id entero para
    # construir el header X-Tenant-Id. Para el caso cross-tenant (tenant_id=None),
    # durante implementación evaluar: (a) usar tenant_id=0 si Rails lo ignora en ese
    # endpoint, o (b) agregar un método _request_with_status_no_tenant que omita el header.
    return await self._request_with_status(
        "GET",
        "/api/v1/analytics/activity_by_hour",
        tenant_id or 0,
        params=params,
        timeout=15.0,
    )
```

Cuando `tenant_id=None`, Rails agrega todos los tenants (solo SUPERADMIN llega aquí).

### `metrics_service.py` — nuevo método

```python
from cachetools import TTLCache

_activity_cache: TTLCache = TTLCache(maxsize=100, ttl=900)  # 15 min

async def get_activity_by_hour(
    self,
    tenant_id: int | None,
    query: MetricsQuery,
    tz_name: str = "America/Lima",
) -> dict:
    start_utc, end_utc = metrics_repository._get_date_range(
        query.period, query.start_date, query.end_date, tz_name
    )
    cache_key = (tenant_id, str(start_utc), str(end_utc))

    if cache_key in _activity_cache:
        return _activity_cache[cache_key]

    result, status_code = await messaging_service.get_activity_by_hour(
        tenant_id=tenant_id,
        start_date=start_utc.isoformat(),
        end_date=end_utc.isoformat(),
        timezone=tz_name,
    )
    # Manejo de errores igual que ads_summary / no_purchase_reasons
    # status_code == 0 → RuntimeError("Messaging service unavailable")
    # status_code >= 500 → RuntimeError("Messaging service error")
    # status_code not in (200, 201) → RuntimeError("Unexpected status")
    # payload sin "data" → RuntimeError("Invalid response")

    _activity_cache[cache_key] = result
    return result
```

### Schema Pydantic (`schemas/metrics.py`)

```python
class ActivityByHourResponse(BaseModel):
    matrix: list[list[int]]        # 7 × 24
    max_count: int
    period: str
    start_date: date
    end_date: date
    timezone_note: str | None = None
```

### Endpoint FastAPI (`api/v1/endpoints/metrics.py`)

```
GET /api/v1/metrics/activity-by-hour
```

**Query params:** `period`, `start_date`, `end_date`, `tenant_id` (solo SUPERADMIN)

**Lógica de acceso:**
```python
if current_user.role == SUPERADMIN:
    target_tenant = request_tenant_id  # None = cross-tenant (todos los tenants)
    tz_note = "UTC" if target_tenant is None else None
else:
    target_tenant = current_user.tenant_id  # siempre su propio tenant
    tz_note = None
```

**Permiso:** `require_permission_dual("GET", "/metrics/activity-by-hour")`

**Timezone SUPERADMIN cross-tenant:** cuando agrega todos los tenants, se usa UTC en la query SQL y se retorna `timezone_note: "UTC"` para que el frontend pueda indicarlo.

---

## Frontend (Next.js)

### Next.js API Route

`app/api/dashboard/activity-by-hour/route.ts`

Sigue el patrón de las otras rutas del dashboard: recibe `start_date`, `end_date`, opcionalmente `tenant_id`, hace proxy al FastAPI con el token Auth0 del usuario.

### Service function (`lib/services/metrics-service.ts`)

```typescript
export interface ActivityByHourResponse {
  matrix: number[][];   // 7 × 24
  max_count: number;
  period: string;
  start_date: string;
  end_date: string;
  timezone_note?: string;
}

export async function getActivityByHour(
  accessToken: string,
  startDate: string,
  endDate: string,
  tenantId?: number,
): Promise<ActivityByHourResponse>
```

### Componente (`components/dashboard/activity-heatmap-widget.tsx`)

**Tipo:** Client Component. Recibe datos como prop (igual que `AdsSummaryWidget`).

**Estructura visual:**

```
┌─────────────────────────────────────────────────────────┐
│  📊 Actividad por hora          [selector tenant SADMIN] │
│  Distribución de mensajes por día y hora                 │
│─────────────────────────────────────────────────────────│
│                                                          │
│       [Heatmap 7×24 — CSS grid dentro de ChartContainer]│
│        ChartTooltip al hacer hover                       │
│                                                          │
│─────────────────────────────────────────────────────────│
│  Pico: Lunes 10h · 47 mensajes        May 2026   ↗     │
└─────────────────────────────────────────────────────────┘
```

**Decisiones técnicas:**
- Usa `ChartContainer` + `ChartTooltip` + `ChartTooltipContent` de shadcn para el estilo consistente con el resto de charts del dashboard. El tema (claro/oscuro) se hereda automáticamente vía CSS variables.
- Las celdas del heatmap son `div`s en CSS grid (7 columnas × 24 filas), no SVG de recharts — más eficiente para rectángulos coloreados.
- **Escala de color:** `count === 0` → `bg-muted/30`. `count > 0` → opacidad interpolada usando `--color-chart-1` de shadcn, de 10% (mínimo) a 100% (máximo = `max_count`).
- **Tooltip:** `{día} {hora}:00 — {count} mensajes`
- **Footer:** pico de actividad (`max_count`, día y hora) + rango de fechas del filtro global
- **Estado vacío:** si `max_count === 0` o `data` es `undefined`, muestra mensaje "Sin actividad en el período seleccionado"

**Selector de tenant (solo SUPERADMIN):**
- `Select` de shadcn en el header del card
- Por defecto: "Todos los tenants" (cross-tenant agregado)
- Al cambiar: fetch independiente sin recargar el resto del dashboard
- Cuando está en "Todos los tenants" el footer muestra "(Horario UTC)"

### Integración en `dashboard-client.tsx`

```tsx
// Prop adicional
initialActivityByHour?: ActivityByHourResponse

// En el JSX — entre AdsSummaryWidget y SalesMap:
<motion.div variants={fadeUp}>
  <ActivityHeatmapWidget
    data={initialActivityByHour}
    isSuperAdmin={isSuperAdmin}
  />
</motion.div>
```

El server component (`get-started/page.tsx`) fetcha los datos en paralelo junto con los demás usando `Promise.all`. Si falla, pasa `undefined` (el widget muestra estado vacío).

---

## Archivos a crear / modificar

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/frontend/components/dashboard/activity-heatmap-widget.tsx` | Widget heatmap |
| `apps/frontend/app/api/dashboard/activity-by-hour/route.ts` | API Route Next.js |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/messaging/app/controllers/api/v1/analytics_controller.rb` | Nuevo action `activity_by_hour` |
| `apps/messaging/config/routes.rb` | Nueva ruta GET |
| `apps/backend/app/services/messaging_service.py` | Nuevo método `get_activity_by_hour` |
| `apps/backend/app/services/metrics.py` | Nuevo método + TTLCache |
| `apps/backend/app/schemas/metrics.py` | Schema `ActivityByHourResponse` |
| `apps/backend/app/api/v1/endpoints/metrics.py` | Nuevo endpoint |
| `apps/backend/app/core/permissions.py` | Nuevo permiso |
| `apps/backend/pyproject.toml` | Agregar `cachetools` |
| `apps/frontend/lib/services/metrics-service.ts` | Nueva función + tipo |
| `apps/frontend/app/dashboard/get-started/page.tsx` | Fetch paralelo + prop |
| `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` | Integrar widget |

---

## Acceptance Criteria

- [ ] `GET /api/v1/metrics/activity-by-hour` retorna matriz 7×24 con conteo de mensajes
- [ ] Widget heatmap visible en dashboard con leyenda de intensidad y tooltip por celda
- [ ] El filtro global Desde/Hasta del dashboard actualiza el heatmap
- [ ] Cache de 15 min en memoria (TTLCache) evita llamadas repetidas a Rails
- [ ] SUPERADMIN ve datos cross-tenant por defecto con selector de tenant
- [ ] ADMIN solo ve su propio tenant (tenant_id del JWT)
- [ ] Cuando `max_count === 0` el widget muestra estado vacío
- [ ] El timezone de la query corresponde al timezone del tenant; cross-tenant usa UTC
- [ ] El widget hereda el tema claro/oscuro del sistema sin lógica propia
