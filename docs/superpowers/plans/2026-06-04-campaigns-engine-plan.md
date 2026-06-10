# Plan: Campaigns Engine (Spec B del Módulo 6)

**Branch a crear:** `feat/campaigns-engine`
**Spec:** `docs/superpowers/specs/2026-06-04-campaigns-engine-design.md`
**Plan detallado:** se escribirá en `docs/superpowers/plans/2026-06-04-campaigns-engine-plan.md` durante el step 0

## Context

El modelo `Campaign` actual está esquelético: no tiene `template_params`, `audience_type` ni contadores. `Campaigns::TriggerService` ejecuta envíos sync, sin tracking per-destinatario, sin scheduling, sin soporte de CSV, y duplica lógica de `EnsureFromPhoneService` (con un bug latente de doble-envío). El `TriggerJob` existe vacío. No hay cron. No hay listener que sincronice status del webhook → recipient.

Este plan implementa todo el backend del Módulo 6 en `apps/messaging` (Rails + Sidekiq) más sus proxies en FastAPI, dejando los endpoints listos para que el wizard del UI (Spec C, siguiente sesión) los consuma.

## Decisiones clave (ya validadas)

- **CSV ➜ tabla `campaign_recipients`** con tracking de estado per-fila (habilita analytics + retry granular)
- **Audiencia por label = snapshot al crear** la campaña (predecible)
- **Job-per-recipient** (Sidekiq concurrency = de facto rate limit)
- **Variables = estructura dropdown** (no Liquid): `{source: csv_column|contact_attribute, key|path}`
- **Atributo faltante = `:omitted`** (no factura, lista visible en preview)
- **Reutilizar `Conversations::EnsureFromPhoneService`** como primitiva de envío (1 contacto por vez)
- **Header media URL fijo por campaña** (no per-recipient)
- **Permisos**: heredan de wildcards existentes en `permissions.py` — sin cambios

## Implementación en 14 pasos

### Paso 0 — Branch + plan detallado + gem

- Crear branch `feat/campaigns-engine` desde `development`
- Agregar `gem 'sidekiq-cron', '~> 2.0'` al Gemfile de `apps/messaging`, `bundle install`
- Escribir `docs/superpowers/plans/2026-06-04-campaigns-engine-plan.md` con la versión detallada de este plan (mismo formato que `2026-06-03-send-by-phone-endpoint-plan.md` ya en repo)

### Paso 1 — Migración 1: extender `campaigns`

**Nuevo:** `db/migrate/YYYYMMDDHHMMSS_extend_campaigns_for_engine.rb`

```ruby
class ExtendCampaignsForEngine < ActiveRecord::Migration[7.2]
  def change
    add_column :campaigns, :template_params,  :jsonb,   default: {}
    add_column :campaigns, :audience_type,    :integer, default: 0
    add_column :campaigns, :header_media_url, :string
    add_column :campaigns, :recipients_count, :integer, default: 0
    add_column :campaigns, :sent_count,       :integer, default: 0
    add_column :campaigns, :failed_count,     :integer, default: 0
    change_column_default :campaigns, :campaign_status, from: 0, to: 4
  end
end
```

**Verificar:** `bundle exec rails db:migrate` (entorno dev/test). Confirmar shape via `Campaign.column_names`.

### Paso 2 — Migración 2: `campaign_recipients`

**Nuevo:** `db/migrate/YYYYMMDDHHMMSS_create_campaign_recipients.rb`

Shape exacto del spec: FK a campaign + contact (nullable), phone E.164, vars jsonb, conversation_id / message_id (no FK formal — los rieles de webhooks no garantizan orden), status enum, external_error, sent_at/delivered_at/read_at, índices `(campaign_id, status)` + `(campaign_id, phone)` UNIQUE.

**Verificar:** `bundle exec rails db:migrate` + `CampaignRecipient.count` desde consola Rails.

### Paso 3 — Modelo `CampaignRecipient` + extender `Campaign`

**Nuevo:** `app/models/campaign_recipient.rb`

```ruby
class CampaignRecipient < ApplicationRecord
  belongs_to :campaign
  belongs_to :contact, optional: true

  enum :status, {
    pending: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: 5, omitted: 6
  }

  validates :phone, presence: true, format: { with: Conversations::EnsureFromPhoneService::E164_REGEX }
  validates :phone, uniqueness: { scope: :campaign_id }

  scope :terminal, -> { where(status: [:sent, :delivered, :read, :failed, :omitted]) }
  scope :pending_or_queued, -> { where(status: [:pending, :queued]) }
end
```

**Modificar:** `app/models/campaign.rb`
- Extender enum: agregar `running: 3, draft: 4, failed: 5`
- `has_many :campaign_recipients, dependent: :destroy`
- `enum :audience_type, { labels: 0, csv: 1 }`
- Scope `triggerable` (active + enabled + triggered_at nil + scheduled_at <= now)
- Validación: `inbox.channel` debe ser Whatsapp (ya existe)
- Helper: `terminal_recipients_count`, `all_recipients_terminal?`

**Specs:** `spec/models/campaign_recipient_spec.rb` (status enum, validaciones, scopes), `spec/models/campaign_spec.rb` (state machine, asociaciones).

**Verificar:** `bundle exec rspec spec/models/campaign{,_recipient}_spec.rb`

### Paso 4 — Service: `Campaigns::CsvParser`

**Nuevo:** `app/services/campaigns/csv_parser.rb`

Input: `tempfile + encoding`. Output: struct `Result(rows: [{phone:, vars: {}}], skipped: [{row:, phone:, reason:}], detected_columns: [])`.

- Usa Ruby `CSV` stdlib (no gem extra)
- Auto-detect delimiter `,` vs `;`
- Header normalize (lowercase, strip)
- Phone column detect: primera columna que matchea `/^(phone|telefono|tel|celular)$/i`
- Validar phone E.164 reusando `EnsureFromPhoneService::E164_REGEX`
- Max 10 columnas no-phone (raise `TooManyColumnsError`)
- Max 5MB (validar antes, en el controller)
- Duplicados intra-CSV: mantener primero (track set de phones vistos)

**Spec:** `spec/services/campaigns/csv_parser_spec.rb` con matriz de casos del cuadro de validación del spec.

**Verificar:** `bundle exec rspec spec/services/campaigns/csv_parser_spec.rb`

### Paso 5 — Service: `Campaigns::AudienceSnapshotService`

**Nuevo:** `app/services/campaigns/audience_snapshot_service.rb`

Input: `campaign + label_ids: []`. Side effect: borra recipients existentes (solo si `campaign.draft?`), crea N nuevos. Output: `recipients_count`.

```ruby
account.contacts
  .joins(:labels).where(labels: { id: label_ids })
  .where.not(phone_number: nil)
  .distinct
  .find_each do |contact|
    campaign.campaign_recipients.create!(
      contact: contact, phone: contact.phone_number, vars: {}, status: :pending
    )
  end
```

**Spec:** `spec/services/campaigns/audience_snapshot_service_spec.rb` (N contactos, sin phone omitidos, idempotencia al re-llamar).

### Paso 6 — Service: `Campaigns::VariableResolver`

**Nuevo:** `app/services/campaigns/variable_resolver.rb`

Input: `recipient`. Output: hash con shape `{ body: { "1" => "Juan", "2" => "ORD-12345" } }` (compatible con `Whatsapp::TemplateMessageBuilder#processed_params`) **OR** `:missing_attr` symbol.

```ruby
def resolve
  body_params = campaign.template_params['variables'].each_with_object({}) do |(idx, mapping), acc|
    value = case mapping['source']
            when 'csv_column'        then recipient.vars[mapping['key']]
            when 'contact_attribute' then dig_contact_path(mapping['path'])
            end
    return :missing_attr if value.blank?
    acc[idx] = value
  end
  result = { 'body' => body_params }
  result['header'] = campaign_header_params if campaign.header_media_url.present?
  result
end

private

def dig_contact_path(path)
  parts = path.split('.')
  parts.reduce(recipient.contact) do |obj, key|
    return nil if obj.nil?
    if obj.is_a?(Hash) then obj[key]
    elsif obj.respond_to?(key) then obj.public_send(key)
    else nil
    end
  end
end
```

`campaign_header_params` devuelve `{ media_url:, media_type: 'image' }` derivado de `campaign.header_media_url`.

**Spec:** `spec/services/campaigns/variable_resolver_spec.rb` con matriz: CSV vs labels, dig profundo en `custom_attributes`, blank value → `:missing_attr`, header opcional.

### Paso 7 — Service: `Campaigns::CompletionChecker`

**Nuevo:** `app/services/campaigns/completion_checker.rb`

```ruby
class Campaigns::CompletionChecker
  def initialize(campaign)
    @campaign = campaign
  end

  def maybe_complete!
    return if @campaign.completed?
    return if @campaign.campaign_recipients.pending_or_queued.exists?

    @campaign.update!(campaign_status: :completed)
    @campaign.broadcast(:campaign_completed, data: { campaign: @campaign })
  end
end
```

**Spec:** `spec/services/campaigns/completion_checker_spec.rb` (idempotente, no marca si quedan pendientes, dispara broadcast).

### Paso 8 — Job: `Campaigns::SendRecipientJob`

**Nuevo:** `app/jobs/campaigns/send_recipient_job.rb`

```ruby
class Campaigns::SendRecipientJob < ApplicationJob
  queue_as :campaigns

  def perform(recipient_id)
    recipient = CampaignRecipient.find(recipient_id)
    campaign  = recipient.campaign
    resolved  = Campaigns::VariableResolver.new(recipient).resolve

    if resolved == :missing_attr
      recipient.update!(status: :omitted, external_error: 'missing required attribute')
      Campaigns::CompletionChecker.new(campaign).maybe_complete!
      return
    end

    template_params = campaign.template_params.merge('processed_params' => resolved)
    result = Conversations::EnsureFromPhoneService.new(
      account: campaign.account, inbox: campaign.inbox,
      phone: recipient.phone, template_params: template_params,
      campaign: campaign
    ).perform

    recipient.update!(
      contact_id:      result.contact.id,
      conversation_id: result.conversation.id,
      message_id:      result.message.id,
      status:          :sent,
      sent_at:         Time.current
    )
    Campaign.where(id: campaign.id).update_all('sent_count = sent_count + 1, updated_at = NOW()')
  rescue Conversations::EnsureFromPhoneService::InvalidPhoneError,
         Whatsapp::TemplateMessageBuilder::TemplateNotFound,
         Whatsapp::TemplateMessageBuilder::MissingBodyVariables => e
    recipient.update!(status: :failed, external_error: e.message)
    Campaign.where(id: campaign.id).update_all('failed_count = failed_count + 1')
    Campaigns::CompletionChecker.new(campaign).maybe_complete!
  end
end
```

**Spec:** `spec/jobs/campaigns/send_recipient_job_spec.rb` — happy path, omitted, failure de builder, contadores atómicos.

### Paso 9 — Job: refactor `Campaigns::TriggerJob`

**Modificar:** `app/jobs/campaigns/trigger_job.rb` (existente, contenido se reemplaza)

```ruby
class Campaigns::TriggerJob < ApplicationJob
  queue_as :campaigns

  def perform(campaign_id)
    Campaign.transaction do
      campaign = Campaign.lock('FOR UPDATE').find_by(id: campaign_id)
      return unless campaign
      return if campaign.triggered_at.present?

      campaign.update!(campaign_status: :running, triggered_at: Time.current)
      campaign.campaign_recipients.where(status: :pending).find_each do |r|
        r.update!(status: :queued)
        Campaigns::SendRecipientJob.perform_later(r.id)
      end
    end
  rescue StandardError => e
    Rails.logger.error "[Campaigns] TriggerJob failed for campaign #{campaign_id}: #{e.message}"
    Campaign.where(id: campaign_id).update_all(campaign_status: Campaign.campaign_statuses[:failed])
    raise
  end
end
```

**Spec:** `spec/jobs/campaigns/trigger_job_spec.rb` — anti-doble-disparo (segundo run con `triggered_at` no-nil no hace nada), enqueue N hijos, transición `:active → :running`, crash → `:failed`.

### Paso 10 — Job: `Campaigns::TriggerScheduledJob` + cron config

**Nuevo:** `app/jobs/campaigns/trigger_scheduled_job.rb`

```ruby
class Campaigns::TriggerScheduledJob < ApplicationJob
  queue_as :scheduled

  def perform
    Campaign.where(campaign_status: :active, enabled: true, triggered_at: nil)
            .where('scheduled_at <= ?', Time.current)
            .find_each { |c| Campaigns::TriggerJob.perform_later(c.id) }
  end
end
```

**Nuevo:** `config/sidekiq-cron.yml`

```yaml
trigger_scheduled_campaigns:
  cron: '*/5 * * * *'
  class: 'Campaigns::TriggerScheduledJob'
  queue: scheduled
```

**Modificar:** `config/initializers/sidekiq.rb` (o crear) — cargar el yaml de sidekiq-cron en `Sidekiq.configure_server`.

**Spec:** `spec/jobs/campaigns/trigger_scheduled_job_spec.rb` — filtra correctamente (active + scheduled_at <= now), no encola si `triggered_at` ya está, respeta `enabled`.

### Paso 11 — Listener: `CampaignRecipientStatusListener`

**Nuevo:** `app/listeners/campaign_recipient_status_listener.rb`

```ruby
class CampaignRecipientStatusListener < BaseListener
  def message_updated(event)
    message = event.data[:message]
    changed = event.data[:changed_attributes]
    return unless changed.key?('status')

    recipient = CampaignRecipient.find_by(message_id: message.id)
    return unless recipient

    case message.status.to_sym
    when :delivered then recipient.update!(status: :delivered, delivered_at: Time.current)
    when :read      then recipient.update!(status: :read,      read_at: Time.current)
    when :failed
      recipient.update!(status: :failed, external_error: message.external_error)
      Campaign.where(id: recipient.campaign_id).update_all('failed_count = failed_count + 1')
    end

    Campaigns::CompletionChecker.new(recipient.campaign).maybe_complete!
  end
end
```

**Modificar:** `config/initializers/wisper.rb` (o donde se registran listeners) — agregar `Message.subscribe(CampaignRecipientStatusListener.new)`.

**Spec:** `spec/listeners/campaign_recipient_status_listener_spec.rb` — webhook dispara update, contadores incrementan, no afecta a messages que no son de campaigns.

### Paso 12 — Controller: extender `CampaignsController` + rutas

**Modificar:** `app/controllers/api/v1/campaigns_controller.rb`

Acciones nuevas (las existentes se preservan, algunas cambian default):
- `create` — set `campaign_status: :draft` por default
- `update` — bloquear si no es `:draft` (422)
- `upload_csv` — multipart, valida tamaño 5MB, delega a `Campaigns::CsvParser`, crea recipients, devuelve `{recipients_count, columns, skipped_rows}`
- `set_labels_audience` — body `{label_ids: []}`, delega a `AudienceSnapshotService`
- `preview` — selecciona 3 recipients (primer, random medio, último), corre `VariableResolver` por cada uno, renderiza con `Whatsapp::TemplateMessageBuilder`
- `trigger` — sólo si `:draft`. Si `scheduled_at` futuro → `:active`, NO encola. Si nil/pasado → `:active` + `TriggerJob.perform_later`
- `retry_failed` — solo si `:completed`. Resetea recipients `:failed` → `:pending`, encola `TriggerJob`
- `recipients` (index) — paginación + filtros `status`, `search`
- `destroy_recipient` (DELETE) — solo si `:draft`

**Modificar:** `config/routes.rb` — agregar las rutas nuevas al `resources :campaigns` existente.

**Specs:** un archivo por acción nueva en `spec/requests/api/v1/campaigns/*_spec.rb` siguiendo el patrón de headers de `no_purchase_reason_spec.rb` (X-Tenant-Id + X-API-Key + ENV stub).

### Paso 13 — FastAPI proxy

**Modificar:** `apps/backend/app/schemas/messaging.py` — agregar schemas Pydantic para todos los requests/responses nuevos.

**Modificar:** `apps/backend/app/services/messaging_service.py` — métodos proxy nuevos:
- `create_campaign`, `update_campaign`, `upload_campaign_csv` (multipart, espejo de `send_message_with_file`), `set_campaign_labels_audience`, `preview_campaign`, `trigger_campaign`, `retry_failed_campaign`, `list_campaign_recipients`, `delete_campaign_recipient`, `get_campaign_detail`

**Modificar:** `apps/backend/app/api/v1/endpoints/messaging.py` — endpoints nuevos espejo de los Rails, con `require_permission_dual` heredando wildcards existentes. CSV upload usa multipart como `send_message_with_file`.

**Nuevos tests:**
- `tests/unit/services/test_campaigns_proxy.py` — mock `_request`, verifica forwarding (incluyendo multipart)
- Skip integration HTTP tests por la misma razón del send-by-phone PR (no hay infra de auth-mocked TestClient)

### Paso 14 — Verificación end-to-end

1. **Suite Rails completa:** `cd apps/messaging && bundle exec rspec`
2. **Suite backend completa:** `cd apps/backend && uv run pytest`
3. **Smoke test cURL contra docker/local** (labels-based, template sin variables):
   ```bash
   # Crear campaña
   curl -X POST http://localhost:8000/api/v1/messaging/campaigns \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"title":"smoke","inbox_id":1,"template_params":{"name":"jockey","language":"es","variables":{}}}'
   # → devuelve campaign_id, status :draft

   # Set audiencia (label de prueba)
   curl -X POST .../campaigns/:id/audience/labels -d '{"label_ids":[1]}'

   # Preview
   curl .../campaigns/:id/preview

   # Trigger ahora
   curl -X POST .../campaigns/:id/trigger
   # → status :active, TriggerJob encolado, recipients procesándose

   # Detail post-envío (espera ~10s)
   curl .../campaigns/:id
   # → status :completed, stats con sent_count
   ```
4. **Verificar UI manual** que la conversación aparezca en el dashboard del agente para cada recipient (ya está validado por el endpoint base de send-by-phone)
5. **PR** con referencia al spec

## Patrones reutilizados (validados en exploración)

| Pieza | Origen | Uso |
|---|---|---|
| `Conversations::EnsureFromPhoneService` | `apps/messaging/app/services/conversations/ensure_from_phone_service.rb` | Primitiva de envío de cada recipient (ya merged) |
| `Conversations::EnsureFromPhoneService::E164_REGEX` | mismo archivo | Validación de phones en CSV + model `CampaignRecipient` |
| `Whatsapp::TemplateMessageBuilder` | `apps/messaging/app/services/whatsapp/template_message_builder.rb` | Renderizado en preview + en envío real (via callback) |
| Patrón listener Wisper | `apps/messaging/app/listeners/base_listener.rb` + `webhook_listener.rb` | `CampaignRecipientStatusListener#message_updated` |
| `message.broadcast(:message_updated, ...)` | `apps/messaging/app/models/message.rb:152` (existente, no tocar) | Trigger del listener nuevo |
| `render_success / render_error` | `apps/messaging/app/controllers/api/v1/base_controller.rb:39-55` | Response wrapping |
| Patrón de headers en request specs | `apps/messaging/spec/requests/api/v1/conversations/no_purchase_reason_spec.rb:13-23` | X-Tenant-Id + X-API-Key |
| `messaging_service._request` | `apps/backend/app/services/messaging_service.py:51` | Proxy HTTP hacia Rails |
| `messaging_service.send_message_with_file` | `apps/backend/app/services/messaging_service.py:384` | Patrón multipart para CSV upload |
| Wildcards `POST/GET/PATCH/DELETE /messaging/*` | `apps/backend/app/core/permissions.py:82-87` | Cubren todos los endpoints nuevos sin cambios |

## Fuera de scope (intencional)

- UI = Spec C, próxima sesión
- Rate limiting / throttle (ticket M6 lo excluye)
- Liquid templating (decidimos dropdown estructurado)
- Instagram support (otro identificador)
- Tests HTTP integration FastAPI (no hay infra auth-mocked TestClient — misma decisión que send-by-phone)
- Cloning / "duplicar campaña"
- A/B testing, drip, sequences, opt-in/out
- Editar campañas en `:running` / `:completed` (state machine lo bloquea)
- Media headers per-recipient (header IMAGE fijo por campaña)
- Retry automático de `:omitted` (requieren corrección manual)
