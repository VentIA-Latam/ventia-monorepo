# Plan: US-CONV-003 — Endpoint conteo conversaciones + tasa de conversión

## Contexto

Para la métrica de tasa de conversión necesitamos:
- **Denominador:** total de conversaciones en un periodo (desde messaging)
- **Numerador:** órdenes validadas con `messaging_conversation_id` (desde ventia_db)
- **Endpoint** que combine ambos y retorne la tasa

---

## Archivos a crear/modificar

| Archivo | Acción | App |
|---------|--------|-----|
| `apps/messaging/app/models/conversation.rb` | Agregar scope `created_in_range` | Rails |
| `apps/messaging/app/controllers/api/v1/conversations_controller.rb` | Agregar acción `count_by_period` | Rails |
| `apps/messaging/config/routes.rb` | Agregar ruta en reports namespace | Rails |
| `apps/backend/app/services/messaging_service.py` | Agregar `get_conversations_count_by_period()` | FastAPI |
| `apps/backend/app/repositories/metrics.py` | Agregar `get_conversions_count()` | FastAPI |
| `apps/backend/app/services/metrics.py` | Agregar `get_conversion_rate()` | FastAPI |
| `apps/backend/app/api/v1/endpoints/metrics.py` | Agregar endpoint `/conversion-rate` | FastAPI |
| `apps/backend/app/schemas/metrics.py` | Agregar `ConversionRateResponse` | FastAPI |

---

## Paso 1: Rails — scope + acción en controller existente

### 1a. Scope en Conversation model

**Archivo:** `apps/messaging/app/models/conversation.rb`

Agregar junto a los scopes existentes (línea ~77):
```ruby
scope :created_in_range, ->(from, to) { where(created_at: from..to) }
```

### 1b. Acción en ConversationsController (no crear controller nuevo)

**Archivo:** `apps/messaging/app/controllers/api/v1/conversations_controller.rb`

Agregar acción `count_by_period` siguiendo el patrón de `counts`:

```ruby
def count_by_period
  begin
    start_date = params[:start_date] ? Time.iso8601(params[:start_date]) : 30.days.ago
    end_date = params[:end_date] ? Time.iso8601(params[:end_date]) : Time.current
  rescue ArgumentError
    return render_error("Invalid date format, use ISO 8601", status: :bad_request)
  end

  total = current_account.conversations
            .created_in_range(start_date, end_date)
            .count

  render_success({
    total: total,
    start_date: start_date.iso8601,
    end_date: end_date.iso8601
  })
end
```

### 1c. Ruta en reports namespace

**Archivo:** `apps/messaging/config/routes.rb`

En el namespace `reports` existente:
```ruby
namespace :reports do
  get 'conversations', to: 'conversations#index'
  get 'conversations/summary', to: 'conversations#summary'
  get 'conversations/count', to: 'conversations#count_by_period'  # NUEVO
  get 'agents', to: 'agents#index'
end
```

---

## Paso 2: Backend — layered architecture

### 2a. Proxy en messaging_service.py

**Archivo:** `apps/backend/app/services/messaging_service.py`

```python
async def get_conversations_count_by_period(
    self, tenant_id: int, start_date: str, end_date: str
) -> Optional[dict]:
    """Get total conversations count for a date range."""
    return await self._request(
        "GET", "/api/v1/reports/conversations/count",
        tenant_id, params={"start_date": start_date, "end_date": end_date}
    )
```

### 2b. Repository method para numerador

**Archivo:** `apps/backend/app/repositories/metrics.py`

Agregar método para contar conversiones:
```python
def get_conversions_count(
    self,
    db: Session,
    tenant_id: int,
    start_utc: datetime,
    end_utc: datetime,
) -> int:
    """Count orders with messaging_conversation_id and validado=True in period."""
    return db.query(Order).filter(
        Order.tenant_id == tenant_id,
        Order.messaging_conversation_id.isnot(None),
        Order.validado == True,
        Order.validated_at.between(start_utc, end_utc),
    ).count()
```

### 2c. Service method

**Archivo:** `apps/backend/app/services/metrics.py`

Agregar al MetricsService:
```python
async def get_conversion_rate(
    self,
    db: Session,
    tenant_id: int,
    query: MetricsQuery,
) -> dict:
    """Calculate conversion rate: validated orders with conversation / total conversations."""
    tz_name = self._get_tenant_timezone(db, tenant_id)
    start_utc, end_utc = self.repository._get_date_range(
        query.period, query.start_date, query.end_date, tz_name
    )

    # Numerador: órdenes con conversation_id validadas en periodo
    conversions = self.repository.get_conversions_count(
        db, tenant_id, start_utc, end_utc
    )

    # Denominador: total conversaciones en periodo (desde messaging)
    from app.services.messaging_service import messaging_service
    conv_result = await messaging_service.get_conversations_count_by_period(
        tenant_id, start_utc.isoformat(), end_utc.isoformat()
    )
    total_conversations = 0
    if conv_result:
        data = conv_result.get("data") if isinstance(conv_result.get("data"), dict) else {}
        total_conversations = data.get("total", 0)

    rate = round((conversions / total_conversations * 100), 1) if total_conversations > 0 else 0.0

    return {
        "conversion_rate": rate,
        "conversions": conversions,
        "total_conversations": total_conversations,
        "period": query.period,
        "start_date": start_utc.isoformat(),
        "end_date": end_utc.isoformat(),
    }
```

### 2d. Endpoint (thin)

**Archivo:** `apps/backend/app/api/v1/endpoints/metrics.py`

```python
@router.get("/conversion-rate", response_model=ConversionRateResponse, tags=["metrics"])
async def get_conversion_rate(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> ConversionRateResponse:
    """Get AI agent conversion rate for a period."""
    tenant_id = current_user.tenant_id
    if current_user.role == Role.SUPERADMIN and not tenant_id:
        raise HTTPException(status_code=400, detail="SUPERADMIN must specify tenant context")

    query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
    result = await metrics_service.get_conversion_rate(db, tenant_id, query)
    return ConversionRateResponse(**result)
```

### 2e. Schema

**Archivo:** `apps/backend/app/schemas/metrics.py`

```python
class ConversionRateResponse(BaseModel):
    """Tasa de conversión del agente IA."""
    conversion_rate: float = Field(..., description="Tasa de conversión (%)")
    conversions: int = Field(..., description="Órdenes validadas con conversación vinculada")
    total_conversations: int = Field(..., description="Total conversaciones en el periodo")
    period: str
    start_date: str
    end_date: str

    model_config = ConfigDict(from_attributes=True)
```

---

## Orden de ejecución

1. Rails: scope + acción + ruta
2. Backend: proxy messaging_service
3. Backend: repository method
4. Backend: service method
5. Backend: schema + endpoint
6. Tests
7. Validar con agentes auditores

## Verificación

1. `GET /api/v1/reports/conversations/count?start_date=2026-04-01T00:00:00&end_date=2026-04-24T23:59:59` → `{total: N}`
2. `GET /api/v1/metrics/conversion-rate?period=last_30_days` → `{conversion_rate: X, conversions: Y, total_conversations: Z}`
3. Tests unitarios del service + repository
