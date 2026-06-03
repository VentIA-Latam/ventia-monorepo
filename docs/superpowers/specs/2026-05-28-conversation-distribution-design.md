# Spec: Métrica — Distribución de conversaciones por tipo (IA / Humano / Abandonadas)

**Fecha:** 2026-05-28
**Rama:** `feat/dashboard-activity-heatmap` (continuación) — evaluar rama propia `feat/dashboard-conversation-distribution`
**Tarea ClickUp:** [86ahfb4wd](https://app.clickup.com/t/86ahfb4wd)
**Estimación:** 2 días

---

## Objetivo

Widget de pie chart en el dashboard que muestra la distribución de conversaciones por tipo de atención: manejadas por el agente **IA**, por un **Humano**, o **Abandonadas** (el cliente dejó de responder). Permite al negocio dimensionar cuánta atención automatiza la IA vs cuánta requiere intervención humana, y cuántos leads se pierden.

---

## Decisiones de diseño

1. **Unidad del pie:** número de **conversaciones**. Cada conversación cae en **un solo bucket**. El tooltip muestra `% + count absoluto + horas totales` como datos secundarios.
2. **Regla IA/Humano:** si **cualquier** humano participó en la conversación → `human_support`. Solo si la IA manejó todo sin intervención humana → `agent_ai`. Refleja que el tiempo humano es el recurso costoso a medir.
3. **Definición de Abandonada (con precedencia):** el último mensaje fue saliente (IA o humano) y el cliente no respondió en **24h+**. Toma **precedencia** sobre IA/Humano: si está abandonada, va a `abandoned` sin importar quién atendió. Conversaciones cuyo último saliente es `<24h` aún no "vencen" y se clasifican por su handler.

**Orden de precedencia:** `abandoned` → `human_support` → `agent_ai`.

---

## Cómo se distinguen los mensajes (base de la clasificación)

Lógica derivada de `apps/frontend/lib/utils/messaging.ts`:

| Tipo | Condición SQL |
|------|---------------|
| **Cliente** | `message_type = incoming` (sender = Contact) |
| **IA** | `message_type IN (outgoing, template)` Y `sender_id IS NULL` Y `content_attributes->>'external_echo' IS NULL` (n8n llama la API solo con header de tenant, sin sender) |
| **Operador humano (app)** | `message_type IN (outgoing, template)` Y `sender_type = 'User'` |
| **Humano vía WhatsApp móvil (coexistence)** | `message_type IN (outgoing, template)` Y `sender_id IS NULL` Y `content_attributes->>'external_echo' IS NOT NULL` |

Toda la clasificación es expresable en SQL → set-based, sin N+1.

---

## Arquitectura y flujo de datos

```
Browser
  └─ DashboardClient (usa startDate/endDate del URL)
       └─ ConversationDistributionWidget (Client Component)
            └─ GET /api/metrics/conversation-distribution?start=X&end=Y  (Next.js API Route)
                 └─ GET /api/v1/metrics/conversation-distribution  (FastAPI)
                      └─ MetricsService.get_conversation_distribution()
                           ├─ TTLCache hit → devuelve inmediato
                           └─ TTLCache miss → messaging_service.get_conversation_distribution()
                                └─ GET /api/v1/analytics/conversation_distribution  (Rails)
                                     └─ Analytics::DistributionService.perform
```

Patrón idéntico al heatmap de actividad (`2026-05-26-activity-heatmap-design.md`).

### Estructura de respuesta (Rails → Python → Frontend)

```json
{
  "success": true,
  "data": {
    "distribution": [
      { "category": "agent_ai",      "count": 120, "percentage": 60.0, "total_hours": 45.2 },
      { "category": "human_support", "count": 50,  "percentage": 25.0, "total_hours": 88.7 },
      { "category": "abandoned",     "count": 30,  "percentage": 15.0, "total_hours": 12.1 }
    ],
    "total_conversations": 200
  }
}
```

---

## Backend Rails

### Enfoque: Service object set-based (`Analytics::DistributionService`)

Sigue el precedente de `Analytics::AdsSummaryService`. Número **constante** de queries (no N), respetando el límite del pool de conexiones (5) — crítico por el incidente previo donde queries N+1 agotaron el pool y cortaron WebSockets.

**Conversaciones incluidas:** las creadas en el rango (`created_in_range`), consistente con `conversations_count` y `no_purchase_reasons`. **Se excluyen las conversaciones de campañas** (`campaign_id IS NOT NULL`): son marketing outbound (blasts), no atención a conversaciones, y distorsionarían la métrica. El `trigger_service` crea cada conversación de campaña con `campaign: @campaign`, por lo que son distinguibles a nivel de conversación.

```ruby
# apps/messaging/app/services/analytics/distribution_service.rb
module Analytics
  class DistributionService
    HUMAN_SQL = "sender_type = 'User' OR content_attributes->>'external_echo' IS NOT NULL"
    ABANDON_THRESHOLD = 24.hours

    def initialize(scope:, start_date:, end_date:, now: Time.current)
      @scope = scope            # current_account.conversations o Conversation (cross_tenant)
      @start_date = start_date
      @end_date = end_date
      @now = now
    end

    def perform
      # Query 1 — base: ids + timestamps para duración.
      # Excluye conversaciones de campañas (marketing outbound, no atención).
      convs = @scope.created_in_range(@start_date, @end_date)
                    .where(campaign_id: nil)
                    .pluck(:id, :created_at, :last_activity_at)
      conv_ids = convs.map(&:first)
      return empty_result if conv_ids.empty?

      # Query 2 — conversaciones con CUALQUIER mensaje humano
      human_ids = Message.where(conversation_id: conv_ids)
                         .where(message_type: [:outgoing, :template])
                         .where(HUMAN_SQL)
                         .distinct.pluck(:conversation_id).to_set

      # Query 3 — último mensaje real por conversación (ignora 'activity')
      last_msgs = Message.where(conversation_id: conv_ids)
                         .where.not(message_type: :activity)
                         .select("DISTINCT ON (conversation_id) conversation_id, message_type, created_at")
                         .order("conversation_id, created_at DESC")
      last_by_conv = last_msgs.index_by(&:conversation_id)

      # Clasificación con precedencia (en Ruby, sobre conjuntos)
      buckets = { agent_ai: [], human_support: [], abandoned: [] }
      convs.each do |id, created_at, last_activity_at|
        last = last_by_conv[id]
        category =
          if abandoned?(last)
            :abandoned
          elsif human_ids.include?(id)
            :human_support
          else
            :agent_ai
          end
        buckets[category] << (last_activity_at - created_at)  # duración en segundos
      end

      build_result(buckets, conv_ids.size)
    end

    private

    def abandoned?(last)
      return false if last.nil?
      outgoing = %w[outgoing template].include?(last.message_type)
      outgoing && (@now - last.created_at) > ABANDON_THRESHOLD
    end

    def build_result(buckets, total)
      distribution = %i[agent_ai human_support abandoned].map do |cat|
        durations = buckets[cat]
        count = durations.size
        {
          category: cat,
          count: count,
          percentage: total > 0 ? (count.to_f / total * 100).round(1) : 0.0,
          total_hours: (durations.sum / 3600.0).round(1)
        }
      end
      { distribution: distribution, total_conversations: total }
    end

    def empty_result
      distribution = %i[agent_ai human_support abandoned].map do |cat|
        { category: cat, count: 0, percentage: 0.0, total_hours: 0.0 }
      end
      { distribution: distribution, total_conversations: 0 }
    end
  end
end
```

### Endpoint (action en el controller de analytics)

`GET /api/v1/analytics/conversation_distribution`

**Archivo:** `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb`

```ruby
def conversation_distribution
  start_date, end_date = parse_date_range
  return if performed?

  scope = if params[:cross_tenant] == 'true'
            Conversation
          else
            current_account.conversations
          end

  result = ::Analytics::DistributionService.new(
    scope: scope, start_date: start_date, end_date: end_date
  ).perform

  render_success(result)
end
```

**Ruta** (`config/routes.rb`, en el namespace `:analytics`):
```ruby
get 'conversation_distribution', to: 'conversations#conversation_distribution'
```

**Nota:** cuando `scope = Conversation` (cross_tenant), `created_in_range` sigue funcionando porque es un scope de clase. El `cross_tenant=true` solo lo envía el backend Python tras verificar rol SUPERADMIN.

---

## Backend Python (FastAPI)

### `messaging_service.py` — método proxy

```python
async def get_conversation_distribution(
    self,
    tenant_id: int,
    start_date: str,
    end_date: str,
    cross_tenant: bool = False,
) -> tuple[Optional[dict], int]:
    params: dict = {"start_date": start_date, "end_date": end_date}
    if cross_tenant:
        params["cross_tenant"] = "true"
    return await self._request_with_status(
        "GET",
        "/api/v1/analytics/conversation_distribution",
        tenant_id,
        params=params,
        timeout=15.0,
    )
```

### `metrics.py` — método con TTLCache

```python
_distribution_cache: TTLCache = TTLCache(maxsize=100, ttl=900)  # 15 min

async def get_conversation_distribution(
    self,
    tenant_id: int | None,
    query: MetricsQuery,
    tz_name: str = "America/Lima",
    cross_tenant: bool = False,
) -> dict:
    start_utc, end_utc = metrics_repository._get_date_range(
        query.period, query.start_date, query.end_date, tz_name
    )
    cache_key = (tenant_id, str(start_utc), str(end_utc))
    if cache_key in _distribution_cache:
        logger.info(f"conversation_distribution_cache_hit: tenant_id={tenant_id}")
        return _distribution_cache[cache_key]

    effective_tenant_id = tenant_id or 1
    messaging_result, status_code = await messaging_service.get_conversation_distribution(
        tenant_id=effective_tenant_id,
        start_date=start_utc.isoformat(),
        end_date=end_utc.isoformat(),
        cross_tenant=cross_tenant,
    )

    # Manejo de errores idéntico a get_activity_by_hour:
    # status_code == 0   → RuntimeError("Messaging service unavailable")
    # status_code >= 500 → RuntimeError("Messaging service error (status ...)")
    # status_code not in (200, 201) → RuntimeError("Unexpected status ...")
    # payload sin "data" → RuntimeError("Invalid response ...")

    data = messaging_result["data"]
    result = {
        "distribution": data.get("distribution", []),
        "total_conversations": data.get("total_conversations", 0),
    }
    _distribution_cache[cache_key] = result
    return result
```

**Nota sobre el cache:** in-memory single-worker (el Dockerfile arranca `uvicorn` sin `--workers`). Consistente con el resto del dashboard, sin cambios de infraestructura. Si en el futuro se escala a múltiples workers/réplicas, migrar a Redis (ya disponible en el stack para Sidekiq).

### Schema Pydantic (`schemas/metrics.py`)

```python
from typing import Literal

class DistributionCategory(BaseModel):
    category: Literal["agent_ai", "human_support", "abandoned"]
    count: int
    percentage: float
    total_hours: float

class ConversationDistributionResponse(BaseModel):
    distribution: list[DistributionCategory]
    total_conversations: int
```

### Endpoint FastAPI (`api/v1/endpoints/metrics.py`)

```
GET /api/v1/metrics/conversation-distribution
```

**Query params:** `period`, `start_date`, `end_date`, `tenant_id` (solo SUPERADMIN)

**Lógica de acceso** (idéntica al heatmap):
```python
if current_user.role == SUPERADMIN:
    if request_tenant_id is not None:
        target_tenant, cross_tenant = request_tenant_id, False
    else:
        target_tenant, cross_tenant = None, True   # agrega todos los tenants
else:
    target_tenant, cross_tenant = current_user.tenant_id, False
```

**Permiso:** `require_permission_dual("GET", "/metrics/conversation-distribution")` (registrar en `app/core/permissions.py`).

---

## Frontend (Next.js)

### Next.js API Route

`app/api/metrics/conversation-distribution/route.ts` — proxy al FastAPI con el token Auth0, siguiendo el patrón de `app/api/metrics/activity-by-hour/route.ts`.

### Service function (`lib/services/metrics-service.ts`)

```typescript
export interface ConversationDistributionResponse {
  distribution: {
    category: "agent_ai" | "human_support" | "abandoned";
    count: number;
    percentage: number;
    total_hours: number;
  }[];
  total_conversations: number;
}

export async function getConversationDistribution(
  accessToken: string,
  startDate: string,
  endDate: string,
  tenantId?: number,
): Promise<ConversationDistributionResponse>
```

### Componente (`components/dashboard/conversation-distribution-widget.tsx`)

**Nota de ubicación:** se usa `components/dashboard/` (convención real del repo), NO la ruta `_components/` que sugería la tarea de ClickUp.

**Tipo:** Client Component. Recibe `data` como prop (igual que `AdsSummaryWidget`).

**Decisiones técnicas:**
- **Pie chart de recharts** dentro de `ChartContainer` + `ChartTooltip` + `ChartTooltipContent` de shadcn. El tema (claro/oscuro) se hereda vía CSS variables.
- **Colores:** tokens `--color-chart-1/2/3`.
- **Etiquetas (español):** `agent_ai` → "IA", `human_support` → "Humano", `abandoned` → "Abandonadas".
- **Tooltip:** `{categoría}: {count} conversaciones · {percentage}% · {total_hours}h`
- **Estado vacío:** si `total_conversations === 0` o `data` es `undefined` → "Sin conversaciones en el período seleccionado".
- **Selector de tenant (solo SUPERADMIN):** `Select` de shadcn en el header; por defecto "Todos los tenants" (cross-tenant); al cambiar, fetch independiente sin recargar el resto del dashboard. Idéntico al heatmap.

### Integración en el dashboard

- `app/dashboard/get-started/page.tsx` (server component): fetcha en paralelo con `Promise.all` junto a las demás métricas; si falla pasa `undefined` (widget muestra estado vacío).
- `app/dashboard/get-started/dashboard-client.tsx`: nueva prop `initialConversationDistribution?` y render del widget en un `motion.div` junto a los demás widgets. El filtro global Desde/Hasta lo actualiza automáticamente.

---

## Testing

### Rails (RSpec) — sigue `ads_summary_service_spec.rb`

`spec/services/analytics/distribution_service_spec.rb`:
- Conversación solo-IA (outgoing sin sender) → `agent_ai`
- Conversación con operador (`sender_type = User`) → `human_support`
- Conversación con echo coexistence (`external_echo`) → `human_support`
- Escalación IA→humano → `human_support` (precede a IA)
- Último saliente +24h sin respuesta del cliente → `abandoned` (precede a humano e IA)
- Último saliente <24h → clasifica por handler (no abandonada aún)
- Último mensaje entrante (cliente esperando respuesta) → NO abandonada
- Conversación de campaña (`campaign_id` presente) → **excluida** del resultado
- Cálculo correcto de `percentage` y `total_hours`
- Resultado vacío cuando no hay conversaciones en el rango

`spec/requests/api/v1/analytics/conversation_distribution_spec.rb`:
- Endpoint responde 200 con la estructura esperada
- Respeta el rango de fechas
- `cross_tenant=true` agrega todos los tenants
- Fechas inválidas → 400

### Backend Python (pytest) — sigue `test_metrics_ads_summary.py`

`tests/unit/services/test_metrics_distribution.py`:
- Mock de `messaging_service`, verifica cache hit/miss
- Manejo de errores (status 0 / 500 / status inesperado / payload sin `data`)
- Lógica SUPERADMIN cross-tenant vs ADMIN tenant propio

### Frontend

Verificación manual en el browser (golden path + estado vacío + dark mode), según la guía de UI del CLAUDE.md. No se agregan e2e — los Playwright existentes son solo para búsqueda de mensajes.

---

## Archivos a crear / modificar

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `apps/messaging/app/services/analytics/distribution_service.rb` | Service object de clasificación |
| `apps/messaging/spec/services/analytics/distribution_service_spec.rb` | Specs del service |
| `apps/messaging/spec/requests/api/v1/analytics/conversation_distribution_spec.rb` | Specs del endpoint |
| `apps/backend/tests/unit/services/test_metrics_distribution.py` | Tests del metrics service |
| `apps/frontend/app/api/metrics/conversation-distribution/route.ts` | API Route Next.js |
| `apps/frontend/components/dashboard/conversation-distribution-widget.tsx` | Widget pie chart |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb` | Nuevo action `conversation_distribution` |
| `apps/messaging/config/routes.rb` | Nueva ruta GET |
| `apps/backend/app/services/messaging_service.py` | Nuevo método proxy |
| `apps/backend/app/services/metrics.py` | Nuevo método + TTLCache |
| `apps/backend/app/schemas/metrics.py` | Schemas `DistributionCategory` + `ConversationDistributionResponse` |
| `apps/backend/app/api/v1/endpoints/metrics.py` | Nuevo endpoint |
| `apps/backend/app/core/permissions.py` | Nuevo permiso |
| `apps/frontend/lib/services/metrics-service.ts` | Nueva función + tipo |
| `apps/frontend/app/dashboard/get-started/page.tsx` | Fetch paralelo + prop |
| `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` | Integrar widget |

---

## Edge cases y notas abiertas

1. **Campañas:** resuelto — las conversaciones de campaña (`campaign_id IS NOT NULL`) se **excluyen** de la métrica (ver Backend Rails). Son marketing outbound, no atención a conversaciones.
2. **Automatización (limitación conocida):** los mensajes generados por `automation/action_service.rb` (`send_message`) son `outgoing` sin `sender_id` y **sin ningún marcador** que los distinga de la IA. Por lo tanto, una conversación cuyo único saliente fue una respuesta automática se clasificaría como **IA**. No es distinguible con los datos actuales (requeriría un marcador nuevo en `additional_attributes` → cambio de schema, fuera de alcance). Impacto acotado: suele absorberlo la regla de abandono (auto-respuesta + 24h sin cliente → `abandoned`) o se sobreescribe cuando un humano/IA real toma la conversación. Se documenta como limitación; revisar si el volumen de automatización crece.
3. **Conversaciones sin ningún mensaje** (solo creadas): `last` es `nil` → no abandonada, no humana → caen en `agent_ai`. Volumen esperado mínimo; aceptable.
4. **Duración negativa o cero:** si `last_activity_at < created_at` por algún dato inconsistente, la duración podría ser negativa. Considerar `[duration, 0].max` al sumar horas.

---

## Acceptance Criteria

- [ ] `GET /api/v1/metrics/conversation-distribution` retorna las 3 categorías con `count`, `percentage` y `total_hours`
- [ ] Categorías: `agent_ai`, `human_support`, `abandoned` (sin respuesta del cliente en 24h)
- [ ] Agregación basada en `Message.sender_type` + último mensaje, set-based (sin N+1)
- [ ] Precedencia correcta: `abandoned` → `human_support` → `agent_ai`
- [ ] Conversaciones de campaña (`campaign_id`) excluidas de la métrica
- [ ] Widget pie chart (recharts) visible en el dashboard
- [ ] Tooltip muestra % + count absoluto + horas totales
- [ ] Cache de 15 min en FastAPI (TTLCache)
- [ ] El filtro global Desde/Hasta del dashboard actualiza el widget
- [ ] SUPERADMIN ve datos cross-tenant por defecto con selector de tenant; ADMIN solo su propio tenant
- [ ] Estado vacío cuando `total_conversations === 0`
- [ ] El widget hereda el tema claro/oscuro sin lógica propia
