# Plan: Webhook Debounce/Buffer para Mensajes Entrantes

## Contexto

Cuando un cliente de WhatsApp envía varios mensajes rápidos seguidos (ej: 3 mensajes en 10 segundos), cada mensaje dispara un webhook individual a n8n, causando que el AI Agent responda múltiples veces. Se necesita un **debounce**: esperar X segundos después del último mensaje, y enviar todos los mensajes acumulados en un solo webhook.

### Investigación previa

- **WhatsApp Cloud API** no ofrece ningún mecanismo nativo de batching, debounce, ni typing indicators para mensajes entrantes.
- **n8n** no tiene debounce nativo — las soluciones comunitarias usan Redis externo + cron, lo cual es más frágil.
- **Gems de Sidekiq** (`sidekiq-debouncer`, `sidekiq-bouncer`) solo ejecutan el último job, no acumulan mensajes.
- **Conclusión**: El debounce server-side con Redis + Sidekiq es el patrón estándar de la industria para chatbots WhatsApp + AI.

### Por qué es seguro buffear attachments

Los archivos multimedia (audio, imagen, video, documentos) se **descargan y almacenan inmediatamente** al recibir el mensaje (en GCS/local via ActiveStorage). Las URLs del webhook se generan desde blobs ya persistidos, no desde URLs temporales de WhatsApp. Un buffer de 10-30 segundos no presenta ningún riesgo.

---

## Diseño técnico

### Patrón: Debounce con secuencia atómica (Redis + Sidekiq)

```
Mensaje 1 llega:
  → RPUSH webhook_buffer:{wh_id}:{conv_id} [mensaje1_data]
  → INCR webhook_buffer_seq:{wh_id}:{conv_id} → seq=1
  → BufferedDeliverJob.set(wait: 10s).perform_later(seq=1)

Mensaje 2 llega (3 seg después):
  → RPUSH webhook_buffer:{wh_id}:{conv_id} [mensaje2_data]
  → INCR webhook_buffer_seq:{wh_id}:{conv_id} → seq=2
  → BufferedDeliverJob.set(wait: 10s).perform_later(seq=2)

Mensaje 3 llega (2 seg después):
  → RPUSH webhook_buffer:{wh_id}:{conv_id} [mensaje3_data]
  → INCR webhook_buffer_seq:{wh_id}:{conv_id} → seq=3
  → BufferedDeliverJob.set(wait: 10s).perform_later(seq=3)

10 seg después del mensaje 1 → Job seq=1 se ejecuta:
  → current_seq = 3, expected = 1 → NO MATCH → skip ✓

10 seg después del mensaje 2 → Job seq=2 se ejecuta:
  → current_seq = 3, expected = 2 → NO MATCH → skip ✓

10 seg después del mensaje 3 → Job seq=3 se ejecuta:
  → current_seq = 3, expected = 3 → MATCH → FLUSH!
  → MULTI: lee 3 mensajes del buffer + borra keys
  → POST a n8n con los 3 mensajes juntos ✓
```

### Configuración

- **Campo**: `buffer_time_seconds` en tabla `webhooks`
- **Default**: `0` (sin buffer — comportamiento actual intacto)
- **Rango**: 0-120 segundos
- **Configurable desde**: Superadmin → Tenant → Configuración de Webhook

---

## Cambios por archivo

### Capa 1: Rails Messaging

#### 1.1 Migración — Nueva columna

**Nuevo archivo**: `apps/messaging/db/migrate/YYYYMMDD_add_buffer_time_seconds_to_webhooks.rb`

```ruby
class AddBufferTimeSecondsToWebhooks < ActiveRecord::Migration[7.1]
  def change
    add_column :webhooks, :buffer_time_seconds, :integer, default: 0, null: false
  end
end
```

> Default 0 = backward compatible. Webhooks existentes siguen funcionando sin cambios.

---

#### 1.2 Modelo Webhook — Validación y helper

**Archivo**: `apps/messaging/app/models/webhook.rb`

Agregar:

```ruby
# Validaciones (después de las existentes)
validates :buffer_time_seconds, numericality: {
  greater_than_or_equal_to: 0,
  less_than_or_equal_to: 120
}

# Helper
def buffered?
  buffer_time_seconds > 0
end
```

Actualizar `webhook_data` para incluir el nuevo campo:

```ruby
def webhook_data
  {
    id: id,
    url: url,
    subscriptions: subscriptions,
    buffer_time_seconds: buffer_time_seconds  # ← agregar
  }
end
```

---

#### 1.3 Controller Webhooks — Permitir nuevo parámetro

**Archivo**: `apps/messaging/app/controllers/api/v1/webhooks_controller.rb`

Cambiar línea 42:

```ruby
# Antes:
def webhook_params
  params.require(:webhook).permit(:url, subscriptions: [])
end

# Después:
def webhook_params
  params.require(:webhook).permit(:url, :buffer_time_seconds, subscriptions: [])
end
```

---

#### 1.4 Buffer Service — Lógica Redis (nuevo)

**Nuevo archivo**: `apps/messaging/app/services/webhooks/buffer_service.rb`

```ruby
module Webhooks
  class BufferService
    BUFFER_KEY_PREFIX = "webhook_buffer".freeze
    SEQ_KEY_PREFIX = "webhook_buffer_seq".freeze
    BUFFER_TTL = 300 # 5 minutos — safety net contra keys huérfanas

    def initialize(redis: Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1')))
      @redis = redis
    end

    def buffer_and_schedule(webhook:, conversation_id:, message_data:)
      buffer_key = "#{BUFFER_KEY_PREFIX}:#{webhook.id}:#{conversation_id}"
      seq_key = "#{SEQ_KEY_PREFIX}:#{webhook.id}:#{conversation_id}"

      # Atomicamente: push mensaje + incrementar secuencia + set TTL
      results = @redis.multi do |tx|
        tx.rpush(buffer_key, message_data.to_json)
        tx.expire(buffer_key, BUFFER_TTL)
        tx.incr(seq_key)
        tx.expire(seq_key, BUFFER_TTL)
      end

      sequence = results[2] # Resultado del INCR

      # Programar job diferido
      Webhooks::BufferedDeliverJob.set(
        wait: webhook.buffer_time_seconds.seconds
      ).perform_later(
        webhook_id: webhook.id,
        conversation_id: conversation_id,
        expected_sequence: sequence
      )
    end
  end
end
```

---

#### 1.5 Buffered Deliver Job — Entrega por lote (nuevo)

**Nuevo archivo**: `apps/messaging/app/jobs/webhooks/buffered_deliver_job.rb`

```ruby
class Webhooks::BufferedDeliverJob < ApplicationJob
  queue_as :default

  def perform(webhook_id:, conversation_id:, expected_sequence:)
    redis = Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
    buffer_key = "#{Webhooks::BufferService::BUFFER_KEY_PREFIX}:#{webhook_id}:#{conversation_id}"
    seq_key = "#{Webhooks::BufferService::SEQ_KEY_PREFIX}:#{webhook_id}:#{conversation_id}"

    # Verificar si la secuencia coincide (si no, un job más nuevo se encargará)
    current_seq = redis.get(seq_key).to_i
    return unless current_seq == expected_sequence

    # Atomicamente: leer buffer completo + limpiar keys
    results = redis.multi do |tx|
      tx.lrange(buffer_key, 0, -1)
      tx.del(buffer_key)
      tx.del(seq_key)
    end

    raw_messages = results[0]
    return if raw_messages.blank?

    messages = raw_messages.map { |m| JSON.parse(m) }

    webhook = Webhook.find_by(id: webhook_id)
    return unless webhook

    # Construir payload con array de mensajes
    payload = {
      event: 'messages_created',
      timestamp: Time.current.iso8601,
      data: {
        conversation_id: conversation_id,
        messages: messages
      }
    }

    response = HTTParty.post(
      webhook.url,
      headers: {
        'Content-Type' => 'application/json',
        'User-Agent' => 'VentIA-Messaging/1.0'
      },
      body: payload.to_json,
      timeout: 10
    )

    if response.success?
      Rails.logger.info "[Webhook] Buffered delivery OK → #{webhook.url}: #{messages.size} messages for conversation #{conversation_id}"
    else
      Rails.logger.error "[Webhook] Buffered delivery FAILED → #{webhook.url}: HTTP #{response.code}"
      raise "Webhook delivery failed: HTTP #{response.code}" # Trigger Sidekiq retry
    end
  rescue StandardError => e
    Rails.logger.error "[Webhook] Buffered delivery error: #{e.message}"
    raise
  end
end
```

---

#### 1.6 WebhookListener — Ruteo buffer vs directo

**Archivo**: `apps/messaging/app/listeners/webhook_listener.rb`

Reemplazar el método `message_created` (líneas 17-23):

```ruby
# Antes:
def message_created(event)
  message, account = extract_message_and_account(event)
  return unless message.incoming? && message.conversation.ai_agent_enabled?

  dispatch_webhooks(account, 'message_created', message.webhook_data)
end

# Después:
def message_created(event)
  message, account = extract_message_and_account(event)
  return unless message.incoming? && message.conversation.ai_agent_enabled?

  dispatch_webhooks_with_buffering(account, message)
end
```

Agregar método privado (después de `dispatch_webhooks`):

```ruby
def dispatch_webhooks_with_buffering(account, message)
  return unless account

  buffer_service = Webhooks::BufferService.new

  account.webhooks.where("subscriptions @> ?", ['message_created'].to_json).each do |webhook|
    if webhook.buffered?
      buffer_service.buffer_and_schedule(
        webhook: webhook,
        conversation_id: message.conversation_id,
        message_data: message.webhook_data
      )
    else
      # Sin buffer — dispatch inmediato (comportamiento actual)
      webhook.dispatch_event('message_created', message.webhook_data)
    end
  end
rescue StandardError => e
  Rails.logger.error "[WebhookListener] Error in message_created: #{e.message}"
end
```

> **Importante**: Solo afecta `message_created`. Todos los demás eventos (`conversation_created`, `message_updated`, etc.) siguen usando `dispatch_webhooks` sin cambios.

---

### Capa 2: FastAPI Backend

#### 2.1 Endpoint de Webhook — Pass-through del nuevo campo

**Archivo**: `apps/backend/app/api/v1/endpoints/tenants.py` (líneas 396-399)

```python
# Antes:
webhook_payload = {
    "url": payload.get("url"),
    "subscriptions": ["message_created"],
}

# Después:
webhook_payload = {
    "url": payload.get("url"),
    "subscriptions": ["message_created"],
    "buffer_time_seconds": payload.get("buffer_time_seconds", 0),
}
```

> No se necesitan cambios en `messaging_service.py` — ya pasa el payload completo como `{"webhook": payload}`.

---

### Capa 3: Frontend (Next.js)

#### 3.1 Tipo WebhookConfig

**Archivo**: `apps/frontend/lib/api-client/superadmin.ts` (línea 265-268)

```typescript
// Antes:
export interface WebhookConfig {
  id: string;
  url: string;
}

// Después:
export interface WebhookConfig {
  id: string;
  url: string;
  buffer_time_seconds: number;
}
```

#### 3.2 Función saveTenantWebhook

**Archivo**: `apps/frontend/lib/api-client/superadmin.ts` (líneas 287-292)

```typescript
// Antes:
export async function saveTenantWebhook(
  tenantId: number,
  data: { url: string }
): Promise<WebhookConfig> {

// Después:
export async function saveTenantWebhook(
  tenantId: number,
  data: { url: string; buffer_time_seconds?: number }
): Promise<WebhookConfig> {
```

#### 3.3 Página de Tenant — UI de buffer time

**Archivo**: `apps/frontend/app/superadmin/tenants/[id]/page.tsx`

**Agregar state** (después de línea 30):

```typescript
const [bufferTime, setBufferTime] = useState<number>(0);
```

**En `fetchWebhook`** (después de línea 90, donde se hace `setWebhookUrl(data.url)`):

```typescript
setBufferTime(data.buffer_time_seconds ?? 0);
```

**En `handleSaveWebhook`** (línea 110-112, cambiar el payload):

```typescript
// Antes:
const result = await saveTenantWebhook(parseInt(params.id as string), {
  url: webhookUrl.trim(),
});

// Después:
const result = await saveTenantWebhook(parseInt(params.id as string), {
  url: webhookUrl.trim(),
  buffer_time_seconds: bufferTime,
});
```

**Agregar input de buffer** (después del input de URL, antes del `webhookError`, ~línea 554):

```tsx
<div className="space-y-2">
  <Label htmlFor="buffer-time">Tiempo de buffer (segundos)</Label>
  <Input
    id="buffer-time"
    type="number"
    min={0}
    max={120}
    value={bufferTime}
    onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)}
    disabled={webhookSaving}
  />
  <p className="text-xs text-muted-foreground">
    Espera X segundos tras el último mensaje del cliente antes de enviar al webhook.
    Esto evita que el AI Agent responda múltiples veces cuando el cliente envía varios mensajes seguidos.
    0 = envío inmediato (sin buffer).
  </p>
</div>
```

#### 3.4 API Route — Pass-through

**Archivo**: `apps/frontend/app/api/superadmin/tenants/[id]/messaging-webhook/route.ts`

No requiere cambios — la función POST ya pasa `body` completo al backend con `JSON.stringify(body)` (línea 69).

---

## Payload del webhook buffered

### Evento actual (sin buffer): `message_created`

```json
{
  "event": "message_created",
  "timestamp": "2026-04-07T15:30:00Z",
  "data": {
    "id": 1,
    "content": "hola necesito ayuda",
    "message_type": "incoming",
    "content_attributes": {},
    "conversation_id": 123,
    "ai_agent_enabled": true,
    "sender": { "id": 5, "name": "Juan", "phone_number": "+51999888777" },
    "attachments": []
  }
}
```

### Evento nuevo (con buffer): `messages_created`

```json
{
  "event": "messages_created",
  "timestamp": "2026-04-07T15:30:15Z",
  "data": {
    "conversation_id": 123,
    "messages": [
      {
        "id": 1,
        "content": "hola necesito ayuda",
        "message_type": "incoming",
        "content_attributes": {},
        "conversation_id": 123,
        "ai_agent_enabled": true,
        "sender": { "id": 5, "name": "Juan", "phone_number": "+51999888777" },
        "attachments": []
      },
      {
        "id": 2,
        "content": null,
        "message_type": "incoming",
        "content_attributes": {},
        "conversation_id": 123,
        "ai_agent_enabled": true,
        "sender": { "id": 5, "name": "Juan", "phone_number": "+51999888777" },
        "attachments": [
          {
            "id": 10,
            "file_type": "image",
            "data_url": "https://storage.googleapis.com/bucket/path/to/image.jpg",
            "file_size": 245000
          }
        ]
      },
      {
        "id": 3,
        "content": "ese es mi comprobante de pago",
        "message_type": "incoming",
        "content_attributes": {},
        "conversation_id": 123,
        "ai_agent_enabled": true,
        "sender": { "id": 5, "name": "Juan", "phone_number": "+51999888777" },
        "attachments": []
      }
    ]
  }
}
```

> n8n debe concatenar `messages[].content` para construir el prompt del AI agent. Los mensajes están ordenados cronológicamente (RPUSH preserva orden de inserción).

---

## Edge cases y mitigaciones

| Escenario | Qué pasa | Mitigación |
|-----------|----------|------------|
| `buffer_time_seconds = 0` | Webhook se despacha inmediatamente (sin buffer) | Comportamiento idéntico al actual. Sin cambios. |
| Sidekiq se reinicia | Jobs diferidos están serializados en Redis, se retomarán | Automático por Sidekiq |
| Redis pierde data | Job encuentra buffer vacío → skip silencioso | Mensajes no se pierden (están en DB). Se pierde solo esa entrega de webhook. |
| 2 mensajes en el mismo milisegundo | INCR atómico garantiza secuencias distintas. Solo el último job hace flush. | Sin race conditions. |
| Múltiples webhooks para el mismo account | Cada webhook bufferea independientemente (keys distintas por `webhook_id`) | Correcto — diferentes endpoints pueden tener distintos buffer times. |
| Mensaje llega justo cuando el job se ejecuta | MULTI en Redis es atómico: verifica seq + lee buffer + borra keys en una transacción | Si la seq no coincide, skip. Si coincide, flush atómico. |
| Keys huérfanas en Redis | TTL de 5 minutos en todas las keys | Se autolimpian aunque algo falle. |

---

## Orden de implementación

```
Paso 1: Migración (add_buffer_time_seconds)
  ↓ puede desplegarse solo — default 0, sin impacto
Paso 2: Modelo + Controller Rails (validación, permit, webhook_data)
  ↓ expone el campo, sin cambio funcional
Paso 3: BufferService + BufferedDeliverJob (archivos nuevos)
  ↓ código inerte — nadie lo llama aún
Paso 4: WebhookListener (ruteo buffer vs directo)
  ↓ activación — solo si buffer_time_seconds > 0
Paso 5: FastAPI pass-through
  ↓ permite configurar desde frontend
Paso 6: Frontend UI (input de buffer time)
  ↓ usuario puede configurar
Paso 7: n8n workflow (manejar evento messages_created)
  ↓ externo — concatenar messages[].content
```

> Pasos 1-4 se pueden deployar juntos de forma segura (default 0 = sin cambios funcionales).

---

## Archivos a modificar/crear

| Archivo | Acción | Líneas afectadas |
|---------|--------|------------------|
| `apps/messaging/db/migrate/..._add_buffer_time.rb` | **Crear** | — |
| `apps/messaging/app/models/webhook.rb` | Modificar | ~31, ~53-59 |
| `apps/messaging/app/controllers/api/v1/webhooks_controller.rb` | Modificar | 42 |
| `apps/messaging/app/services/webhooks/buffer_service.rb` | **Crear** | — |
| `apps/messaging/app/jobs/webhooks/buffered_deliver_job.rb` | **Crear** | — |
| `apps/messaging/app/listeners/webhook_listener.rb` | Modificar | 17-23, nuevo método privado |
| `apps/backend/app/api/v1/endpoints/tenants.py` | Modificar | 396-399 |
| `apps/frontend/lib/api-client/superadmin.ts` | Modificar | 265-268, 287-292 |
| `apps/frontend/app/superadmin/tenants/[id]/page.tsx` | Modificar | ~30, ~90, ~110, ~554 |

---

## Verificación

1. **Sin buffer (default)**: Enviar mensaje → webhook se despacha inmediatamente → n8n recibe `message_created` como siempre
2. **Con buffer**: Configurar `buffer_time_seconds = 10` → enviar 3 mensajes rápidos → solo 1 webhook `messages_created` con los 3 mensajes
3. **Mixed media**: Enviar texto + audio + imagen rápido → webhook buffered incluye los 3 con sus attachment URLs válidas
4. **Frontend**: Configurar buffer_time desde superadmin → guardar → recargar → valor persiste
5. **n8n**: Workflow maneja `messages_created` → concatena contenido → AI responde una sola vez
