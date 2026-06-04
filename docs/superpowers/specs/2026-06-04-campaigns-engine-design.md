# Campaigns Engine — Design (Spec B del Módulo 6)

**Status:** Draft
**Date:** 2026-06-04
**Owner:** Renzo Lenes
**Related:**
- ClickUp "Módulo 6: Campañas Masivas" (este spec cubre la capa backend completa)
- Depende de [`send-by-phone-endpoint`](2026-06-03-send-by-phone-endpoint-design.md) (`Conversations::EnsureFromPhoneService` ya merged)
- UI separada en Spec C (siguiente sesión de brainstorming)

## Resumen

Sistema completo de campañas masivas WhatsApp en `apps/messaging` (Rails + Sidekiq). Soporta dos fuentes de audiencia (CSV upload y labels), variables dinámicas mapeadas via dropdown estructurado (no Liquid), envío async via job-por-recipient con tracking de estado per-destinatario, scheduler cron, retry de fallidos, y endpoints REST para que la UI (Spec C) consuma. Reutiliza `EnsureFromPhoneService` como primitiva de envío.

## Motivación

Hoy `Campaigns::TriggerService` ejecuta envíos síncronamente, sin tracking per-destinatario, sin scheduling, sin soporte de CSV, y duplica internamente la lógica de `EnsureFromPhoneService` (con un bug latente de doble-envío). El modelo `Campaign` no tiene columna `template_params`. La feature está estimada en 20-26h y bloquea uno de los principales casos de uso del producto (re-engaging masivo a clientes).

## Decisiones de diseño (consensuadas)

| Decisión | Elección | Razón |
|---|---|---|
| Partición de specs | B: backend completo, C: UI separado | Backend puede mergear/probar via cURL antes de UI. Reduce surface por PR. |
| Origen de audiencia | CSV upload OR labels (toggle) | Cubre los dos casos reales: datos efímeros únicos vs contactos pre-segmentados |
| Modelo de variables | Dropdown estructurado (CSV columns / Contact attributes), NO Liquid | Curva de aprendizaje cero, validación al vuelo, warnings automáticos por atributo faltante |
| Storage de CSV | Tabla nueva `campaign_recipients` con vars jsonb por fila | Habilita tracking de estado per-destinatario, retry granular, analytics, no se pisa con otras campañas |
| Snapshot de audiencia por label | Al crear la campaña, no al disparar | Predecible: lo que ves en el preview es lo que envía. Patrón de marketing tools |
| Job iteration | Un Sidekiq job por recipient | Fallos aislados, retries automáticos via Sidekiq, status real-time, escala a miles |
| Anti-doble-disparo | Lock + `triggered_at` check + state machine | Mismo patrón que Chatwoot `Campaign.completed!` antes de procesar |
| Atributo faltante en recipient | Omitir del envío (status `:omitted`) | No factura mensajes rotos, lista visible en "Omitidos" en preview |
| `template_params` storage | jsonb en `campaigns` con shape estructurado (no Liquid) | Más simple de validar, no requiere parser Liquid en runtime |
| Header media URL | Fijo por campaña | Per-recipient agrega complejidad. Caso poco frecuente; se difiere |
| Rate limiting | NO (por ahora) | Ticket lo excluye. Sidekiq concurrency es el cap de facto |

## Arquitectura

```
HTTP request (UI Spec C, cURL, Postman)
        │
        ▼
[FastAPI] /api/v1/messaging/campaigns/...
  ├─ Auth (get_current_user_or_api_key) + permission (wildcards existentes)
  └─ Proxy → Rails con tenant_id en header
        │
        ▼
[Rails] /api/v1/campaigns/...
  Controller: Api::V1::CampaignsController (extendido)
  ├─ Validaciones + state machine
  ├─ Lectura/escritura de Campaign, CampaignRecipient
  └─ Invoca services
        │
        ▼
[Services]
  ├─ Campaigns::CsvParser              # parsea + valida CSV upload
  ├─ Campaigns::AudienceSnapshotService # crea recipients desde labels
  ├─ Campaigns::VariableResolver        # resuelve {{N}} para un recipient
  └─ Conversations::EnsureFromPhoneService (existente)
        │
        ▼
[Jobs Sidekiq]
  ├─ Campaigns::TriggerScheduledJob (cron */5)
  ├─ Campaigns::TriggerJob (1 por campaña, snapshot recipients :pending → :queued)
  └─ Campaigns::SendRecipientJob (1 por recipient, llama EnsureFromPhoneService)
        │
        ▼
[Webhook entrante de Meta] (existente)
  └─ Listener nuevo: CampaignRecipientStatusListener
       sincroniza message.status → campaign_recipient.status + contadores
```

## Modelo de datos

### Migración 1: extender `campaigns`

```ruby
add_column :campaigns, :template_params,   :jsonb,   default: {}
add_column :campaigns, :audience_type,     :integer, default: 0       # enum: labels=0, csv=1
add_column :campaigns, :header_media_url,  :string                     # opcional, fijo per-campaña
add_column :campaigns, :recipients_count,  :integer, default: 0
add_column :campaigns, :sent_count,        :integer, default: 0
add_column :campaigns, :failed_count,      :integer, default: 0

# El campaign_status existente extiende su enum:
# active=0, completed=1, paused=2, running=3, draft=4, failed=5
# Y cambia el default a :draft (4) para nuevas campañas
change_column_default :campaigns, :campaign_status, from: 0, to: 4
```

`template_params` shape:

CSV-based:
```json
{
  "name": "imagen_button",
  "language": "es",
  "variables": {
    "1": { "source": "csv_column", "key": "cliente" },
    "2": { "source": "csv_column", "key": "pedido" }
  }
}
```

Labels-based:
```json
{
  "name": "imagen_button",
  "language": "es",
  "variables": {
    "1": { "source": "contact_attribute", "path": "name" },
    "2": { "source": "contact_attribute", "path": "custom_attributes.order_id" }
  }
}
```

### Migración 2: `campaign_recipients`

```ruby
create_table :campaign_recipients do |t|
  t.references :campaign, null: false, foreign_key: true, index: true
  t.references :contact,                 foreign_key: true, index: true   # nullable hasta envío
  t.string  :phone, null: false
  t.jsonb   :vars, default: {}
  t.bigint  :conversation_id
  t.bigint  :message_id
  t.integer :status, default: 0   # pending=0, queued=1, sent=2, delivered=3, read=4, failed=5, omitted=6
  t.text    :external_error
  t.datetime :sent_at, :delivered_at, :read_at
  t.timestamps
end
add_index :campaign_recipients, [:campaign_id, :status]
add_index :campaign_recipients, [:campaign_id, :phone], unique: true
```

## State machine

### Campaign

```
draft ──[trigger ahora / scheduled_at ≤ now]──> active ──[TriggerJob]──> running ──[todos terminales]──> completed
                                                                       │
                                                                       └──[pause]──> paused ──[resume]──> running
                                                                       │
                                                                       └──[crash catastrófico]──> failed
```

| State | Acciones permitidas |
|---|---|
| `:draft` | Editar todo, subir/cambiar audiencia, set variables. NO envía |
| `:active` | Pendiente de disparo (scheduled_at futuro). Solo lectura |
| `:running` | Procesando. Solo `:pause` permitido |
| `:paused` | Recipients `:queued` no se procesan. `:resume` los re-encola |
| `:completed` | Solo lectura. `retry-failed` permitido si hay `:failed` |
| `:failed` | TriggerJob crasheó. Diagnóstico |

### CampaignRecipient

```
pending ──[TriggerJob]──> queued ──[SendRecipientJob]──> sent ──[webhook]──> delivered ──[webhook]──> read
                                              │
                                              ├─[Meta error]──> failed
                                              │
                                              └─[missing attribute]──> omitted (no llega a Meta, no factura)
```

## Endpoints

### Rails (`apps/messaging`)

| Método | Path | Propósito |
|---|---|---|
| POST | `/api/v1/campaigns` | Crear (nombre, inbox_id, template_params parcial) |
| PATCH | `/api/v1/campaigns/:id` | Editar (solo en `:draft`) |
| POST | `/api/v1/campaigns/:id/audience/csv` | Multipart CSV upload, parsea + crea recipients |
| POST | `/api/v1/campaigns/:id/audience/labels` | Body `{label_ids:[]}`, snapshot contacts → recipients |
| GET | `/api/v1/campaigns/:id/preview` | 3 recipients renderizados + omitted samples |
| POST | `/api/v1/campaigns/:id/trigger` | Dispara ahora o programa (segun scheduled_at) |
| POST | `/api/v1/campaigns/:id/retry-failed` | Solo en `:completed`. Re-encola los `:failed` |
| DELETE | `/api/v1/campaigns/:id/recipients/:rid` | Excluir recipient antes de trigger |
| GET | `/api/v1/campaigns/:id/recipients` | Lista paginada con filtros (status, search) |
| GET | `/api/v1/campaigns/:id` | Detalle con stats agregadas |

### FastAPI proxy (`apps/backend`)

Cada endpoint Rails tiene su proxy en `app/api/v1/endpoints/messaging.py`. Permisos heredan de los wildcards existentes (`POST /messaging/*`, `GET /messaging/*`, etc.). CSV upload usa multipart vía el mismo patrón que `send_message_with_file` (messaging_service.py línea 384).

## Servicios

### `Campaigns::CsvParser`

**Input:** archivo CSV (max 5MB), max 10 columnas no-phone, header en fila 1.

**Validaciones:**
- Header debe contener `phone` o `telefono` (case-insensitive, auto-detect)
- Phone E.164 por fila (reutiliza `Conversations::EnsureFromPhoneService::E164_REGEX`)
- Duplicados intra-CSV → mantiene primero, descarta resto con aviso

**Output:** lista de rows válidas + lista de `skipped_rows` con razón.

### `Campaigns::AudienceSnapshotService`

**Input:** campaign + `label_ids: []`

**Logic:** `account.contacts.joins(:labels).where(labels: { id: label_ids }).distinct.where.not(phone_number: nil)`

**Output:** crea N `campaign_recipients` con `contact_id`, `phone`, `vars: {}`.

### `Campaigns::VariableResolver`

**Input:** recipient (con campaign cargado)

**Para cada `{{N}}` en `campaign.template_params.variables`:**
- Si `source: csv_column` → `recipient.vars[key]`
- Si `source: contact_attribute` → resuelve el path con un helper que sigue las claves separadas por `.` recursivamente (ej. `"custom_attributes.order_id"` → `contact.custom_attributes&.dig('order_id')`; `"name"` → `contact.name`). El helper se implementa como método privado del resolver, no método del modelo `Contact`.

**Si cualquier valor es blank/nil → devuelve `:missing_attr` (señal de "omitir")**

**Output:** hash en formato `Whatsapp::TemplateMessageBuilder` (compatible con `processed_params`).

## Jobs Sidekiq

### `Campaigns::TriggerScheduledJob` (cron `*/5 * * * *`)

```ruby
class Campaigns::TriggerScheduledJob < ApplicationJob
  def perform
    Campaign.where(campaign_status: :active, enabled: true, triggered_at: nil)
            .where('scheduled_at <= ?', Time.current)
            .find_each { |c| Campaigns::TriggerJob.perform_later(c.id) }
  end
end
```

Configuración via `config/sidekiq-cron.yml`. Si la gema sidekiq-cron no está instalada todavía, agregarla al Gemfile.

### `Campaigns::TriggerJob` (refactor del existente)

```ruby
def perform(campaign_id)
  Campaign.transaction do
    campaign = Campaign.lock('FOR UPDATE').find_by(id: campaign_id)
    return unless campaign
    return if campaign.triggered_at.present?   # anti-doble-disparo

    campaign.update!(campaign_status: :running, triggered_at: Time.current)
    campaign.campaign_recipients.where(status: :pending).find_each do |r|
      r.update!(status: :queued)
      Campaigns::SendRecipientJob.perform_later(r.id)
    end
  end
end
```

### `Campaigns::SendRecipientJob`

```ruby
def perform(recipient_id)
  recipient = CampaignRecipient.find(recipient_id)
  campaign  = recipient.campaign
  resolved  = Campaigns::VariableResolver.new(recipient).resolve

  if resolved == :missing_attr
    recipient.update!(status: :omitted, external_error: 'missing attribute')
    return
  end

  template_params = campaign.template_params.merge('processed_params' => resolved)
  result = Conversations::EnsureFromPhoneService.new(
    account:         campaign.account,
    inbox:           campaign.inbox,
    phone:           recipient.phone,
    template_params: template_params,
    campaign:        campaign
  ).perform

  recipient.update!(
    contact_id:      result.contact.id,
    conversation_id: result.conversation.id,
    message_id:      result.message.id,
    status:          :sent,
    sent_at:         Time.current
  )
  Campaign.where(id: campaign.id).update_all('sent_count = sent_count + 1, updated_at = NOW()')
end
```

## Webhook → recipient status sync

**Listener nuevo:** `CampaignRecipientStatusListener` suscrito al evento `message.status_updated` (que ya existe en el listener actual).

```ruby
def message_status_updated(event)
  message = event.data[:message]
  recipient = CampaignRecipient.find_by(message_id: message.id)
  return unless recipient

  case message.status.to_sym
  when :delivered then recipient.update!(status: :delivered, delivered_at: Time.current)
  when :read      then recipient.update!(status: :read, read_at: Time.current)
  when :failed    then
    recipient.update!(status: :failed, external_error: message.external_error)
    Campaign.where(id: recipient.campaign_id).update_all('failed_count = failed_count + 1')
  end

  # Si todos los recipients están en estado terminal → campaign :completed
  Campaigns::CompletionChecker.new(recipient.campaign).maybe_complete!
end
```

### `Campaigns::CompletionChecker`

Service helper invocado desde el listener y desde `SendRecipientJob` cuando termina con `:omitted`. Verifica si todos los recipients de la campaña están en estado terminal (`:sent / :delivered / :read / :failed / :omitted`) y, si sí, marca la campaña como `:completed`. Es idempotente: si ya está `:completed` no hace nada.

Implementación: `campaign.campaign_recipients.where(status: [:pending, :queued]).count == 0` → `update!(campaign_status: :completed)`. `:sent`, `:delivered`, `:read`, `:failed`, `:omitted` se consideran todos terminales para el cálculo de completitud (Meta no garantiza delivered/read, así que `:sent` es estado final pragmático aunque el webhook puede seguir actualizándolo después).

## Reglas y validaciones clave

- CSV reemplazable: re-upload borra recipients anteriores. Solo permitido en `:draft`.
- Labels snapshot reemplazable: re-llamada al endpoint borra y rehace.
- Editar template_params: solo en `:draft`.
- Solo inboxes WhatsApp (mismo guard que send-by-phone).
- Trigger:
  - Si `scheduled_at` futuro → marca `:active`, NO encola job (cron lo pica)
  - Si `scheduled_at` nil o pasado → marca `:active` + encola TriggerJob inmediatamente
- Anti-doble-disparo: `with_lock` + check `triggered_at == nil`.
- Header media: si template tiene HEADER IMAGE y `header_media_url` está vacío → 422 al trigger.
- Recipient `:omitted` no se reintenta (requiere fix manual del attribute del contact).
- Si una variable tiene `source: csv_column` pero la column no existe → 422 al guardar template_params.

## Counters y analytics

- **Cached en `campaigns`**: `recipients_count` (set al snapshot), `sent_count`/`failed_count` (incrementados atómicamente con `update_all`).
- **Computed on-demand** (GROUP BY sobre `campaign_recipients` con índice `(campaign_id, status)`): el resto de stats (`delivered`, `read`, `omitted`).
- Endpoint `GET /campaigns/:id` devuelve ambos en `stats` + `rates` calculados.

## Future use: integración con UI (Spec C)

Spec C consumirá estos endpoints siguiendo el wizard de 6 pasos:

1. **Datos básicos** → `POST /campaigns` con `{title, inbox_id, campaign_status: :draft}`
2. **Template** → `PATCH /campaigns/:id` con `template_params: {name, language}`
3. **Audiencia** → `POST /campaigns/:id/audience/(csv|labels)`
4. **Variables** → `PATCH /campaigns/:id` con `template_params.variables: {...}` (dropdown UI)
5. **Preview** → `GET /campaigns/:id/preview`
6. **Schedule** → `POST /campaigns/:id/trigger` con `scheduled_at` opcional

La vista de detalle de campaña post-envío usa `GET /campaigns/:id` + `GET /campaigns/:id/recipients` con filtros.

## Testing

### Rails — unit/service specs

| Archivo | Cubre |
|---|---|
| `spec/services/campaigns/variable_resolver_spec.rb` | CSV vs labels paths, attribute faltante → `:missing_attr`, dig en custom_attributes |
| `spec/services/campaigns/csv_parser_spec.rb` | Auto-detect phone column, normalización E.164, duplicados intra-CSV, header inválido, max columns/size |
| `spec/services/campaigns/audience_snapshot_service_spec.rb` | Snapshot con N contacts, contacts sin phone omitidos, idempotencia |
| `spec/jobs/campaigns/trigger_job_spec.rb` | Lock, anti-doble-disparo, enqueue de hijos, transición `:active → :running` |
| `spec/jobs/campaigns/send_recipient_job_spec.rb` | EnsureFromPhoneService invocado, recipient actualizado, omitted path, counter atómico |
| `spec/jobs/campaigns/trigger_scheduled_job_spec.rb` | Cron filtra activos + scheduled_at, no doble-encola |
| `spec/models/campaign_spec.rb` | State machine, validaciones extendidas |
| `spec/models/campaign_recipient_spec.rb` | Status enum, validación phone, unique index |
| `spec/listeners/campaign_recipient_status_listener_spec.rb` | Status sync via webhook, counter updates |

### Rails — request specs

| Archivo | Endpoint |
|---|---|
| `spec/requests/api/v1/campaigns/create_spec.rb` | POST `/campaigns` |
| `spec/requests/api/v1/campaigns/audience_csv_spec.rb` | Upload con todos los edge cases de validación |
| `spec/requests/api/v1/campaigns/audience_labels_spec.rb` | Snapshot con N contacts, vacío, sin phone |
| `spec/requests/api/v1/campaigns/preview_spec.rb` | 3 samples + omitted samples |
| `spec/requests/api/v1/campaigns/trigger_spec.rb` | Ahora, programado, doble bloqueado |
| `spec/requests/api/v1/campaigns/retry_failed_spec.rb` | Solo en `:completed`, resetea `:failed` |
| `spec/requests/api/v1/campaigns/recipients_index_spec.rb` | Filtros + paginación |

### FastAPI

- `tests/unit/services/test_campaigns_proxy.py` — mock httpx, forwarding payloads + multipart
- `tests/integration/test_campaigns_endpoints.py` — auth + permissions + status code propagation

## Archivos afectados

**Nuevos (Rails):**
- `app/models/campaign_recipient.rb`
- `app/services/campaigns/variable_resolver.rb`
- `app/services/campaigns/csv_parser.rb`
- `app/services/campaigns/audience_snapshot_service.rb`
- `app/services/campaigns/completion_checker.rb`
- `app/jobs/campaigns/send_recipient_job.rb`
- `app/jobs/campaigns/trigger_scheduled_job.rb`
- `app/listeners/campaign_recipient_status_listener.rb`
- `db/migrate/YYYYMMDD_extend_campaigns_for_engine.rb`
- `db/migrate/YYYYMMDD_create_campaign_recipients.rb`
- `config/sidekiq-cron.yml` (nuevo) o entry en config existente
- Specs correspondientes

**Modificados (Rails):**
- `app/models/campaign.rb` — state machine extendida (`:draft`, `:running`, `:failed`), scopes, asociaciones a recipients, contadores
- `app/services/campaigns/trigger_service.rb` — eliminar lógica vieja sync (incluyendo el bug latente de doble-envío), reemplazar por orquestación delgada que llama TriggerJob
- `app/jobs/campaigns/trigger_job.rb` — reemplazar contenido por orquestador con anti-doble-disparo
- `app/controllers/api/v1/campaigns_controller.rb` — acciones nuevas
- `app/listeners/` — el listener actual de `message.status_updated` despacha además a `CampaignRecipientStatusListener`
- `config/routes.rb` — rutas nuevas
- `Gemfile` — agregar `sidekiq-cron` si no está

**Nuevos (FastAPI):**
- Schemas en `app/schemas/messaging.py`: `CampaignCreate`, `CampaignUpdate`, `CampaignVariablesMapping`, `CampaignDetailResponse`, `CampaignRecipientResponse`, `CsvUploadResponse`, `CampaignPreviewResponse`
- Métodos proxy en `app/services/messaging_service.py`
- Endpoints en `app/api/v1/endpoints/messaging.py`
- Tests

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| UI completa | Spec C separado |
| Rate limiting / throttle | Ticket M6 dice "no por ahora". Sidekiq concurrency es el cap de facto |
| Liquid templating | Decidimos dropdown estructurado; si se necesita en el futuro, se agrega como `source: liquid` |
| Instagram support | Identificador (PSID) y send service distintos |
| Cloning de campañas | Iteración futura |
| A/B testing, drip campaigns, sequences | Out of scope. Requieren modelo de pasos |
| Opt-in/opt-out / unsubscribe | Out of scope. Requiere infra de consent |
| Editar campaña en `:running` o `:completed` | Bloqueado por state machine |
| Media headers per-recipient en CSV | Header IMAGE es fijo por campaña |
| Retry automático de `:omitted` | Requieren corrección manual del attribute |
| Frontend wizard / lista / detalle visual | Spec C |
| Campaign cost reporting (más allá de counters) | Iteración futura |
