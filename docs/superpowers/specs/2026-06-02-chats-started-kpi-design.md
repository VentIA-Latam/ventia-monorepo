# Spec: KPI — Contador de chats iniciados por día

**Fecha:** 2026-06-02
**Rama:** `feat/dashboard-daily-chats-counter`
**Tarea ClickUp:** [US-AUDIT-003 (86ah451pt)](https://app.clickup.com/t/86ah451pt)
**Estimación:** 2 días

---

## Objetivo

Widget de serie temporal (line/area chart) en el dashboard que muestra **cuántos chats se iniciaron por día**, con filtros por **rango de fechas** (el filtro global Desde/Hasta), por **tenant** (solo SUPERADMIN) y por **número de WhatsApp** (inbox). Permite al negocio medir el **volumen real de demanda** y detectar tendencias y picos. Incluye **export a CSV** del rango filtrado.

---

## Decisiones de diseño

1. **Fuente de datos:** la tabla `conversations` vive en la app **Rails (messaging)**, no en FastAPI. Por eso Rails agrupa por día y FastAPI cachea + aplica permisos, exactamente como `conversation-distribution` y `activity-by-hour`. (La US menciona "tabla conversations en backend" asumiendo una arquitectura que el proyecto no tiene; se adapta al patrón real.)
2. **"Chat iniciado" = conversación creada** en el rango (`created_in_range`, sobre `conversations.created_at`). Consistente con `conversations_count` y `no_purchase_reasons`. Se **excluyen las conversaciones de campaña** (`campaign_id IS NOT NULL`): son marketing outbound (blasts), no demanda entrante, y distorsionarían el volumen.
3. **Agrupación por día en la timezone del tenant** (mismo manejo de tz que `activity_by_hour`), para que "por día" coincida con el día local del negocio y no con UTC. En modo cross-tenant (SUPERADMIN sin tenant) se usa `UTC`, igual que el heatmap.
4. **Relleno de días en cero:** la serie devuelve **todos** los días del rango, incluyendo los de `count = 0`, para que la línea sea continua. El relleno se hace en Rails.
5. **Filtro por número de WhatsApp = `inbox_id`.** En messaging, cada número/canal de WhatsApp es un `Inbox` (`channel_type = 'Channel::Whatsapp'`). El dropdown se llena con `available_inboxes` que viene en la **misma respuesta** (sin endpoint extra). El filtro solo aplica en modo single-tenant; en cross-tenant `available_inboxes` es `[]` (el dropdown solo muestra "Todos").
6. **Chart de línea (area)** con recharts dentro del patrón de los widgets existentes. Tokens del proyecto (volt/aqua en oklch).
7. **Export CSV en el cliente:** el widget ya tiene la serie cargada; genera `fecha,chats` con `Blob` + enlace de descarga. Sin round-trips ni endpoint extra.
8. **Cache de 5 min** en FastAPI (`TTLCache(ttl=300)`), tal como pide la US (los otros widgets usan 15 min; aquí se respeta el AC literal de 5 min).

---

## Arquitectura y flujo de datos

```
Browser
  └─ DashboardClient (usa startDate/endDate del filtro global Desde/Hasta)
       └─ ChatsStartedWidget (Client Component)
            ├─ dropdown inbox (de available_inboxes) + botón Exportar CSV (cliente)
            └─ GET /api/metrics/chats-started?start=X&end=Y&inbox_id=Z  (Next.js API Route)
                 └─ GET /api/v1/metrics/chats-started  (FastAPI)
                      └─ MetricsService.get_chats_started()
                           ├─ TTLCache(ttl=300) hit → devuelve inmediato
                           └─ TTLCache miss → messaging_service.get_chats_started()
                                └─ GET /api/v1/analytics/chats_started  (Rails)
                                     └─ Analytics::ChatsStartedService.perform
```

Patrón idéntico al de `2026-05-28-conversation-distribution-design.md`.

### Estructura de respuesta (Rails → Python → Frontend)

```json
{
  "success": true,
  "data": {
    "results": [
      { "date": "2026-06-01", "count": 42 },
      { "date": "2026-06-02", "count": 0 },
      { "date": "2026-06-03", "count": 17 }
    ],
    "total": 59,
    "available_inboxes": [
      { "id": 3, "name": "Ventas WhatsApp" },
      { "id": 7, "name": "Soporte WhatsApp" }
    ]
  }
}
```

---

## Backend Rails

### Service object set-based (`Analytics::ChatsStartedService`)

Sigue el precedente de `Analytics::DistributionService` / `AdsSummaryService`. Número **constante** de queries (no N), respetando el límite del pool de conexiones (5) — crítico por el incidente previo donde queries N+1 agotaron el pool y cortaron WebSockets.

```ruby
# apps/messaging/app/services/analytics/chats_started_service.rb
module Analytics
  class ChatsStartedService
    def initialize(scope:, account:, start_date:, end_date:, timezone:, inbox_id: nil)
      @scope = scope            # current_account.conversations o Conversation (cross_tenant)
      @account = account        # nil en cross_tenant
      @start_date = start_date
      @end_date = end_date
      @timezone = timezone      # ej. "America/Lima"; "UTC" en cross_tenant
      @inbox_id = inbox_id
    end

    def perform
      relation = @scope.created_in_range(@start_date, @end_date)
                       .where(campaign_id: nil)
      relation = relation.where(inbox_id: @inbox_id) if @inbox_id.present?

      # Query 1 — conteo agrupado por día en la tz (mismo manejo que activity_by_hour)
      tz_quoted = ActiveRecord::Base.connection.quote(@timezone)
      counts = relation
        .group(Arel.sql("DATE(conversations.created_at AT TIME ZONE 'UTC' AT TIME ZONE #{tz_quoted})"))
        .count
      # counts => { Date|String => Integer }

      results = fill_zero_days(counts)
      total = results.sum { |r| r[:count] }

      { results: results, total: total, available_inboxes: available_inboxes }
    end

    private

    # Genera TODOS los días del rango (en la tz) con count, rellenando 0 los ausentes.
    def fill_zero_days(counts)
      by_day = counts.transform_keys { |k| k.to_s[0, 10] }   # "YYYY-MM-DD"
      from = @start_date.in_time_zone(@timezone).to_date
      to   = @end_date.in_time_zone(@timezone).to_date
      (from..to).map do |day|
        key = day.iso8601
        { date: key, count: by_day[key].to_i }
      end
    end

    # Inboxes WhatsApp para el dropdown. Solo en modo single-tenant.
    def available_inboxes
      return [] if @account.nil?
      @account.inboxes
              .where(channel_type: 'Channel::Whatsapp')
              .order(:name)
              .pluck(:id, :name)
              .map { |id, name| { id: id, name: name } }
    end
  end
end
```

**Nota tz/SQL:** se usa el doble `AT TIME ZONE 'UTC' AT TIME ZONE tz` (la columna `created_at` es `timestamp without time zone` almacenada en UTC). Durante la implementación, verificar contra el manejo de `activity_by_hour` y unificar si difiere, para mantener consistencia entre métricas.

### Endpoint (action en el controller de analytics)

`GET /api/v1/analytics/chats_started`

**Archivo:** `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb`

```ruby
def chats_started
  start_date, end_date = parse_date_range
  return if performed?

  cross = params[:cross_tenant] == 'true'
  scope = cross ? Conversation : current_account.conversations
  tz    = cross ? 'UTC' : (params[:timezone].presence || 'America/Lima')

  result = ::Analytics::ChatsStartedService.new(
    scope: scope,
    account: cross ? nil : current_account,
    start_date: start_date,
    end_date: end_date,
    timezone: tz,
    inbox_id: params[:inbox_id].presence,
  ).perform

  render_success(result)
end
```

**Ruta** (`config/routes.rb`, en el namespace `:analytics`):
```ruby
get 'chats_started', to: 'conversations#chats_started'
```

---

## Backend Python (FastAPI)

### `messaging_service.py` — método proxy

```python
async def get_chats_started(
    self,
    tenant_id: int,
    start_date: str,
    end_date: str,
    timezone: str = "America/Lima",
    inbox_id: int | None = None,
    cross_tenant: bool = False,
) -> tuple[Optional[dict], int]:
    params: dict = {"start_date": start_date, "end_date": end_date, "timezone": timezone}
    if inbox_id is not None:
        params["inbox_id"] = str(inbox_id)
    if cross_tenant:
        params["cross_tenant"] = "true"
    return await self._request_with_status(
        "GET",
        "/api/v1/analytics/chats_started",
        tenant_id,
        params=params,
        timeout=15.0,
    )
```

### `metrics.py` — método con TTLCache de 5 min

```python
_chats_started_cache: TTLCache = TTLCache(maxsize=100, ttl=300)  # 5 min (AC de la US)

async def get_chats_started(
    self,
    tenant_id: int | None,
    query: MetricsQuery,
    tz_name: str = "America/Lima",
    inbox_id: int | None = None,
    cross_tenant: bool = False,
) -> dict:
    start_utc, end_utc = metrics_repository._get_date_range(
        query.period, query.start_date, query.end_date, tz_name
    )
    cache_key = (tenant_id, cross_tenant, inbox_id, str(start_utc), str(end_utc))
    if cache_key in _chats_started_cache:
        logger.info(f"chats_started_cache_hit: tenant_id={tenant_id}")
        return _chats_started_cache[cache_key]

    effective_tenant_id = tenant_id or 1
    messaging_result, status_code = await messaging_service.get_chats_started(
        tenant_id=effective_tenant_id,
        start_date=start_utc.isoformat(),
        end_date=end_utc.isoformat(),
        timezone="UTC" if cross_tenant else tz_name,
        inbox_id=inbox_id,
        cross_tenant=cross_tenant,
    )

    # Manejo de errores idéntico a get_activity_by_hour / get_conversation_distribution:
    # status_code == 0   → RuntimeError("Messaging service unavailable")
    # status_code >= 500 → RuntimeError("Messaging service error (status ...)")
    # status_code not in (200, 201) → RuntimeError("Unexpected status ...")
    # payload sin "data" → RuntimeError("Invalid response ...")

    data = messaging_result["data"]
    result = {
        "results": data.get("results", []),
        "total": data.get("total", 0),
        "available_inboxes": data.get("available_inboxes", []),
    }
    _chats_started_cache[cache_key] = result
    return result
```

**Nota sobre el cache:** in-memory single-worker (el Dockerfile arranca `uvicorn` sin `--workers`). Consistente con el resto del dashboard, sin cambios de infraestructura. Si en el futuro se escala a múltiples workers/réplicas, migrar a Redis (ya disponible en el stack para Sidekiq).

### Schema Pydantic (`schemas/metrics.py`)

```python
class DailyChatCount(BaseModel):
    date: str          # "YYYY-MM-DD"
    count: int

class InboxOption(BaseModel):
    id: int
    name: str

class ChatsStartedResponse(BaseModel):
    results: list[DailyChatCount]
    total: int
    available_inboxes: list[InboxOption]
```

### Endpoint FastAPI (`api/v1/endpoints/metrics.py`)

```
GET /api/v1/metrics/chats-started
```

**Query params:** `period`, `start_date`, `end_date`, `tenant_id` (solo SUPERADMIN), `inbox_id` (opcional)

**Lógica de acceso** (idéntica al heatmap / distribution):
```python
if current_user.role == SUPERADMIN:
    if request_tenant_id is not None:
        target_tenant, cross_tenant = request_tenant_id, False
        tz_name = _get_tenant_timezone(db, request_tenant_id)
    else:
        target_tenant, cross_tenant = None, True   # agrega todos los tenants
        tz_name = "UTC"
else:
    target_tenant, cross_tenant = current_user.tenant_id, False
    tz_name = _get_tenant_timezone(db, current_user.tenant_id)
```

**Permiso:** `require_permission_dual("GET", "/metrics/*")` — el wildcard ya existe en `permissions.py` (`("GET", "/metrics/*")` habilitado para todos los roles), igual que `activity-by-hour`. No requiere registrar permiso nuevo.

---

## Frontend (Next.js)

### Next.js API Route

`app/api/metrics/chats-started/route.ts` — proxy al FastAPI con el token Auth0, pasando `period`, `start_date`, `end_date`, `tenant_id` e `inbox_id`. Sigue el patrón de `app/api/metrics/conversation-distribution/route.ts` (`cache: 'no-store'`).

### Service function y tipos (`lib/services/metrics-service.ts`)

```typescript
export interface DailyChatCount {
  date: string;   // "YYYY-MM-DD"
  count: number;
}

export interface InboxOption {
  id: number;
  name: string;
}

export interface ChatsStartedResponse {
  results: DailyChatCount[];
  total: number;
  available_inboxes: InboxOption[];
}

export async function fetchChatsStarted(
  accessToken: string,
  query: MetricsQuery & { inbox_id?: number; tenant_id?: number },
): Promise<ChatsStartedResponse>;
```

### Componente (`components/dashboard/chats-started-widget.tsx`)

**Nota de ubicación:** se usa `components/dashboard/` (convención real del repo), NO la ruta `app/dashboard/_components/` que sugería la tarea de ClickUp.

**Tipo:** Client Component. Props `{ startDate: string; endDate: string }` (recibe el rango del filtro global).

**Decisiones técnicas:**
- **Area/Line chart de recharts** dentro del patrón de Card de los widgets existentes (`conversation-distribution-widget.tsx` como molde). Eje X = fecha, eje Y = chats.
- **Colores:** tokens del proyecto en oklch (volt/aqua), coherentes con los demás widgets.
- **Fetch:** `URLSearchParams` con `period="custom"`, `start_date`, `end_date`, `inbox_id` (si seleccionado); `AbortController` para cleanup (patrón existente).
- **Dropdown "Número de WhatsApp":** `Select` de shadcn poblado con `available_inboxes` de la respuesta; opción por defecto "Todos los números". Al cambiar → refetch de la serie. En cross-tenant `available_inboxes` llega `[]` → solo "Todos".
- **Botón "Exportar CSV":** genera en cliente un `Blob` `text/csv` con cabecera `fecha,chats` + una fila por día del `results` cargado; nombre `chats-iniciados_{from}_{to}.csv`. Deshabilitado si no hay datos.
- **Estados:** loading (spinner) / error / vacío (`total === 0` → "Sin chats en el período seleccionado"), igual que los otros widgets.
- **Sin selector de tenant en el frontend.** Al implementar se verificó que **ningún** widget del dashboard expone un selector de tenant; todos dependen del rol del usuario en el backend. Se mantiene esa consistencia: el backend ya entrega cross-tenant por defecto a SUPERADMIN y su-tenant a ADMIN. (El endpoint igualmente acepta `tenant_id` para uso futuro.)

### Integración en el dashboard

- `app/dashboard/get-started/dashboard-client.tsx`: render del widget en un `motion.div` junto a los demás, pasándole `startDate`/`endDate` del filtro Desde/Hasta ya existente. El widget hace su propio fetch client-side (no requiere prefetch en el server component, igual que el flujo client de los otros widgets con filtro).

---

## Testing

### Rails (RSpec) — sigue `distribution_service_spec.rb`

`spec/services/analytics/chats_started_service_spec.rb`:
- Cuenta conversaciones por día correctamente dentro del rango
- **Rellena con 0** los días sin conversaciones (serie continua)
- Agrupa en la **timezone** indicada (una conversación cerca de medianoche cae en el día local correcto, no UTC)
- Excluye conversaciones de **campaña** (`campaign_id` presente)
- Filtra por **`inbox_id`** cuando se pasa
- `available_inboxes` lista solo inboxes WhatsApp del account; `[]` cuando `account` es nil (cross-tenant)
- Resultado vacío (todos en 0) cuando no hay conversaciones en el rango

`spec/requests/api/v1/analytics/chats_started_spec.rb`:
- 200 con la estructura esperada (`results`, `total`, `available_inboxes`)
- Respeta el rango de fechas
- `cross_tenant=true` agrega todos los tenants y `available_inboxes` vacío
- `inbox_id` filtra
- Fechas inválidas → 400 (vía `parse_date_range`)

### Backend Python (pytest) — sigue `test_metrics_distribution.py`

`tests/unit/services/test_metrics_chats_started.py`:
- Mock de `messaging_service`, verifica **cache hit/miss** (TTL 5 min; key incluye `inbox_id` y `cross_tenant`)
- Manejo de errores (status 0 / 500 / status inesperado / payload sin `data`)
- Lógica **SUPERADMIN cross-tenant** (tz UTC) vs **ADMIN tenant propio** (tz del tenant)
- `inbox_id` se propaga al proxy

### Frontend

Verificación manual en el browser (golden path + estado vacío + cambio de inbox + export CSV), según la guía de UI del CLAUDE.md. No se agregan e2e.

---

## Archivos a crear / modificar

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/messaging/app/services/analytics/chats_started_service.rb` | Service object: conteo por día + relleno 0 + inboxes |
| `apps/messaging/spec/services/analytics/chats_started_service_spec.rb` | Specs del service |
| `apps/messaging/spec/requests/api/v1/analytics/chats_started_spec.rb` | Specs del endpoint |
| `apps/backend/tests/unit/services/test_metrics_chats_started.py` | Tests del metrics service |
| `apps/frontend/app/api/metrics/chats-started/route.ts` | API Route Next.js |
| `apps/frontend/components/dashboard/chats-started-widget.tsx` | Widget line/area chart + CSV |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb` | Nuevo action `chats_started` |
| `apps/messaging/config/routes.rb` | Nueva ruta GET `chats_started` |
| `apps/backend/app/services/messaging_service.py` | Nuevo método proxy `get_chats_started` |
| `apps/backend/app/services/metrics.py` | Nuevo método + `_chats_started_cache` (TTL 300) |
| `apps/backend/app/schemas/metrics.py` | Schemas `DailyChatCount`, `InboxOption`, `ChatsStartedResponse` |
| `apps/backend/app/api/v1/endpoints/metrics.py` | Nuevo endpoint `GET /metrics/chats-started` |
| `apps/frontend/lib/services/metrics-service.ts` | Nueva función `fetchChatsStarted` + tipos |
| `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` | Montar el widget con el filtro Desde/Hasta |

---

## Edge cases y notas abiertas

1. **Campañas:** las conversaciones de campaña (`campaign_id IS NOT NULL`) se **excluyen** (marketing outbound, no demanda entrante).
2. **Timezone y fronteras de día:** la agrupación usa la tz del tenant; una conversación a las 23:30 hora local cae en su día local, no en el día UTC. En cross-tenant se usa UTC (no hay una tz única para múltiples tenants).
3. **Rangos largos:** con 90+ días la línea sigue siendo legible (a diferencia de barras). No se pagina; el volumen de puntos (1/día) es bajo.
4. **`available_inboxes` en cross-tenant:** vacío a propósito (filtrar por un inbox concreto cruzando tenants no tiene sentido de negocio). El dropdown solo muestra "Todos".
5. **Inboxes sin conversaciones en el rango:** aparecen igual en el dropdown (lista todos los inboxes WhatsApp del account, no solo los con datos), para poder filtrar y ver una serie en 0.
6. **CSV:** refleja exactamente la serie mostrada (mismos días con 0 incluidos). Separador coma, encoding UTF-8.

---

## Acceptance Criteria

- [ ] `GET /api/v1/metrics/chats-started?period|start_date|end_date|tenant_id|inbox_id` operativo en FastAPI
- [ ] La query usa `conversations.created_at` (vía Rails) agrupado por día en la tz del tenant
- [ ] La serie incluye **todos** los días del rango, con `count = 0` donde no hubo chats
- [ ] Widget en el dashboard renderiza un chart de **línea** (recharts) con la serie diaria
- [ ] Filtro por **número de WhatsApp** (inbox) vía dropdown poblado por `available_inboxes`
- [ ] El filtro global **Desde/Hasta** actualiza el widget
- [ ] **Cache de 5 min** en FastAPI (`TTLCache(ttl=300)`)
- [ ] **SUPERADMIN** ve cross-tenant; **ADMIN** solo su propio tenant
- [ ] **Export a CSV** del rango filtrado (generado en cliente: `fecha,chats`)
- [ ] Conversaciones de campaña excluidas del conteo
- [ ] Estado vacío cuando `total === 0`
- [ ] Tests: RSpec (service + request) y pytest (metrics service con cache y permisos)
