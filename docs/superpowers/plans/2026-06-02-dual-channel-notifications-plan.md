# Plan: Notificaciones duales Push FCM + Email

**Fecha:** 2026-06-02
**Branch:** `feat/email-notifications-refactor`
**Spec:** `docs/superpowers/specs/2026-06-02-dual-channel-notifications-design.md`
**Status:** Listo para ejecutar

## Resumen

Implementación en 4 pasos secuenciales, todos dentro de `apps/messaging` (Rails) + un paso final en `apps/frontend`.

```
Paso 1 → NotificationDispatcher (servicio nuevo + spec)
Paso 2 → FcmListener simplificado (delegar al servicio)
Paso 3 → NotificationSetting + migración (defaults actualizados)
Paso 4 → Frontend dialog (PUSH_CATEGORIES expandido)
```

Cada paso compila y sus tests pasan de forma independiente. El paso 2 depende del 1. Los pasos 3 y 4 son independientes entre sí y del 1-2, pero deben ejecutarse después para que los defaults sean consistentes end-to-end.

---

## Paso 1 — Servicio `NotificationDispatcher`

### 1.1 — Crear el servicio

**Archivo nuevo:** `apps/messaging/app/services/notification_dispatcher.rb`

```ruby
class NotificationDispatcher
  PUSH_TITLES = {
    human_support:  'Conversación requiere soporte humano',
    payment_review: 'Pago pendiente de validar'
  }.freeze

  def initialize(account, conversation, contact_name, flag_name)
    @account      = account
    @conversation = conversation
    @contact_name = contact_name
    @flag_name    = flag_name
  end

  def perform
    offline_ids = fetch_offline_ids
    return if offline_ids.blank?

    settings = NotificationSetting
                 .where(account_id: @account.id, user_id: offline_ids)
                 .index_by { |s| s.user_id.to_s }

    dispatch_push(offline_ids.select { |uid| push_enabled?(settings[uid]) })
    dispatch_email(offline_ids.select { |uid| email_enabled?(settings[uid]) })
  rescue StandardError => e
    Rails.logger.error "[NotificationDispatcher] Error " \
                       "(account_id=#{@account.id}, conversation_id=#{@conversation.id}, " \
                       "flag=#{@flag_name}): #{e.message}"
  end

  private

  def fetch_offline_ids
    all_ids    = @account.account_users.pluck(:user_id).map(&:to_s)
    online_ids = OnlineStatusTracker.get_available_user_ids(@account.id).map(&:to_s)
    all_ids - online_ids
  end

  def push_enabled?(setting) = setting.nil? || setting.push_enabled?(@flag_name)
  def email_enabled?(setting) = setting.nil? || setting.email_enabled?(@flag_name)

  def dispatch_push(eligible_ids)
    return if eligible_ids.blank?

    tokens = PushSubscriptionToken
               .where(account_id: @account.id, user_id: eligible_ids)
               .pluck(:token)
    return if tokens.blank?

    Notifications::SendFcmJob.perform_later(
      tokens: tokens,
      title:  PUSH_TITLES[@flag_name],
      body:   "#{@contact_name}: #{push_body}",
      data: {
        conversation_id: @conversation.id.to_s,
        account_id:      @account.id.to_s,
        click_action:    conversation_url
      }
    )
  end

  def dispatch_email(eligible_ids)
    return if eligible_ids.blank?

    emails = User.where(id: eligible_ids).pluck(:email).compact
    return if emails.blank?

    channel_name = @conversation.inbox&.channel_type&.split('::')&.last

    NotificationMailer.public_send(
      @flag_name,
      emails:           emails,
      contact_name:     @contact_name,
      conversation_url: conversation_url,
      account_name:     @account.name,
      channel_name:     channel_name
    ).deliver_later
  end

  def push_body
    @flag_name == :human_support ? 'necesita atención humana' : 'envió un comprobante de pago'
  end

  def conversation_url
    frontend = ENV.fetch('FRONTEND_URL', 'https://app.ventia-latam.com')
    "#{frontend}/dashboard/conversations?id=#{@conversation.id}"
  end
end
```

### 1.2 — Spec del servicio

**Archivo nuevo:** `apps/messaging/spec/services/notification_dispatcher_spec.rb`

Escenarios a cubrir:

| Contexto | Expectativa |
|---|---|
| Push y email habilitados (default) | Encola `SendFcmJob` + `NotificationMailer` |
| Solo push habilitado (`email_flags: 0`) | Encola `SendFcmJob`, no encola mailer |
| Solo email habilitado (`push_flags: 0`) | Encola mailer, no encola job |
| Ambos deshabilitados | No encola nada |
| Agente online (en `OnlineStatusTracker`) | No recibe ninguna notificación |
| Sin `NotificationSetting` para el agente | Recibe ambos (allow by default) |
| Sin tokens FCM para push-eligible | No lanza excepción, no encola job |
| Sin email registrado para email-eligible | No lanza excepción, no encola mailer |
| `flag_name: :human_support` | Título push = 'Conversación requiere soporte humano' |
| `flag_name: :payment_review` | Título push = 'Pago pendiente de validar' |

Estructura base del spec:

```ruby
require 'rails_helper'

RSpec.describe NotificationDispatcher do
  include ActiveJob::TestHelper

  let(:account)      { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user)         { create(:user, email: "agent-#{SecureRandom.hex(4)}@test.com", ventia_user_id: rand(100_000..999_999)) }
  let(:contact)      { create(:contact, account: account, name: 'Ana Torres') }
  let(:conversation) { create(:conversation, account: account, contact: contact) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }

  before do
    ActiveJob::Base.queue_adapter = :test
    allow(OnlineStatusTracker).to receive(:get_available_user_ids).and_return([])
    create(:push_subscription_token, account: account, user: user, token: 'fcm-token-123')
  end

  subject(:dispatcher) { described_class.new(account, conversation, 'Ana Torres', :human_support) }

  describe '#perform' do
    context 'cuando push y email están habilitados (defaults)' do
      before do
        NotificationSetting.create!(user: user, account: account,
                                    push_flags: NotificationSetting::DEFAULT_PUSH_FLAGS,
                                    email_flags: NotificationSetting::DEFAULT_EMAIL_FLAGS)
      end

      it 'encola SendFcmJob' do
        expect { dispatcher.perform }.to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'encola NotificationMailer' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end
    end

    # ... resto de escenarios
  end
end
```

**Verificar:** `bundle exec rspec spec/services/notification_dispatcher_spec.rb`

---

## Paso 2 — Simplificar `FcmListener`

**Archivo:** `apps/messaging/app/listeners/fcm_listener.rb`

### 2.1 — Actualizar `conversation_labels_updated`

Reemplazar los dos bloques actuales (que llaman `send_email_to_offline_agents`) por llamadas al dispatcher:

```ruby
def conversation_labels_updated(event)
  conversation = event[:data][:conversation]
  labels       = event[:data][:labels]
  account      = conversation.account
  label_titles = labels.map { |l| l[:title] }

  if label_titles.include?('soporte-humano')
    contact_name = conversation.contact&.name || 'Cliente'
    NotificationDispatcher.new(account, conversation, contact_name, :human_support).perform
  end

  if label_titles.include?('en-revisión')
    contact_name = conversation.contact&.name || 'Cliente'
    NotificationDispatcher.new(account, conversation, contact_name, :payment_review).perform
  end
rescue StandardError => e
  Rails.logger.error "[FcmListener] Error in conversation_labels_updated: #{e.message}"
end
```

### 2.2 — Eliminar métodos privados absorbidos por el servicio

Borrar del listener:
- `send_email_to_offline_agents`
- `send_push_to_offline_agents`

> **Nota:** `message_created` sigue usando su propia lógica inline vía `send_push_to_offline_agents`. Al eliminar ese método, `message_created` necesita actualizarse para usar `NotificationDispatcher` también, o bien el dispatcher debe soportar el caso de mensajes normales. Lo más limpio: llamar el dispatcher también desde `message_created` pasando los parámetros de título/body correspondientes — pero eso está fuera del scope de este spec. **Opción pragmática:** conservar `send_push_to_offline_agents` solo para `message_created` y eliminar únicamente `send_email_to_offline_agents`.

### 2.3 — Actualizar `spec/listeners/fcm_listener_spec.rb`

Reemplazar los `have_enqueued_mail(NotificationMailer, ...)` y mocks de `SendFcmJob` por verificación de que `NotificationDispatcher` es instanciado y `perform` es invocado:

```ruby
it 'delega a NotificationDispatcher para soporte humano' do
  dispatcher_double = instance_double(NotificationDispatcher)
  allow(NotificationDispatcher).to receive(:new)
    .with(account, conversation, 'Juan Pérez', :human_support)
    .and_return(dispatcher_double)
  expect(dispatcher_double).to receive(:perform)

  listener.conversation_labels_updated(event)
end
```

**Verificar:** `bundle exec rspec spec/listeners/fcm_listener_spec.rb`

---

## Paso 3 — `NotificationSetting` + Migración

### 3.1 — Actualizar defaults en el modelo

**Archivo:** `apps/messaging/app/models/notification_setting.rb`

```ruby
# Antes:
DEFAULT_PUSH_FLAGS = FLAGS[:message_ai_off] # 4

# Después:
DEFAULT_PUSH_FLAGS = FLAGS[:human_support] | FLAGS[:payment_review] | FLAGS[:message_ai_off] # 7
```

Actualizar también el comentario del bitmask:

```ruby
# Bit 1: human_support — aplica a push_flags Y email_flags
# Bit 2: payment_review — aplica a push_flags Y email_flags
# Bit 4: message_ai_off — solo push_flags
# Bit 8: message_ai_on  — solo push_flags
```

### 3.2 — Crear migración

**Archivo nuevo:** `apps/messaging/db/migrate/20260602000001_restore_push_flags_for_human_support_payment_review.rb`

```ruby
class RestorePushFlagsForHumanSupportPaymentReview < ActiveRecord::Migration[7.2]
  def up
    change_column_default :notification_settings, :push_flags, 7

    execute <<-SQL
      UPDATE messaging.notification_settings
      SET push_flags = push_flags | 3
    SQL
  end

  def down
    change_column_default :notification_settings, :push_flags, 4

    execute <<-SQL
      UPDATE messaging.notification_settings
      SET push_flags = push_flags & ~3
    SQL
  end
end
```

**Aplicar:** `docker exec ventia-messaging bundle exec rails db:migrate`

### 3.3 — Actualizar spec del modelo

**Archivo:** `apps/messaging/spec/models/notification_setting_spec.rb`

Actualizar los tests de defaults:

```ruby
it 'DEFAULT_PUSH_FLAGS incluye human_support, payment_review y message_ai_off (7)' do
  expect(NotificationSetting::DEFAULT_PUSH_FLAGS).to eq(7)
end

it 'create_default_for crea con push_flags=7 y email_flags=3' do
  setting = NotificationSetting.create_default_for(user: user, account: account)
  expect(setting.push_flags).to eq(7)
  expect(setting.email_flags).to eq(3)
end

it 'push_enabled? devuelve true para human_support con defaults' do
  setting = NotificationSetting.create!(user: user, account: account,
                                        push_flags: 7, email_flags: 3)
  expect(setting.push_enabled?(:human_support)).to be true
end
```

**Verificar:** `bundle exec rspec spec/models/notification_setting_spec.rb`

---

## Paso 4 — Frontend: `notification-settings-dialog.tsx`

**Archivo:** `apps/frontend/components/notifications/notification-settings-dialog.tsx`

### 4.1 — Expandir `PUSH_CATEGORIES`

```typescript
const PUSH_CATEGORIES = [
  {
    key: "human_support" as const,
    label: "Soporte humano",
    description: "Cuando una conversación requiere atención humana",
    icon: Users,
  },
  {
    key: "payment_review" as const,
    label: "Revisión de pago",
    description: "Cuando un cliente envía comprobante de pago",
    icon: CreditCard,
  },
  {
    key: "message_ai_off" as const,
    label: "Mensajes (IA apagada)",
    description: "Cuando llega un mensaje con IA desactivada",
    icon: MessageSquare,
  },
  {
    key: "message_ai_on" as const,
    label: "Mensajes (IA encendida)",
    description: "Cuando llega un mensaje con IA activada",
    icon: Bot,
  },
] as const;
```

### 4.2 — Actualizar `DEFAULT_PUSH_FLAGS`

```typescript
const DEFAULT_PUSH_FLAGS: NotificationFlags = {
  human_support: true,
  payment_review: true,
  message_ai_off: true,
  message_ai_on: false,
};
```

### 4.3 — Verificar visualmente

Abrir el dialog de notificaciones y confirmar que la sección "Push" muestra los 4 items con `human_support` y `payment_review` activados por defecto.

---

## Checklist de ejecución

- [ ] **1.1** Crear `app/services/notification_dispatcher.rb`
- [ ] **1.2** Crear `spec/services/notification_dispatcher_spec.rb` — tests pasan
- [ ] **2.1** Actualizar `conversation_labels_updated` en `FcmListener`
- [ ] **2.2** Eliminar `send_email_to_offline_agents` del listener (conservar `send_push_to_offline_agents` para `message_created`)
- [ ] **2.3** Actualizar `spec/listeners/fcm_listener_spec.rb` — tests pasan
- [ ] **3.1** Cambiar `DEFAULT_PUSH_FLAGS` a 7 en el modelo
- [ ] **3.2** Crear y aplicar migración `20260602000001_...`
- [ ] **3.3** Actualizar `spec/models/notification_setting_spec.rb` — tests pasan
- [ ] **4.1** Expandir `PUSH_CATEGORIES` en el dialog
- [ ] **4.2** Actualizar `DEFAULT_PUSH_FLAGS` en el frontend
- [ ] **4.3** Verificar visualmente el dialog
- [ ] Suite completa de specs pasa: `bundle exec rspec`
