# Resumen de Conversaciones por Anuncio (Ads Summary Dashboard)

**Fecha:** 2026-05-22
**Autor:** Equipo VentIA
**Estado:** Aprobado por usuario, pendiente plan de implementación
**Tarea ClickUp:** Resumido de conversaciones x anuncio en dashboard (Sprint sem3-mayo-2026)

## Objetivo

Widget en el dashboard que muestra conversaciones agrupadas por anuncio de origen (ad_id de Meta) para medir performance de campañas publicitarias click-to-WhatsApp. Cada fila representa un anuncio único e incluye número de conversaciones iniciadas, número de conversaciones convertidas en orden validada, y tasa de conversión.

## Contexto del descubrimiento

Durante el brainstorming se identificó que:

1. **El dato ya se persiste**. Cuando un usuario hace click en un anuncio click-to-WhatsApp de Meta, el primer mensaje al webhook llega con un objeto `referral` que Rails guarda en `messages.content_attributes`:
   ```json
   {
     "referral": {
       "source_id": "120243814566250320",
       "headline": "Tu descanso no espera...",
       "image_url": "https://scontent.xx.fbcdn.net/...",
       "source_url": "https://fb.me/60cKU7Xn2",
       "source_type": "ad",
       "media_type": "image",
       "body": "..."
     }
   }
   ```
   No requiere modificar el webhook ni el schema. Sólo agregar lectura/agregación.

2. **El cruce ad ↔ orden es indirecto**, a través de `conversation_id`:
   - Rails sabe `ad_id → conversation_ids` (vía `messages.content_attributes`).
   - FastAPI sabe `conversation_id → orden validada` (vía `orders.messaging_conversation_id` y `orders.validado`).
   - Las BDs son separadas; no hay JOIN SQL posible. El join lógico se hace en código.

3. **Patrón ya existente**: `/metrics/conversion-rate` y `/metrics/no-purchase-reasons` muestran cómo combinar datos de Rails con datos locales de FastAPI a través del cliente `messaging_service`.

## Decisiones de UX (aprobadas)

| Decisión | Elegido |
|---|---|
| Identidad del ad en la tabla | Miniatura + headline |
| Anchor temporal — "iniciada" | Fecha del mensaje con referral (`messages.created_at` en rango) |
| Anchor temporal — "convertida" | Fecha de validación de orden (`orders.validated_at` en el **mismo rango**) |
| Interactividad | Sólo lectura (sin drill-down en MVP) |

**Implicancia explícita**: una conversación que inicia al final del rango y cuya orden se valida después del rango cuenta como "iniciada" pero **no** como "convertida". Es el mismo criterio que usa `/metrics/conversion-rate` hoy, garantizando comparabilidad entre métricas. Trade-off conocido: subreporte de conversiones lentas, pero estabilidad temporal (la métrica de un mes no cambia retroactivamente).

## Arquitectura

Patrón híbrido idéntico al de `conversion-rate`, con dirección de payload optimizada para minimizar bytes en el wire:

```
Frontend ── GET /metrics/ads-summary ──► Backend FastAPI
                                              │
                              1) Consulta BD local: orders validadas en rango
                                 → converted_conversation_ids[] (subset chico)
                                              │
                              2) POST /api/v1/analytics/ads_summary ──► Rails
                                 Body: { start, end, converted_conversation_ids[] }
                                              │
                                 Rails ejecuta UNA query SQL agregada por ad,
                                 usando COUNT(...) FILTER (WHERE conv_id = ANY($4))
                                              │
                              3) Rails responde [{ad_id, headline, image_url,
                                                  source_url, started, converted}]
                                                  (proporcional a # ads, ~50 filas)
                                              │
                              4) FastAPI calcula conversion_rate y serializa al schema
                                 público
                                              │
                                              ▼
                                       Response al frontend
```

### Razón de esta dirección

Se evaluaron dos alternativas:

- **Opción A**: Rails devuelve `conversation_ids[]` por ad; FastAPI cruza en memoria.
  - Payload Rails→FastAPI escala con `# conversations` (puede ser miles).
  - Requiere cap de rango (ej. 90 días) para no degradar performance.

- **Opción C (elegida)**: FastAPI envía `converted_conversation_ids[]` en POST; Rails hace la agregación final con `FILTER`.
  - Payload Rails→FastAPI siempre proporcional a `# ads` (~50 filas).
  - Payload FastAPI→Rails proporcional a `# orders validadas` (subset menor que `# conversations`).
  - Permite rangos amplios (12 meses) sin cap.
  - Aggregación nativa en Postgres con `COUNT(...) FILTER (...)` (un solo escaneo).

La complejidad extra (POST en lugar de GET) es mínima y se compensa con escalabilidad y UX sin caps.

## Contratos de API

### Frontend → FastAPI

```http
GET /api/v1/metrics/ads-summary?period=last_30_days
GET /api/v1/metrics/ads-summary?period=custom&start_date=2026-04-01&end_date=2026-04-30
Authorization: Bearer <jwt>
```

Reutiliza el modelo `MetricsQuery` ya existente en el backend:
- `period`: `today | yesterday | last_7_days | last_30_days | custom`
- `start_date` / `end_date`: requeridos si `period=custom`
- Tenant inferido del JWT
- Período default: `last_30_days`

**Response 200:**
```json
{
  "ads": [
    {
      "ad_id": "120243814566250320",
      "headline": "Tu descanso no espera. Hacemos envíos todos los días.",
      "image_url": "https://scontent.xx.fbcdn.net/...",
      "source_url": "https://fb.me/60cKU7Xn2",
      "conversations_started": 5,
      "conversations_converted": 3,
      "conversion_rate": 60.0
    }
  ],
  "total_ads": 1,
  "period": { "start_date": "2026-04-01", "end_date": "2026-04-30" }
}
```

**Response 200, vacío:**
```json
{ "ads": [], "total_ads": 0, "period": {...} }
```

El frontend dispara el empty state "Conecta Meta Ads" cuando `total_ads === 0`.

### FastAPI → Rails (interno)

```http
POST /api/v1/analytics/ads_summary
Authorization: Bearer <internal-token>   # mismo token que conversion-rate/no-purchase-reasons (resuelto por _request_with_status)
Content-Type: application/json

{
  "start_date": "2026-04-01T00:00:00-05:00",
  "end_date":   "2026-04-30T23:59:59-05:00",
  "converted_conversation_ids": [205, 312, 511, ...]
}
```

**Response Rails 200:**
```json
{
  "success": true,
  "data": {
    "ads": [
      {
        "ad_id": "120243814566250320",
        "headline": "Tu descanso no espera...",
        "image_url": "https://scontent.xx.fbcdn.net/...",
        "source_url": "https://fb.me/60cKU7Xn2",
        "started": 5,
        "converted": 3
      }
    ]
  }
}
```

## Edge cases

| Caso | Comportamiento |
|---|---|
| `converted_conversation_ids` vacío | Rails ejecuta query con `ANY('{}')` → todos los ads salen con `converted=0`. Funciona naturalmente. |
| Sin mensajes con referral en el rango | Rails responde `{"data": {"ads": []}}`. FastAPI propaga vacío al frontend. |
| `headline` o `image_url` son `null` | Devolver `null`. Frontend muestra placeholder "Anuncio sin título" + ícono genérico. |
| URL de imagen caducada (URLs de FB CDN expiran ~24h) | Frontend usa `<img onError>` → cae a placeholder visual. La fila no falla. |
| Mismo `ad_id` con headlines/creatividades distintas | Rails agrupa por `ad_id` y selecciona el referral más reciente vía `DISTINCT ON ... ORDER BY created_at DESC`. Evita filas duplicadas. |
| Rails timeout / 5xx | FastAPI propaga 502/504 con mensaje "Servicio de mensajería no disponible". Sin fallback de datos parciales. |

## Implementación por capa

### 1) Rails (apps/messaging/)

**Ruta nueva** en `apps/messaging/config/routes.rb` (dentro del namespace `analytics` existente):

```ruby
namespace :analytics do
  # ... existentes
  post 'ads_summary', to: 'conversations#ads_summary'
end
```

**Action nueva** en `app/controllers/api/v1/analytics/conversations_controller.rb`:

```ruby
def ads_summary
  start_date = params[:start_date]
  end_date = params[:end_date]
  converted_ids = Array(params[:converted_conversation_ids]).map(&:to_i)

  ads = Analytics::AdsSummaryService.new(
    account: current_account,
    start_date: start_date,
    end_date: end_date,
    converted_conversation_ids: converted_ids,
  ).perform

  render json: { success: true, data: { ads: ads } }
end
```

**Service nuevo** en `app/services/analytics/ads_summary_service.rb`:

```ruby
class Analytics::AdsSummaryService
  def initialize(account:, start_date:, end_date:, converted_conversation_ids:)
    @account = account
    @start_date = start_date
    @end_date = end_date
    @converted_ids = converted_conversation_ids
  end

  def perform
    rows = ActiveRecord::Base.connection.exec_query(
      query_sql,
      'ads_summary',
      binds,
    )
    rows.map { |r| format_row(r) }
  end

  private

  def query_sql
    <<~SQL
      WITH latest_referral AS (
        SELECT DISTINCT ON (content_attributes->'referral'->>'source_id')
          content_attributes->'referral'->>'source_id'  AS ad_id,
          content_attributes->'referral'->>'headline'   AS headline,
          content_attributes->'referral'->>'image_url'  AS image_url,
          content_attributes->'referral'->>'source_url' AS source_url
        FROM messages
        WHERE account_id = $1
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN $2 AND $3
        ORDER BY content_attributes->'referral'->>'source_id', created_at DESC
      ),
      ad_conversations AS (
        SELECT
          content_attributes->'referral'->>'source_id' AS ad_id,
          conversation_id
        FROM messages
        WHERE account_id = $1
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN $2 AND $3
      )
      SELECT
        lr.ad_id, lr.headline, lr.image_url, lr.source_url,
        COUNT(DISTINCT ac.conversation_id) AS started,
        COUNT(DISTINCT ac.conversation_id)
          FILTER (WHERE ac.conversation_id = ANY($4)) AS converted
      FROM latest_referral lr
      JOIN ad_conversations ac USING (ad_id)
      GROUP BY lr.ad_id, lr.headline, lr.image_url, lr.source_url
      ORDER BY started DESC;
    SQL
  end

  def binds
    [@account.id, @start_date, @end_date, "{#{@converted_ids.join(',')}}"]
  end

  def format_row(r)
    {
      ad_id: r['ad_id'],
      headline: r['headline'],
      image_url: r['image_url'],
      source_url: r['source_url'],
      started: r['started'].to_i,
      converted: r['converted'].to_i,
    }
  end
end
```

**Sin índice nuevo en MVP.** La query usa sequential scan sobre `messages` filtrando por JSONB. Para volúmenes actuales de VentIA (<500k filas) el tiempo esperado es <500ms. Si en el futuro el endpoint supera 500ms p95, agregar índice parcial vía `CREATE INDEX CONCURRENTLY`:

```sql
CREATE INDEX CONCURRENTLY idx_messages_referral_source_id
  ON messages ((content_attributes->'referral'->>'source_id'))
  WHERE content_attributes->'referral'->>'source_id' IS NOT NULL;
```

### 2) Backend FastAPI (apps/backend/)

**Cliente HTTP** en `apps/backend/app/services/messaging_service.py`:

```python
async def get_ads_summary(
    self,
    tenant_id: int,
    start_date: str,
    end_date: str,
    converted_conversation_ids: list[int],
) -> dict:
    return await self._request_with_status(
        "POST",
        "/api/v1/analytics/ads_summary",
        tenant_id,
        json={
            "start_date": start_date,
            "end_date": end_date,
            "converted_conversation_ids": converted_conversation_ids,
        },
        timeout=15.0,
    )
```

**Repository** nuevo método en `apps/backend/app/repositories/metrics.py`:

```python
def get_validated_order_conversation_ids(
    self,
    db: Session,
    tenant_id: int,
    start: datetime,
    end: datetime,
) -> list[int]:
    rows = db.query(distinct(Order.messaging_conversation_id)).filter(
        Order.tenant_id == tenant_id,
        Order.validado.is_(True),
        Order.validated_at >= start,
        Order.validated_at <= end,
        Order.messaging_conversation_id.isnot(None),
    ).all()
    return [r[0] for r in rows]
```

**Service** nuevo método en `apps/backend/app/services/metrics.py`:

```python
async def get_ads_summary(
    self,
    db: Session,
    tenant_id: int,
    query: MetricsQuery,
    tz_name: str,
) -> dict:
    start, end = resolve_period(query, tz_name)

    converted_ids = metrics_repo.get_validated_order_conversation_ids(
        db, tenant_id, start, end,
    )

    rails_response = await messaging_service.get_ads_summary(
        tenant_id=tenant_id,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        converted_conversation_ids=converted_ids,
    )

    ads = []
    for row in rails_response.get("data", {}).get("ads", []):
        started = row["started"]
        converted = row["converted"]
        rate = (converted / started * 100) if started > 0 else 0.0
        ads.append({
            "ad_id": row["ad_id"],
            "headline": row.get("headline"),
            "image_url": row.get("image_url"),
            "source_url": row.get("source_url"),
            "conversations_started": started,
            "conversations_converted": converted,
            "conversion_rate": round(rate, 2),
        })

    return {
        "ads": ads,
        "total_ads": len(ads),
        "period": {
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
        },
    }
```

**Endpoint** nuevo en `apps/backend/app/api/v1/endpoints/metrics.py`:

```python
@router.get("/ads-summary", response_model=AdsSummaryResponse)
async def get_ads_summary(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> AdsSummaryResponse:
    query = MetricsQuery(
        period=period, start_date=start_date, end_date=end_date,
    )
    tz_name = _get_tenant_timezone(db, current_user.tenant_id)
    result = await metrics_service.get_ads_summary(
        db, current_user.tenant_id, query, tz_name=tz_name,
    )
    return AdsSummaryResponse(**result)
```

**Schemas** en `apps/backend/app/schemas/metrics.py`:

```python
class AdSummaryItem(BaseModel):
    ad_id: str = Field(description="Meta ad_id from referral.source_id")
    headline: str | None = Field(description="Most recent ad headline")
    image_url: str | None = Field(description="Most recent ad creative URL")
    source_url: str | None = Field(description="Short link to ad (fb.me/...)")
    conversations_started: int
    conversations_converted: int
    conversion_rate: float = Field(description="Percentage 0-100")

class AdsSummaryResponse(BaseModel):
    ads: list[AdSummaryItem]
    total_ads: int
    period: PeriodInfo
```

**Permisos** en `apps/backend/app/core/permissions.py`:

Agregar `GET /metrics/ads-summary` a los permisos de roles `SUPERADMIN`, `ADMIN`, `VENTAS` (mismo patrón que `/metrics/conversion-rate`).

### 3) Frontend (apps/frontend/)

**Service** en `apps/frontend/lib/services/metrics-service.ts`:

```typescript
export interface AdSummaryItem {
  ad_id: string
  headline: string | null
  image_url: string | null
  source_url: string | null
  conversations_started: number
  conversations_converted: number
  conversion_rate: number
}

export interface AdsSummaryResponse {
  ads: AdSummaryItem[]
  total_ads: number
  period: { start_date: string; end_date: string }
}

export async function fetchAdsSummary(
  accessToken: string,
  params: { period?: string; start_date?: string; end_date?: string },
): Promise<AdsSummaryResponse> {
  const search = new URLSearchParams(params).toString()
  const res = await fetch(`${API_URL}/metrics/ads-summary?${search}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Error al cargar resumen de anuncios')
  return res.json()
}
```

**Componente** nuevo `apps/frontend/components/dashboard/ads-summary-widget.tsx`:

- Card con header "Performance por anuncio" + filtro de rango (reutiliza `DateRangePicker` del dashboard)
- Tabla shadcn/ui con columnas:
  - **Anuncio**: miniatura `48x48` + headline (con `next/image unoptimized` por CORS de FB CDN, fallback a `<ImageOff>` icon en `onError`)
  - **Iniciadas**: número, alineado a la derecha
  - **Convertidas**: número, alineado a la derecha
  - **Tasa**: porcentaje con barra de progreso visual (similar a `no-purchase-reasons-ranking.tsx`)
- Header con sort en "Iniciadas" y "Tasa" (estado local; con ≤50 filas el sort client-side es suficiente)
- Empty state: ícono Meta + texto "Conecta Meta Ads para empezar a medir performance de campañas" + link a docs (si existe; si no, texto estático)
- Loading skeleton con 3 filas de placeholder

**Integración al dashboard**: insertar en el grid de `apps/frontend/app/dashboard/page.tsx` junto con los otros widgets de métricas, en columna que coincida con el layout actual (referencia: `no-purchase-reasons-ranking.tsx`).

## Tests

### Backend (apps/backend/tests/)

`test_metrics_ads_summary.py`:

- `test_ads_summary_empty_returns_empty_list`: sin órdenes ni conversaciones, response con `ads: []` y `total_ads: 0`.
- `test_ads_summary_calculates_rate_correctly`: mock de Rails con `started=5, converted=3` → `conversion_rate=60.0`.
- `test_ads_summary_handles_zero_started`: si `started=0`, `conversion_rate=0.0` (no dividir por cero).
- `test_ads_summary_requires_permission`: usuario con rol `VIEWER` recibe 403.
- `test_ads_summary_filters_validated_orders_by_tenant`: orders de otro tenant no entran en `converted_conversation_ids`.
- `test_ads_summary_propagates_rails_5xx`: si `messaging_service` lanza, endpoint responde 502/504.

Mock `messaging_service.get_ads_summary` con `AsyncMock`.

### Rails (apps/messaging/spec/)

`spec/services/analytics/ads_summary_service_spec.rb`:

- Happy path con varios ads agrupados correctamente.
- `DISTINCT ON` elige el referral más reciente cuando un ad tiene múltiples creatividades en el rango.
- `converted` se cuenta correctamente con `FILTER` sobre el array provisto.
- `converted_conversation_ids` vacío → todos los ads salen con `converted=0`.
- Mensajes con `referral=null` no se incluyen.
- Mensajes fuera del rango temporal no se incluyen.

## Criterios de aceptación

- [ ] Endpoint `GET /metrics/ads-summary` devuelve la estructura definida con filtros de período válidos.
- [ ] Endpoint Rails `POST /api/v1/analytics/ads_summary` agrupa por `ad_id` con headline/image más reciente.
- [ ] Conversion rate calculada correctamente (0% si started=0, sin división por cero).
- [ ] Widget muestra tabla con miniatura + headline, ordenable por # conversaciones y por tasa.
- [ ] Empty state con CTA "Conecta Meta Ads" cuando no hay data.
- [ ] Tasa de conversión usa órdenes validadas (no draft).
- [ ] Permisos restringidos a `SUPERADMIN`, `ADMIN`, `VENTAS`.
- [ ] Tests backend y Rails pasan.

## Estimación

1.5 días (alineado con la estimación original de la tarea de ClickUp):
- Rails: 0.4 días (controller + service + tests)
- Backend FastAPI: 0.4 días (cliente + repo + service + endpoint + schemas + tests)
- Frontend: 0.5 días (service + widget + integración + estados loading/empty/error)
- QA manual e integración: 0.2 días

## Optimizaciones futuras (fuera del MVP)

- Índice parcial sobre `content_attributes->'referral'->>'source_id'` si el endpoint supera 500ms p95.
- Drill-down: click en fila → lista de conversaciones filtradas por `ad_id`.
- Métricas adicionales por ad: tiempo promedio hasta conversión, primer mensaje vs último mensaje, valor monetario total convertido.
- Cache (Redis) del response del endpoint con TTL corto (60-300s) si se vuelve hot.
