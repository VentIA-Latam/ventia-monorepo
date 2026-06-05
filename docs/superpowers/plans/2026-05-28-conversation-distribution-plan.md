# Plan: Métrica de Distribución de Conversaciones por Tipo (IA / Humano / Abandonadas)

**Fecha:** 2026-05-28
**Branch sugerido:** `feat/dashboard-conversation-distribution`
**Spec:** `docs/superpowers/specs/2026-05-28-conversation-distribution-design.md`
**Tarea ClickUp:** [86ahfb4wd](https://app.clickup.com/t/86ahfb4wd)
**Status:** Listo para ejecutar

## Resumen

Implementación por capas en este orden:

1. **Rails**: service `DistributionService` + action + ruta + specs.
2. **Backend FastAPI**: schemas → cliente HTTP → service (con TTLCache) → endpoint → permisos → tests.
3. **Frontend**: tipos + fetcher → ruta API Next.js → widget → integración al dashboard.
4. **Smoke test e2e** con datos reales.

Cada paso es funcional por sí solo (compila/lint/test). El paso 2 depende del 1; el paso 3 depende del 2. Patrón idéntico al heatmap de actividad (`2026-05-26-activity-heatmap-design.md`).

**Clasificación (precedencia):** `abandoned` → `human_support` → `agent_ai`. Conversaciones de campaña (`campaign_id IS NOT NULL`) se excluyen.

---

## Capa 1 — Rails (apps/messaging/)

### Paso 1.1 — Service `Analytics::DistributionService`

**Archivo nuevo:** `apps/messaging/app/services/analytics/distribution_service.rb`

```ruby
module Analytics
  class DistributionService
    HUMAN_SQL = "sender_type = 'User' OR content_attributes->>'external_echo' IS NOT NULL".freeze
    ABANDON_THRESHOLD = 24.hours
    CATEGORIES = %i[agent_ai human_support abandoned].freeze

    def initialize(scope:, start_date:, end_date:, now: Time.current)
      @scope = scope            # current_account.conversations o Conversation (cross_tenant)
      @start_date = start_date
      @end_date = end_date
      @now = now
    end

    def perform
      # Query 1 — base: ids + timestamps para duración. Excluye campañas.
      convs = @scope.created_in_range(@start_date, @end_date)
                    .where(campaign_id: nil)
                    .pluck(:id, :created_at, :last_activity_at)
      conv_ids = convs.map(&:first)
      return empty_result if conv_ids.empty?

      # Query 2 — conversaciones con CUALQUIER mensaje humano
      human_ids = Message.where(conversation_id: conv_ids)
                         .where(message_type: %i[outgoing template])
                         .where(HUMAN_SQL)
                         .distinct.pluck(:conversation_id).to_set

      # Query 3 — último mensaje real por conversación (ignora 'activity')
      last_by_conv = Message.where(conversation_id: conv_ids)
                            .where.not(message_type: :activity)
                            .select('DISTINCT ON (conversation_id) conversation_id, message_type, created_at')
                            .order('conversation_id, created_at DESC')
                            .index_by(&:conversation_id)

      buckets = { agent_ai: [], human_support: [], abandoned: [] }
      convs.each do |id, created_at, last_activity_at|
        category = classify(id, last_by_conv[id], human_ids)
        duration = [(last_activity_at - created_at), 0].max  # segundos, nunca negativo
        buckets[category] << duration
      end

      build_result(buckets, conv_ids.size)
    end

    private

    def classify(id, last, human_ids)
      if abandoned?(last)
        :abandoned
      elsif human_ids.include?(id)
        :human_support
      else
        :agent_ai
      end
    end

    def abandoned?(last)
      return false if last.nil?
      outgoing = %w[outgoing template].include?(last.message_type)
      outgoing && (@now - last.created_at) > ABANDON_THRESHOLD
    end

    def build_result(buckets, total)
      distribution = CATEGORIES.map do |cat|
        durations = buckets[cat]
        count = durations.size
        {
          category: cat,
          count: count,
          percentage: total.positive? ? (count.to_f / total * 100).round(1) : 0.0,
          total_hours: (durations.sum / 3600.0).round(1)
        }
      end
      { distribution: distribution, total_conversations: total }
    end

    def empty_result
      distribution = CATEGORIES.map do |cat|
        { category: cat, count: 0, percentage: 0.0, total_hours: 0.0 }
      end
      { distribution: distribution, total_conversations: 0 }
    end
  end
end
```

**Criterio de éxito:** archivo cargado sin error en consola Rails (`rails c` → `Analytics::DistributionService`).

---

### Paso 1.2 — Action en controller existente

**Archivo:** `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb`

Agregar action siguiendo el patrón de `activity_by_hour` (mismo manejo de `parse_date_range` y `cross_tenant`):

```ruby
def conversation_distribution
  start_date, end_date = parse_date_range
  return if performed?

  # cross_tenant solo es enviado por el backend Python tras verificar rol SUPERADMIN
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

**Criterio de éxito:** linting Rubocop pasa (`bundle exec rubocop app/controllers/api/v1/analytics/conversations_controller.rb`).

---

### Paso 1.3 — Ruta nueva

**Archivo:** `apps/messaging/config/routes.rb`

Dentro del `namespace :analytics` existente (junto a `activity_by_hour`):

```ruby
get 'conversation_distribution', to: 'conversations#conversation_distribution'
```

**Criterio de éxito:** `bundle exec rails routes | grep conversation_distribution` muestra `GET /api/v1/analytics/conversation_distribution`.

---

### Paso 1.4 — Spec del service

**Archivo nuevo:** `apps/messaging/spec/services/analytics/distribution_service_spec.rb`

```ruby
require 'rails_helper'

RSpec.describe Analytics::DistributionService do
  let(:account) { create(:account) }
  let(:inbox) { create(:inbox, account: account) }
  let(:contact) { create(:contact, account: account) }
  let(:user) { create(:user, account: account) }
  let(:start_date) { 30.days.ago }
  let(:end_date) { Time.current }
  let(:now) { Time.current }

  def conv(attrs = {})
    create(:conversation, { account: account, inbox: inbox, contact: contact }.merge(attrs))
  end

  # Mensaje de IA: outgoing sin sender, sin external_echo
  def ai_msg(conversation, at: 1.hour.ago)
    create(:message, account: account, inbox: inbox, conversation: conversation,
                     message_type: :outgoing, sender: nil, created_at: at)
  end

  # Mensaje de operador humano (app): sender = User
  def human_msg(conversation, at: 1.hour.ago)
    create(:message, account: account, inbox: inbox, conversation: conversation,
                     message_type: :outgoing, sender: user, created_at: at)
  end

  # Mensaje de humano vía WhatsApp móvil (coexistence): outgoing sin sender + external_echo
  def echo_msg(conversation, at: 1.hour.ago)
    create(:message, account: account, inbox: inbox, conversation: conversation,
                     message_type: :outgoing, sender: nil,
                     content_attributes: { 'external_echo' => true }, created_at: at)
  end

  # Mensaje entrante del cliente
  def customer_msg(conversation, at: 1.hour.ago)
    create(:message, account: account, inbox: inbox, conversation: conversation,
                     message_type: :incoming, sender: contact, created_at: at)
  end

  def run
    described_class.new(scope: account.conversations, start_date: start_date,
                        end_date: end_date, now: now).perform
  end

  def bucket(result, category)
    result[:distribution].find { |d| d[:category] == category }
  end

  describe '#perform — clasificación' do
    it 'clasifica conversación solo-IA como agent_ai' do
      c = conv
      customer_msg(c, at: 3.hours.ago)
      ai_msg(c, at: 2.hours.ago)            # último saliente reciente (<24h) → no abandonada
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
    end

    it 'clasifica conversación con operador (sender User) como human_support' do
      c = conv
      ai_msg(c, at: 3.hours.ago)
      human_msg(c, at: 2.hours.ago)
      expect(bucket(run, :human_support)[:count]).to eq(1)
    end

    it 'clasifica echo de WhatsApp móvil (external_echo) como human_support' do
      c = conv
      echo_msg(c, at: 2.hours.ago)
      expect(bucket(run, :human_support)[:count]).to eq(1)
    end

    it 'humano precede a IA en escalación' do
      c = conv
      ai_msg(c, at: 3.hours.ago)
      human_msg(c, at: 2.hours.ago)
      customer_msg(c, at: 1.hour.ago)       # último es incoming → no abandonada
      expect(bucket(run, :human_support)[:count]).to eq(1)
      expect(bucket(run, :agent_ai)[:count]).to eq(0)
    end
  end

  describe '#perform — abandono' do
    it 'marca abandoned cuando el último saliente tiene +24h sin respuesta del cliente' do
      c = conv
      customer_msg(c, at: 3.days.ago)
      ai_msg(c, at: 2.days.ago)             # último saliente, +24h
      expect(bucket(run, :abandoned)[:count]).to eq(1)
    end

    it 'abandono precede a humano' do
      c = conv
      human_msg(c, at: 2.days.ago)          # humano participó pero último saliente +24h
      expect(bucket(run, :abandoned)[:count]).to eq(1)
      expect(bucket(run, :human_support)[:count]).to eq(0)
    end

    it 'NO marca abandoned si el último saliente es <24h' do
      c = conv
      ai_msg(c, at: 2.hours.ago)
      expect(bucket(run, :abandoned)[:count]).to eq(0)
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
    end

    it 'NO marca abandoned si el último mensaje es del cliente (entrante)' do
      c = conv
      ai_msg(c, at: 3.days.ago)
      customer_msg(c, at: 2.days.ago)       # cliente respondió último → no abandonada
      expect(bucket(run, :abandoned)[:count]).to eq(0)
    end
  end

  describe '#perform — exclusiones y agregados' do
    it 'excluye conversaciones de campaña' do
      campaign = create(:campaign, account: account, inbox: inbox)
      c = conv(campaign: campaign)
      ai_msg(c, at: 2.hours.ago)
      expect(run[:total_conversations]).to eq(0)
    end

    it 'calcula percentage y total_hours' do
      c1 = conv(created_at: 4.hours.ago, last_activity_at: 2.hours.ago)  # 2h, agent_ai
      ai_msg(c1, at: 2.hours.ago)
      c2 = conv(created_at: 5.hours.ago, last_activity_at: 1.hour.ago)   # 4h, human
      human_msg(c2, at: 1.hour.ago)

      result = run
      expect(result[:total_conversations]).to eq(2)
      expect(bucket(result, :agent_ai)[:percentage]).to eq(50.0)
      expect(bucket(result, :agent_ai)[:total_hours]).to eq(2.0)
      expect(bucket(result, :human_support)[:total_hours]).to eq(4.0)
    end

    it 'devuelve resultado vacío sin conversaciones en el rango' do
      result = run
      expect(result[:total_conversations]).to eq(0)
      expect(result[:distribution].size).to eq(3)
      expect(result[:distribution].map { |d| d[:count] }).to all(eq(0))
    end
  end
end
```

**Nota:** verificar los factories existentes (`spec/factories/`) para `conversation`, `message`, `campaign`, `user`. Adaptar nombres de atributos (`sender`, `content_attributes`) al factory real. Confirmar que el factory de `message` permite `created_at` y `sender: nil`.

**Criterio de éxito:** `cd apps/messaging && bundle exec rspec spec/services/analytics/distribution_service_spec.rb` pasa.

---

### Paso 1.5 — Spec del endpoint

**Archivo nuevo:** `apps/messaging/spec/requests/api/v1/analytics/conversation_distribution_spec.rb`

Seguir el patrón de `spec/requests/api/v1/analytics/no_purchase_reasons_spec.rb`:
- 200 con la estructura `{ success: true, data: { distribution: [...], total_conversations: N } }`
- Respeta `start_date` / `end_date`
- `cross_tenant=true` agrega conversaciones de todos los tenants
- Fechas inválidas → 400

**Criterio de éxito:** `bundle exec rspec spec/requests/api/v1/analytics/conversation_distribution_spec.rb` pasa.

---

## Capa 2 — Backend FastAPI (apps/backend/)

### Paso 2.1 — Schemas Pydantic

**Archivo:** `apps/backend/app/schemas/metrics.py`

Agregar al final del archivo (importar `Literal` desde `typing` si no está):

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

**Criterio de éxito:** `cd apps/backend && uv run ruff check app/schemas/metrics.py` pasa.

---

### Paso 2.2 — Cliente HTTP en `messaging_service`

**Archivo:** `apps/backend/app/services/messaging_service.py`

Agregar método siguiendo el patrón exacto de `get_activity_by_hour` (líneas 751-772):

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

**Criterio de éxito:** `uv run ruff check app/services/messaging_service.py` pasa.

---

### Paso 2.3 — Método en `metrics_service` (con TTLCache)

**Archivo:** `apps/backend/app/services/metrics.py`

A nivel de módulo (junto a `_activity_cache`, línea 25):

```python
_distribution_cache: TTLCache = TTLCache(maxsize=100, ttl=900)  # 15 min
```

Método nuevo siguiendo el patrón exacto de `get_activity_by_hour` (líneas 343-414), incluido el mismo manejo de errores:

```python
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

    if status_code == 0:
        logger.error(f"conversation_distribution_messaging_unavailable: tenant_id={tenant_id}")
        raise RuntimeError("Messaging service unavailable")
    if status_code >= 500:
        logger.error(f"conversation_distribution_messaging_error: tenant_id={tenant_id} status={status_code}")
        raise RuntimeError(f"Messaging service error (status {status_code})")
    if status_code not in (200, 201):
        logger.error(f"conversation_distribution_unexpected_status: tenant_id={tenant_id} status={status_code}")
        raise RuntimeError(f"Unexpected status from messaging service: {status_code}")
    if not messaging_result or "data" not in messaging_result:
        logger.error(f"conversation_distribution_invalid_response: tenant_id={tenant_id}")
        raise RuntimeError("Invalid response from messaging service")

    data = messaging_result["data"]
    result = {
        "distribution": data.get("distribution", []),
        "total_conversations": data.get("total_conversations", 0),
    }
    _distribution_cache[cache_key] = result
    logger.info(
        f"conversation_distribution_computed: tenant_id={tenant_id} "
        f"total={result['total_conversations']}"
    )
    return result
```

**Criterio de éxito:** `uv run ruff check app/services/metrics.py` pasa.

---

### Paso 2.4 — Endpoint

**Archivo:** `apps/backend/app/api/v1/endpoints/metrics.py`

Agregar endpoint siguiendo el patrón de `get_activity_by_hour` (líneas 290-321), con la misma lógica SUPERADMIN/cross-tenant:

```python
@router.get("/conversation-distribution", response_model=ConversationDistributionResponse)
async def get_conversation_distribution(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    tenant_id: int | None = Query(None),
    current_user: User = Depends(
        require_permission_dual("GET", "/metrics/conversation-distribution")
    ),
    db: Session = Depends(get_database),
) -> ConversationDistributionResponse:
    if current_user.role == UserRole.SUPERADMIN:
        if tenant_id is not None:
            target_tenant, cross_tenant = tenant_id, False
        else:
            target_tenant, cross_tenant = None, True
    else:
        target_tenant, cross_tenant = current_user.tenant_id, False

    query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
    tz_name = _get_tenant_timezone(db, target_tenant) if target_tenant else "America/Lima"
    result = await metrics_service.get_conversation_distribution(
        tenant_id=target_tenant,
        query=query,
        tz_name=tz_name,
        cross_tenant=cross_tenant,
    )
    return ConversationDistributionResponse(**result)
```

**Nota:** alinear nombres exactos (`UserRole.SUPERADMIN`, `_get_tenant_timezone`, `PeriodType`) con lo que ya usa `get_activity_by_hour` en este archivo. Importar `ConversationDistributionResponse`.

**Criterio de éxito:** `uv run uvicorn app.main:app --reload` arranca sin errores y `GET /docs` muestra el nuevo endpoint.

---

### Paso 2.5 — Permisos

**Archivo:** `apps/backend/app/core/permissions.py`

Buscar la entrada de `/metrics/activity-by-hour` y agregar `/metrics/conversation-distribution` con los mismos roles permitidos (`SUPERADMIN`, `ADMIN`, `VENTAS` — confirmar contra el heatmap).

**Criterio de éxito:** la matriz de permisos incluye el nuevo endpoint; el test del paso 2.6 cubre `VIEWER → 403`.

---

### Paso 2.6 — Tests backend

**Archivo nuevo:** `apps/backend/tests/unit/services/test_metrics_distribution.py`

Seguir el patrón de `tests/unit/services/test_metrics_ads_summary.py`:
- `test_distribution_cache_hit_skips_messaging`: segunda llamada con misma key no vuelve a llamar a `messaging_service`
- `test_distribution_unavailable_raises`: `status_code == 0` → `RuntimeError`
- `test_distribution_server_error_raises`: `status_code >= 500` → `RuntimeError`
- `test_distribution_invalid_response_raises`: payload sin `data` → `RuntimeError`
- `test_distribution_superadmin_cross_tenant`: SUPERADMIN sin `tenant_id` → `cross_tenant=True`
- `test_distribution_admin_uses_own_tenant`: ADMIN → `tenant_id` del JWT, `cross_tenant=False`

**Criterio de éxito:**
- `cd apps/backend && uv run pytest tests/unit/services/test_metrics_distribution.py -v` pasa.
- `uv run pytest` (suite completa) no rompe nada existente.

---

## Capa 3 — Frontend (apps/frontend/)

### Paso 3.1 — Tipos y fetcher

**Archivo:** `apps/frontend/lib/services/metrics-service.ts`

Agregar al final (siguiendo el patrón de `fetchActivityByHour`, líneas 354-403):

```ts
// --- Conversation Distribution ---

export type DistributionCategoryKey = "agent_ai" | "human_support" | "abandoned";

export interface DistributionCategory {
  category: DistributionCategoryKey;
  count: number;
  percentage: number;
  total_hours: number;
}

export interface ConversationDistributionResponse {
  distribution: DistributionCategory[];
  total_conversations: number;
}

export async function fetchConversationDistribution(
  accessToken: string,
  query?: MetricsQuery,
  tenantId?: number,
): Promise<ConversationDistributionResponse> {
  const params = new URLSearchParams();
  if (query?.period) params.append('period', query.period);
  if (query?.start_date && query.period === 'custom') params.append('start_date', query.start_date);
  if (query?.end_date && query.period === 'custom') params.append('end_date', query.end_date);
  if (tenantId !== undefined) params.append('tenant_id', tenantId.toString());

  const url = `${API_URL}/metrics/conversation-distribution${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch conversation distribution' }));
    throw new Error(error.detail || 'Failed to fetch conversation distribution');
  }
  return response.json();
}
```

**Criterio de éxito:** `cd apps/frontend && pnpm tsc --noEmit` y `pnpm lint` pasan.

---

### Paso 3.2 — Ruta API Next.js (para el selector de tenant client-side)

**Archivo nuevo:** `apps/frontend/app/api/metrics/conversation-distribution/route.ts`

Copiar exactamente `app/api/metrics/activity-by-hour/route.ts`, cambiando solo la URL del fetch a `/metrics/conversation-distribution` y los mensajes de error.

**Criterio de éxito:** `pnpm tsc --noEmit` pasa; `GET /api/metrics/conversation-distribution` responde con token válido.

---

### Paso 3.3 — Widget `conversation-distribution-widget.tsx`

**Archivo nuevo:** `apps/frontend/components/dashboard/conversation-distribution-widget.tsx`

Client Component que recibe `data` como prop. Estructura:
- `Card` + `CardHeader` (título "Distribución de conversaciones" + selector de tenant SUPERADMIN) + `CardContent`.
- Pie chart de **recharts** (`PieChart` + `Pie` + `Cell`) dentro de `ChartContainer` de shadcn. Tres celdas con `--color-chart-1/2/3`.
- `ChartTooltip` + `ChartTooltipContent` custom: `{label}: {count} conversaciones · {percentage}% · {total_hours}h`.
- Mapa de etiquetas: `{ agent_ai: "IA", human_support: "Humano", abandoned: "Abandonadas" }`.
- Estado vacío: si `data?.total_conversations` es `0` o `undefined` → mensaje "Sin conversaciones en el período seleccionado".
- Selector de tenant (solo SUPERADMIN): replicar el del `activity-heatmap-widget.tsx` — al cambiar, `fetch('/api/metrics/conversation-distribution?tenant_id=...')` client-side y actualizar estado local.

**Referencia de implementación:** copiar la estructura de `components/dashboard/activity-heatmap-widget.tsx` (selector de tenant, estados, ChartContainer) y adaptar el cuerpo a un pie chart.

**Criterio de éxito:** `pnpm tsc --noEmit` y `pnpm lint` pasan.

---

### Paso 3.4 — Integración al dashboard

**Archivos:**
- `apps/frontend/app/dashboard/get-started/page.tsx` (server component, fetch)
- `apps/frontend/app/dashboard/get-started/dashboard-client.tsx` (client component, render)

**`page.tsx`:** sumar `fetchConversationDistribution(accessToken, query)` al `Promise.all`/`Promise.allSettled` existente (junto al fetch del heatmap). Pasar el resultado (o `undefined` si falla) como prop `initialConversationDistribution`.

**`dashboard-client.tsx`:**
```tsx
import { ConversationDistributionWidget } from "@/components/dashboard/conversation-distribution-widget";

// nueva prop en DashboardClientProps:
initialConversationDistribution?: ConversationDistributionResponse;

// en el JSX, en un motion.div junto a los otros widgets:
<motion.div variants={fadeUp}>
  <ConversationDistributionWidget
    data={initialConversationDistribution}
    isSuperAdmin={isSuperAdmin}
  />
</motion.div>
```

**Criterio de éxito:** `pnpm tsc --noEmit`, `pnpm lint` y `pnpm build` completan sin errores.

---

## Capa 4 — Smoke test e2e

### Paso 4.1 — Verificación con datos reales

Con servicios corriendo (`pnpm docker:up` o `pnpm dev`):

1. Sembrar/identificar conversaciones de prueba que cubran los 3 buckets:
   - Una solo con mensajes IA recientes (outgoing sin sender, <24h) → IA
   - Una con un mensaje de operador (sender User) → Humano
   - Una con último saliente +24h sin respuesta del cliente → Abandonada
   - (Opcional) Una de campaña (`campaign_id` presente) → debe NO aparecer
2. Loguear al dashboard como ADMIN del tenant.
3. Verificar que el pie chart renderiza las 3 categorías con counts correctos y el tooltip muestra % + count + horas.
4. Cambiar el filtro global Desde/Hasta y verificar que el widget se actualiza.
5. Verificar estado vacío con un rango sin datos.
6. Como SUPERADMIN: verificar el selector de tenant (default "Todos los tenants" = cross-tenant) y que al elegir un tenant el widget se actualiza sin recargar el resto.
7. Verificar dark mode (toggle de tema).

**Criterio de éxito:** widget correcto en navegador (Chrome), sin errores en consola.

---

## Checklist final

- [ ] Capa 1 (Rails) PR creado y aprobado
- [ ] Capa 2 (Backend) PR creado y aprobado
- [ ] Capa 3 (Frontend) PR creado y aprobado
- [ ] Smoke test e2e pasado
- [ ] Tarea ClickUp "Métrica: Distribución por tipo (IA / Humano / Abandonadas)" movida a Done
