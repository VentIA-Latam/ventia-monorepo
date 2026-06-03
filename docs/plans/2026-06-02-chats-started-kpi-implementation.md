# Plan de implementación: US-AUDIT-003 — KPI chats iniciados por día

**Spec:** `docs/superpowers/specs/2026-06-02-chats-started-kpi-design.md`
**Rama:** `feat/dashboard-daily-chats-counter`
**ClickUp:** [86ah451pt](https://app.clickup.com/t/86ah451pt)

Orden de implementación: **Rails → FastAPI → Frontend**, cada capa verificable antes de la siguiente. Patrón espejo de `conversation-distribution` (commit `1b37a90`).

---

## Archivos a crear / modificar

| # | Archivo | Acción | App |
|---|---------|--------|-----|
| 1 | `apps/messaging/app/services/analytics/chats_started_service.rb` | **Crear** service object | Rails |
| 2 | `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb` | Agregar action `chats_started` | Rails |
| 3 | `apps/messaging/config/routes.rb` | Agregar ruta `chats_started` | Rails |
| 4 | `apps/messaging/spec/services/analytics/chats_started_service_spec.rb` | **Crear** specs service | Rails |
| 5 | `apps/messaging/spec/requests/api/v1/analytics/chats_started_spec.rb` | **Crear** specs request | Rails |
| 6 | `apps/backend/app/services/messaging_service.py` | Agregar `get_chats_started()` | FastAPI |
| 7 | `apps/backend/app/schemas/metrics.py` | Agregar schemas | FastAPI |
| 8 | `apps/backend/app/services/metrics.py` | Agregar `get_chats_started()` + cache | FastAPI |
| 9 | `apps/backend/app/api/v1/endpoints/metrics.py` | Agregar endpoint | FastAPI |
| 10 | `apps/backend/tests/unit/services/test_metrics_chats_started.py` | **Crear** tests | FastAPI |
| 11 | `apps/frontend/app/api/metrics/chats-started/route.ts` | **Crear** API route | Frontend |
| 12 | `apps/frontend/lib/services/metrics-service.ts` | Agregar tipos + `fetchChatsStarted()` | Frontend |
| 13 | `apps/frontend/components/dashboard/chats-started-widget.tsx` | **Crear** widget | Frontend |
| 14 | `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` | Montar widget | Frontend |

---

## FASE A — Rails (messaging)

### Paso 1 — Service object `Analytics::ChatsStartedService`

**Crear** `apps/messaging/app/services/analytics/chats_started_service.rb` con el código del spec (sección "Backend Rails"). Puntos clave:
- `created_in_range` + `where(campaign_id: nil)` + `where(inbox_id:)` opcional.
- `.group(Arel.sql("DATE(conversations.created_at AT TIME ZONE 'UTC' AT TIME ZONE #{tz_quoted})")).count`.
- `fill_zero_days`: itera `from..to` (en la tz) y rellena 0.
- `available_inboxes`: `[]` si `@account` nil; si no, inboxes `channel_type: 'Channel::Whatsapp'` (`id`, `name`).

> **Antes de codear**, abrir `app/controllers/api/v1/analytics/conversations_controller.rb#activity_by_hour` y copiar **literalmente** su expresión `AT TIME ZONE` para que ambas métricas agrupen igual. Si activity_by_hour usa un solo `AT TIME ZONE`, unificar al patrón correcto (doble conversión) en ambos sitios o dejar nota.

### Paso 2 — Action en el controller

**Editar** `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb`. Agregar `chats_started` (código en el spec). Reusa `parse_date_range` y `render_success` existentes. `cross = params[:cross_tenant] == 'true'`; tz = `'UTC'` si cross, sino `params[:timezone] || 'America/Lima'`.

### Paso 3 — Ruta

**Editar** `apps/messaging/config/routes.rb`, en `namespace :analytics`:
```ruby
get 'chats_started', to: 'conversations#chats_started'
```

### Paso 4–5 — Specs

**Crear** ambos specs (escenarios listados en el spec, sección Testing → Rails). Modelar fixtures sobre `distribution_service_spec.rb` y `conversation_distribution_spec.rb`.

### ✅ Verificación Fase A
```bash
cd apps/messaging
bundle exec rspec spec/services/analytics/chats_started_service_spec.rb \
                  spec/requests/api/v1/analytics/chats_started_spec.rb
```
Smoke manual (con la app levantada):
```bash
curl "http://localhost:3001/api/v1/analytics/chats_started?start_date=2026-05-01T00:00:00Z&end_date=2026-06-02T00:00:00Z" \
  -H "X-Tenant-Id: 1"
```
Esperado: `{ success: true, data: { results: [...con días en 0...], total, available_inboxes } }`.

---

## FASE B — FastAPI (backend)

### Paso 6 — Proxy en `messaging_service.py`

**Editar** `apps/backend/app/services/messaging_service.py`. Agregar `get_chats_started()` (código en el spec). Mismo molde que `get_conversation_distribution`: usa `_request_with_status`, propaga `timezone`, `inbox_id`, `cross_tenant`.

### Paso 7 — Schemas

**Editar** `apps/backend/app/schemas/metrics.py`. Agregar `DailyChatCount`, `InboxOption`, `ChatsStartedResponse` (código en el spec).

### Paso 8 — Service + cache

**Editar** `apps/backend/app/services/metrics.py`:
- Module-level: `_chats_started_cache: TTLCache = TTLCache(maxsize=100, ttl=300)`.
- Método `get_chats_started()` (código en el spec). Cache key = `(tenant_id, cross_tenant, inbox_id, start, end)`. Reusa `metrics_repository._get_date_range`. Manejo de errores **idéntico** a `get_conversation_distribution` (copiar el bloque de status_code: 0 / ≥500 / inesperado / sin `data`).

### Paso 9 — Endpoint

**Editar** `apps/backend/app/api/v1/endpoints/metrics.py`. Nuevo `GET /chats-started`, modelando sobre `/activity-by-hour`:
```python
@router.get("/chats-started", response_model=ChatsStartedResponse)
async def get_chats_started(
    period: PeriodType = Query(PeriodType.last_30_days),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    tenant_id: int | None = Query(None, description="Tenant ID (SUPERADMIN only)"),
    inbox_id: int | None = Query(None, description="Filtrar por número WhatsApp (inbox)"),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
):
    # resolver target_tenant / cross_tenant / tz_name (bloque idéntico a activity-by-hour)
    # ...
    return await metrics_service.get_chats_started(
        tenant_id=target_tenant,
        query=MetricsQuery(period=period, start_date=start_date, end_date=end_date),
        tz_name=tz_name,
        inbox_id=inbox_id,
        cross_tenant=cross_tenant,
    )
```
No requiere nuevo permiso: el wildcard `("GET", "/metrics/*")` ya existe en `core/permissions.py`.

### Paso 10 — Tests

**Crear** `apps/backend/tests/unit/services/test_metrics_chats_started.py` (escenarios en el spec → Testing → Python). Modelar sobre `test_metrics_distribution.py`: mock de `messaging_service`, cache hit/miss, errores, SUPERADMIN vs ADMIN, propagación de `inbox_id`.

### ✅ Verificación Fase B
```bash
cd apps/backend
uv run pytest tests/unit/services/test_metrics_chats_started.py -v
uv run ruff check . && uv run ruff format --check .
```
Smoke (con backend + messaging levantados, token válido):
```bash
curl "http://localhost:8000/api/v1/metrics/chats-started?period=last_30_days" \
  -H "Authorization: Bearer <token>"
```

---

## FASE C — Frontend (Next.js)

### Paso 11 — API route (proxy)

**Crear** `apps/frontend/app/api/metrics/chats-started/route.ts` copiando `app/api/metrics/conversation-distribution/route.ts`. Diferencia: pasar también `inbox_id` y `tenant_id` desde `searchParams`. `cache: 'no-store'`.

### Paso 12 — Service + tipos

**Editar** `apps/frontend/lib/services/metrics-service.ts`. Agregar `DailyChatCount`, `InboxOption`, `ChatsStartedResponse` y `fetchChatsStarted(accessToken, query)` (firma en el spec), siguiendo el patrón de `getConversationDistribution`.

### Paso 13 — Widget

**Crear** `apps/frontend/components/dashboard/chats-started-widget.tsx`, molde = `conversation-distribution-widget.tsx`. Implementar:
- Props `{ startDate, endDate }`; estados `data/loading/fetchError`, `inboxId`, `tenantId` (SUPERADMIN).
- Fetch a `/api/metrics/chats-started` con `period=custom`, `start_date`, `end_date`, `inbox_id?`, `tenant_id?`; `AbortController`.
- **Chart línea/area** de recharts (`AreaChart`/`LineChart`, `XAxis` fecha, `YAxis` count, `ResponsiveContainer`, tooltip). Colores oklch volt/aqua.
- **Dropdown** "Número de WhatsApp" (`Select` shadcn) ← `data.available_inboxes`, opción "Todos".
- **Selector tenant** (solo si `role === SUPERADMIN`) ← patrón del widget de distribución.
- **Botón "Exportar CSV"**: helper que arma `fecha,chats\n...` desde `data.results`, `new Blob([...], {type:'text/csv'})`, descarga `chats-iniciados_{from}_{to}.csv`. Disabled si `!data || total===0`.
- Estados loading/error/vacío como los demás widgets.

> Aplicar `vercel-react-best-practices` y `frontend-design`/`interface-design` al construir el componente (memo de datos derivados, sin renders innecesarios, accesibilidad del Select y del botón).

### Paso 14 — Montaje en el dashboard

**Editar** `apps/frontend/app/dashboard/get-started/dashboard-client.tsx`. Renderizar `<ChatsStartedWidget startDate=... endDate=... />` en un `motion.div` junto a los widgets existentes, usando el `fromDate`/`toDate` del filtro global (mismo patrón con que se monta `ConversationDistributionWidget`).

### ✅ Verificación Fase C
```bash
cd apps/frontend
pnpm lint
pnpm build
```
Verificación manual en browser (dashboard):
- La línea muestra chats/día y respeta el filtro Desde/Hasta.
- Cambiar el dropdown de número filtra la serie.
- (SUPERADMIN) cambiar tenant recarga solo el widget.
- "Exportar CSV" descarga el archivo con los mismos días mostrados (incluye 0).
- Estado vacío con un rango sin chats.
- Tema claro/oscuro correcto.

---

## Cierre

1. Correr toda la suite tocada: `rspec` (Rails) + `pytest` (backend) + `pnpm lint && pnpm build` (frontend).
2. Revisar el diff con `/code-review` antes de pedir merge.
3. Marcar AC del spec y mover la tarea en ClickUp (con permiso del usuario).
4. **No commitear sin que el usuario lo pida** (preferencia registrada).

## Riesgos / a vigilar
- **Expresión de timezone en SQL**: unificar con `activity_by_hour` (Paso 1). Es el punto más delicado; validar con una conversación cerca de medianoche local.
- **Pool de conexiones Rails (5)**: el service es set-based (queries constantes); no introducir N+1 en specs ni en `available_inboxes`.
- **Cross-tenant**: confirmar que `available_inboxes` vuelve `[]` y el widget no rompe el dropdown.
