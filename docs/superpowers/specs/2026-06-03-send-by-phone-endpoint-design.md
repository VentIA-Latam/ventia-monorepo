# Send-by-Phone Endpoint — Design

**Status:** Draft
**Date:** 2026-06-03
**Owner:** Renzo Lenes
**Related:** ClickUp "Módulo 6: Campañas Masivas" (este spec es la capa A / foundation)

## Resumen

Endpoint para enviar un mensaje template de WhatsApp a un número telefónico sin requerir un `conversation_id` previo. El endpoint crea el contacto y la conversación si no existen, reusa una conversación abierta si la hay, y deja el mensaje saliente visible en el dashboard del agente inmediatamente.

Cubre dos casos de uso:
1. **Frontend "compose to new number":** un agente abre un chat nuevo escribiendo un número en el inbox.
2. **Pieza primitiva para Campañas (futuro Módulo 6):** el job de campaña iterará un CSV/audiencia y llamará a este endpoint (o al servicio interno) por cada destinatario.

Solo aplica a inboxes de **WhatsApp**. Instagram no se cubre acá (usa identificadores PSID, no phone).

## Motivación

Hoy `POST /api/v1/conversations/:id/messages` requiere una conversación existente. Para enviar a un número que nunca se ha contactado antes, no hay endpoint público — solo el patrón privado de `Campaigns::TriggerService#create_campaign_conversation`.

Esto bloquea:
- Que el frontend permita "componer mensaje a un número nuevo".
- Que el Módulo 6 (Campañas Masivas) pueda procesar un CSV con teléfonos como origen — la lógica existe duplicada dentro de `TriggerService` y no es invocable desde HTTP.

Extraemos un servicio compartido (`Conversations::EnsureFromPhoneService`) y lo exponemos vía HTTP. El refactor de `Campaigns::TriggerService` para que use este servicio no se hace en este spec: el modelo actual de `Campaign` no tiene columna `template_params` (a diferencia de Chatwoot), y el servicio compartido requiere templates. Esa migración + refactor se hace junto en el spec de M6, donde ya se está rediseñando el flujo completo de campañas.

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Responsabilidad del endpoint | Atómico: ensure contact + ensure conversation + send message en una sola llamada | Más simple para campañas y frontend; evita 2-round-trips |
| Contenido del mensaje | Solo templates (`template_params` obligatorio) | Conversaciones nuevas están fuera de la ventana 24h de WhatsApp; texto libre fallaría en Meta |
| Conversación existente | Reusa si hay `status: :open` en mismo (contact, inbox); si no, crea nueva | Evita ensuciar el inbox con duplicados; no reabre `resolved` |
| Batch | Single phone por llamada | Campañas iteran y llaman N veces (mismo patrón que TriggerService hoy); más simple, retry-friendly |
| Capas | Rails endpoint + FastAPI proxy | Cumple regla `backend → messaging`; deja consumible desde frontend y API externa |
| Service extraction | `Conversations::EnsureFromPhoneService` compartido. Refactor de `TriggerService` se difiere a M6 porque depende de migración de schema | Una sola fuente de verdad sin bloquear este spec en cambios de M6 |
| Patrón "crear local + enviar" vs "solo enviar (Chatwoot)" | Crear local + enviar | Mejor UX: el agente ve la conversación inmediatamente sin esperar webhook de respuesta |
| Inbox selection | `inbox_id` requerido en body | Tenants pueden tener N inboxes WhatsApp; explícito evita magia |

## Arquitectura

```
Frontend / Backoffice
        │
        ▼
[FastAPI] POST /api/v1/messaging/messages/send-by-phone
  ├─ Auth (get_current_user_or_api_key) + permission
  └─ Proxy → Rails con tenant scoping
        │
        ▼
[Rails] POST /api/v1/messages/send_by_phone
  Controller: Api::V1::MessagesController#send_by_phone
  ├─ Valida params (phone, inbox_id, template_params)
  ├─ Valida inbox pertenece a tenant + es Channel::Whatsapp
  └─ Invoca service
        │
        ▼
[Servicio compartido] Conversations::EnsureFromPhoneService
  ├─ Normaliza phone → E.164
  ├─ find_or_create Contact
  ├─ find_or_create ContactInbox (source_id: bsuid si flag, sino phone)
  ├─ Decide conversation (reusa open, sino crea)
  ├─ Construye Message con Whatsapp::TemplateMessageBuilder
  ├─ Crea Message en DB
  └─ Whatsapp::SendOnWhatsappService (existente, sin cambios)

```

Un servicio compartido, un consumidor en este spec (controller HTTP), y un proxy delgado en FastAPI. `Campaigns::TriggerService` queda sin tocar acá y se migrará al servicio compartido durante el spec del Módulo 6, junto con la migración que agrega `template_params` a `campaigns`.

## Contrato del endpoint

### Rails (capa interna)

`POST /api/v1/messages/send_by_phone`
Auth: API key (mismo patrón que resto de endpoints v1)

**Request body:**
```json
{
  "phone": "+51999888777",
  "inbox_id": 12,
  "template_params": {
    "name": "campaign_promo_junio",
    "language": "es",
    "processed_params": { "1": "Juan", "2": "20%" }
  },
  "contact_name": "Juan Pérez"
}
```

`contact_name` es opcional: solo se usa si se crea contacto nuevo. Si el contacto ya existe, su nombre no se sobrescribe.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "conversation_id": 456,
    "message_id": 789,
    "contact_id": 123,
    "contact_created": true,
    "conversation_created": false
  }
}
```

### FastAPI (capa pública)

`POST /api/v1/messaging/messages/send-by-phone`
Auth: `get_current_user_or_api_key`
Permission: `require_permission_dual("POST", "/messaging/messages/send-by-phone")`

Mismo body, mismo response shape. El proxy agrega `tenant_id` al routing hacia Rails siguiendo el patrón existente en `apps/backend/app/api/v1/endpoints/messaging.py`.

### Mapeo de errores

| Caso | HTTP | Mensaje |
|---|---|---|
| `phone` ausente o no E.164 (después de normalizar) | 422 | `phone debe estar en formato E.164 (+...)` |
| `inbox_id` no existe en tenant | 404 | (de `ActiveRecord::RecordNotFound`) |
| Inbox no es Channel::Whatsapp | 422 | `send_by_phone solo aplica a inboxes de WhatsApp` |
| `template_params` ausente | 422 | `template_params requerido` |
| Template no encontrado | 422 | (de `Whatsapp::TemplateMessageBuilder::TemplateNotFound`) |
| Faltan variables del template | 422 | (de `MissingBodyVariables`) |
| Fallo de envío en Meta (red, API) | 201 + message.status=failed + log | El agente ve la conversación creada y puede reintentar |
| Fallo antes de tocar Meta (channel mal configurado) | 500 | Conversation ya quedó creada — trade-off conocido |

## Servicio compartido `Conversations::EnsureFromPhoneService`

**Ubicación:** `apps/messaging/app/services/conversations/ensure_from_phone_service.rb`

**Interfaz pública:**

```ruby
class Conversations::EnsureFromPhoneService
  Result = Struct.new(:contact, :contact_inbox, :conversation, :message,
                      :contact_created, :conversation_created, keyword_init: true)

  class InvalidPhoneError        < StandardError; end
  class InvalidInboxChannelError < StandardError; end

  def initialize(account:, inbox:, phone:, template_params:,
                 contact_name: nil, campaign: nil)
    @account         = account
    @inbox           = inbox
    @phone           = phone
    @template_params = template_params
    @contact_name    = contact_name
    @campaign        = campaign
  end

  def perform
    validate_inbox!
    normalized = normalize_phone!
    contact, contact_created     = ensure_contact(normalized)
    contact_inbox                = ensure_contact_inbox(contact)
    conversation, convo_created  = ensure_conversation(contact, contact_inbox)
    message                      = build_and_save_message(conversation)
    send_via_whatsapp(conversation, message)

    Result.new(contact: contact, contact_inbox: contact_inbox,
               conversation: conversation, message: message,
               contact_created: contact_created,
               conversation_created: convo_created)
  end
end
```

### Reglas internas

| Paso | Regla |
|---|---|
| `validate_inbox!` | Si `@inbox.channel` no es `Channel::Whatsapp` → raise `InvalidInboxChannelError`. Controller mapea a 422. |
| `normalize_phone!` | Strip espacios/guiones. Validar contra `/\A\+[1-9]\d{1,14}\z/` (E.164). Si falla → raise `InvalidPhoneError`. No intentar adivinar país. |
| `ensure_contact` | `Contact.find_or_create_by(account, phone_number: normalized)`. Si crea, setea `name = @contact_name` (si vino) y `contact_type: :lead`. Devuelve `[contact, created?]`. |
| `ensure_contact_inbox` | Hereda lógica de `TriggerService` líneas 70-93: prefiere `whatsapp_bsuid` existente si `ENV['WHATSAPP_BSUID_SENDING']=='true'`; si no, usa phone sin `+` como `source_id`. `ContactInbox.find_or_create_by(contact, inbox, source_id)`. |
| `ensure_conversation` | Busca `@account.conversations.where(contact_id, inbox_id, status: :open).order(created_at: :desc).first`. Si encuentra → reusa. Si no → `Conversation.create!(account, inbox, contact, contact_inbox, campaign: @campaign, status: :open)`. |
| `build_and_save_message` | Usa `Whatsapp::TemplateMessageBuilder.new(conversation, name, language, processed_params).build` (idéntico a messages_controller.rb:96-101). Crea Message con esos attrs + `account`, `inbox`, `message_type: :outgoing`. Propaga `TemplateNotFound`/`MissingBodyVariables`. |
| `send_via_whatsapp` | `Whatsapp::SendOnWhatsappService.new(conversation, message).perform`. Síncrono. Si Meta rechaza, el message queda `status: failed` pero el servicio no raisea — el caller ve el resultado en `Result`. |

### `Campaigns::TriggerService` queda sin tocar

El modelo actual `Campaign` tiene columna `message` (texto plano) pero no `template_params`. El servicio compartido requiere `template_params` (decisión "templates only"), entonces refactorizar `TriggerService` ahora obligaría a inventar valores fake o sobrecargar la interfaz del servicio compartido.

Salida limpia: dejamos `TriggerService` con su lógica actual sin tocar en este spec. En el spec de M6 se hace junto:
- Migración `add_template_params_to_campaigns` (jsonb).
- Refactor de `TriggerService` (o reemplazo por `Campaigns::TriggerJob` async) para que use `EnsureFromPhoneService` con `template_params` resueltos por contacto (Liquid).

El `campaign:` opcional del servicio queda listo y documentado para ese momento — no hay deuda de diseño, solo de migración.

## Data flow y casos borde

### Idempotencia

- `Contact.find_or_create_by(account, phone_number)` con índice único `(account_id, phone_number)` → PostgreSQL maneja race entre requests concurrentes.
- Igual con `ContactInbox.find_or_create_by(contact, inbox, source_id)`.

### Race condition en conversación open

Si dos requests llegan simultáneamente con el mismo phone+inbox y no hay conversación open existente, ambas pueden crear conversación → quedan dos opens. Aceptable: probabilidad mínima (mismos phone+inbox+ms), y el segundo template-message simplemente va a una de las dos. No usar `SELECT FOR UPDATE` para esto.

### Normalización de phone

```
Input                          → Output (o error)
"+51999888777"                 → "+51999888777"
" +51 999 888 777"             → "+51999888777"
"+51-999-888-777"              → "+51999888777"
"999888777"                    → InvalidPhoneError (falta código país)
"+0999..."                     → InvalidPhoneError (E.164 no permite 0 después de +)
"+5199988877700000000"         → InvalidPhoneError (>15 dígitos)
```

### Source ID para ContactInbox

Hereda la lógica de `TriggerService` líneas 70-80:
- Si `ContactInbox` existente en este inbox tiene `whatsapp_bsuid` Y `ENV['WHATSAPP_BSUID_SENDING'] == 'true'` → usa el `bsuid`.
- Sino → usa `phone` sin `+`.
- Para contacto nuevo: siempre `phone` sin `+`.

### Política de envío síncrono

`SendOnWhatsappService` se invoca síncronamente. Si Meta responde con error:
- Message queda en DB con `status: failed`.
- El endpoint devuelve **201** con `conversation_id` y `message_id`.
- Razón: el agente ve la conversación creada en el frontend y puede reintentar. Devolver 5xx oculta que se creó estado.
- El error de Meta se loggea con `Rails.logger.error` con contexto (`conversation_id`, `message_id`, `account_id`).

### `campaign:` opcional

- Endpoint HTTP → `campaign: nil`.
- `TriggerService` (futuro) → `campaign: @campaign` que se setea en la Conversation para que `Campaign has_many :conversations` siga funcionando.

## Future use: Campaigns Module (Módulo 6)

Este servicio fue diseñado anticipando su uso por el Módulo 6. Cuando se construya:

1. `Campaigns::TriggerJob` (Sidekiq, queue `low`) iterará la audiencia (label-based o CSV-derived) y llamará `EnsureFromPhoneService` por contacto.
2. La resolución de variables dinámicas (estilo Liquid de Chatwoot, drops `contact`/`agent`/`inbox`/`account`) sucede **en el job de campaña, antes** de llamar al servicio. El servicio recibe `template_params` ya resueltos por contacto.
3. El parámetro `campaign:` propaga el binding `Campaign has_many :conversations`.
4. Si Meta rechaza un envío, queda registrado en `message.status = failed` y el agente lo ve. El job continúa con el resto de la audiencia (no aborta).

**Lo que NO va en este spec, va en M6:**
- Modelo de campaign con `template_params` jsonb (probablemente migrar a estilo Chatwoot: `add_template_params_to_campaigns`).
- `Campaigns::TriggerJob` async + cron `*/5 * * * *` (`TriggerScheduledItemsJob`).
- `Liquid::CampaignTemplateService` para variables dinámicas.
- CSV import flow (probablemente vía `Contacts::ContactImport` + asignación de label).
- UI de campañas.

## Testing

### Backend Rails

1. **`spec/services/conversations/ensure_from_phone_service_spec.rb`**
   - Contacto y conversación inexistentes → crea ambos, manda template
   - Contacto existe, no hay conversación open → reusa contact, crea conversation
   - Hay conversación open → reusa ambos
   - Contacto tiene resolved → crea nueva conversation
   - ContactInbox con bsuid + flag → usa bsuid; sin flag → usa phone
   - Phone inválido → `InvalidPhoneError`, no crea nada
   - Inbox no Whatsapp → `InvalidInboxChannelError`, no crea nada
   - Template no encontrado → propaga `TemplateNotFound`
   - SendOnWhatsappService falla → message.status=failed, conversation existe, no raisea
   - Normalización phone: matriz de inputs (válidos/inválidos)

2. **`spec/requests/api/v1/messages/send_by_phone_spec.rb`**
   - 201 happy path con response shape completo
   - 422 phone inválido / inbox no whatsapp / template_params ausente / template no encontrado
   - 404 inbox_id no pertenece al tenant
   - Sin API key → 401

### Backend FastAPI (pytest)

3. **`apps/backend/tests/unit/services/test_messaging_send_by_phone.py`** (proxy)
   - Mock httpx hacia Rails, verifica body y tenant_id
   - Propagación 422 / 404 / 5xx

4. **`apps/backend/tests/integration/test_send_by_phone_endpoint.py`**
   - Auth: sin token → 401; con rol LOGISTICA o VIEWER → 403; con ADMIN o VENTAS → llama proxy
   - Confirma que el wildcard `POST /messaging/*` cubre la ruta nueva sin necesidad de regla específica

### Fuera de scope

- Rate limiting → ticket M6 dice "no implementar por ahora"
- Tests de cron/scheduler → M6
- Tests de Liquid templates → M6

## Archivos afectados

**Nuevos:**
- `apps/messaging/app/services/conversations/ensure_from_phone_service.rb`
- `apps/messaging/spec/services/conversations/ensure_from_phone_service_spec.rb`
- `apps/messaging/spec/requests/api/v1/messages/send_by_phone_spec.rb`
- `apps/backend/tests/unit/services/test_messaging_send_by_phone.py`
- `apps/backend/tests/integration/test_send_by_phone_endpoint.py`

**Modificados:**
- `apps/messaging/app/controllers/api/v1/messages_controller.rb` (acción `send_by_phone` + rescue de errores del servicio)
- `apps/messaging/config/routes.rb` (ruta nueva fuera del scope `:conversations`)
- `apps/backend/app/api/v1/endpoints/messaging.py` (proxy `send-by-phone`)
- `apps/backend/app/core/permissions.py` — **no requiere cambios**: el endpoint cae bajo el wildcard existente `POST /messaging/*` que ya está en `[SUPERADMIN, ADMIN, VENTAS]`. LOGISTICA y VIEWER quedan fuera por el wildcard. Si en M6 se decide restringir más (ej. campañas solo ADMIN), se puede agregar una regla específica más restrictiva.

**No modificados (intencional, se hace en M6):**
- `apps/messaging/app/services/campaigns/trigger_service.rb` — el refactor depende de migración `add_template_params_to_campaigns`.
- `apps/messaging/app/models/campaign.rb`.

## Fuera de scope

- Módulo 6 (Campañas Masivas) completo — async trigger, cron, Liquid, CSV, UI.
- Versión Instagram (`send_by_psid` o equivalente) — Instagram no usa phone como identificador.
- Bulk endpoint para enviar a múltiples teléfonos en una request — campañas iteran.
- Renombrar `Campaign#message` o cambiar el modelo de audience de campaign — eso se decide en M6.
