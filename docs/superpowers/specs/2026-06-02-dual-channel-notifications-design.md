# Spec: Notificaciones duales (Push FCM + Email) para soporte humano y revisión de pago

**Fecha:** 2026-06-02
**Rama:** `feat/email-notifications-refactor`
**Alcance:** `apps/messaging` (Rails) + `apps/frontend` (Next.js)

---

## Contexto

En la rama actual, las notificaciones push FCM para los eventos `soporte-humano` y `en-revisión` fueron reemplazadas por email (Resend). El objetivo de este cambio es **restaurar push FCM** para esos eventos manteniéndolos como canal independiente del email: el agente puede activar/desactivar cada canal por separado.

Adicionalmente, se introduce el servicio `NotificationDispatcher` que unifica la lógica de despacho y elimina la doble query a DB que ocurriría si los dos canales se gestionaran con métodos separados.

---

## Arquitectura

```
FcmListener#conversation_labels_updated
  └── NotificationDispatcher.new(account, conversation, contact_name, flag_name).perform
        ├── fetch_offline_ids          → 1 query (account_users + OnlineStatusTracker)
        ├── NotificationSetting batch  → 1 query (todos los offline_ids a la vez)
        ├── push_eligible → dispatch_push  → SendFcmJob
        └── email_eligible → dispatch_email → NotificationMailer#deliver_later
```

El `FcmListener` queda como orquestador delgado. Toda la lógica de despacho vive en el servicio.

---

## Componentes

### 1. `app/services/notification_dispatcher.rb` (nuevo)

Clase con constructor injection y método `perform`.

**Responsabilidades:**
- Calcular `offline_ids` una sola vez (`all_agent_ids - online_ids`).
- Cargar `NotificationSetting` en batch (una query, `index_by user_id`).
- Filtrar `push_eligible` con `push_enabled?(flag_name)`.
- Filtrar `email_eligible` con `email_enabled?(flag_name)`.
- Llamar `dispatch_push` y `dispatch_email` de forma independiente (el fallo de uno no cancela el otro).
- Un único `rescue StandardError` en `perform` para loggear errores sin traer abajo el listener.

**Constante:**
```ruby
PUSH_TITLES = {
  human_support:  'Conversación requiere soporte humano',
  payment_review: 'Pago pendiente de validar'
}.freeze
```

**`dispatch_push`:** consulta `PushSubscriptionToken` para los push-eligible, llama `Notifications::SendFcmJob.perform_later` con tokens, título, cuerpo y `click_action` apuntando a la conversación.

**`dispatch_email`:** consulta `User#email` para los email-eligible, llama `NotificationMailer.public_send(flag_name, ...).deliver_later`.

Ambos métodos retornan temprano (`return if eligible.blank?` / `return if tokens/emails.blank?`) sin lanzar excepciones.

---

### 2. `app/listeners/fcm_listener.rb` (modificado)

`conversation_labels_updated` delega a `NotificationDispatcher`:

```ruby
if label_titles.include?('soporte-humano')
  contact_name = conversation.contact&.name || 'Cliente'
  NotificationDispatcher.new(account, conversation, contact_name, :human_support).perform
end

if label_titles.include?('en-revisión')
  contact_name = conversation.contact&.name || 'Cliente'
  NotificationDispatcher.new(account, conversation, contact_name, :payment_review).perform
end
```

Se eliminan los métodos privados `send_push_to_offline_agents` y `send_email_to_offline_agents` del listener.

---

### 3. `app/models/notification_setting.rb` (modificado)

```ruby
DEFAULT_PUSH_FLAGS  = FLAGS[:human_support] | FLAGS[:payment_review] | FLAGS[:message_ai_off] # 7
DEFAULT_EMAIL_FLAGS = FLAGS[:human_support] | FLAGS[:payment_review] # 3 (sin cambio)
```

El comentario del bitmask se actualiza para reflejar que `human_support` (bit 1) y `payment_review` (bit 2) aplican a **ambas** columnas.

---

### 4. Migración (nueva)

Nombre: `restore_push_flags_for_human_support_payment_review`

```sql
-- up
UPDATE messaging.notification_settings SET push_flags = push_flags | 3;
-- (change_column_default push_flags → 7)

-- down
UPDATE messaging.notification_settings SET push_flags = push_flags & ~3;
-- (change_column_default push_flags → 4)
```

---

### 5. Frontend — `notification-settings-dialog.tsx` (modificado)

`PUSH_CATEGORIES` pasa de 2 a 4 entradas, agregando `human_support` y `payment_review`:

```typescript
const PUSH_CATEGORIES = [
  { key: "human_support",  label: "Soporte humano",        description: "Cuando una conversación requiere atención humana", icon: Users },
  { key: "payment_review", label: "Revisión de pago",      description: "Cuando un cliente envía comprobante de pago",       icon: CreditCard },
  { key: "message_ai_off", label: "Mensajes (IA apagada)", description: "Cuando llega un mensaje con IA desactivada",        icon: MessageSquare },
  { key: "message_ai_on",  label: "Mensajes (IA encendida)", description: "Cuando llega un mensaje con IA activada",         icon: Bot },
] as const;
```

`DEFAULT_PUSH_FLAGS` en el cliente:
```typescript
const DEFAULT_PUSH_FLAGS: NotificationFlags = {
  human_support: true, payment_review: true, message_ai_off: true, message_ai_on: false,
};
```

El dialog resultante muestra en **"Por email"**: soporte humano + revisión de pago. En **"Push"**: soporte humano + revisión de pago + mensajes IA apagada + mensajes IA encendida. Cada toggle es independiente.

---

## Flujo de datos (happy path)

1. Chatwoot emite evento `conversation_labels_updated` con label `soporte-humano`.
2. `FcmListener` extrae `conversation`, `account`, `contact_name` y llama `NotificationDispatcher.new(..., :human_support).perform`.
3. Dispatcher calcula `offline_ids` (1 query).
4. Dispatcher carga `NotificationSetting` batch (1 query).
5. Para cada offline_id:
   - `push_enabled?(:human_support)` → si true, va a `push_eligible`
   - `email_enabled?(:human_support)` → si true, va a `email_eligible`
6. Si `push_eligible` no está vacío: busca tokens FCM → `SendFcmJob.perform_later`.
7. Si `email_eligible` no está vacío: busca emails → `NotificationMailer.human_support(...).deliver_later`.
8. Sidekiq procesa ambos jobs de forma asíncrona.

---

## Manejo de errores

- Sin `NotificationSetting` para un agente → se trata como "todos los canales habilitados" (allow by default).
- Sin tokens FCM para un push-eligible → `dispatch_push` retorna sin error.
- Sin email para un email-eligible → `dispatch_email` retorna sin error.
- Excepción en cualquier punto del `perform` → loggea con `account_id`, `conversation_id` y `flag_name`, no propaga.

---

## Testing

### `spec/services/notification_dispatcher_spec.rb` (nuevo)

| Escenario | Expectativa |
|---|---|
| Push y email habilitados | Encola `SendFcmJob` + `NotificationMailer` |
| Solo push habilitado | Encola `SendFcmJob`, no encola mailer |
| Solo email habilitado | Encola mailer, no encola job |
| Ambos deshabilitados | No encola nada |
| Agente online | No recibe ninguna notificación |
| Sin `NotificationSetting` (nil) | Recibe ambos canales (allow by default) |
| Sin tokens FCM para push-eligible | No lanza excepción |
| Sin email para email-eligible | No lanza excepción |

### `spec/listeners/fcm_listener_spec.rb` (actualizado)

Reemplazar mocks de `NotificationMailer` / `SendFcmJob` por verificación de que `NotificationDispatcher` es instanciado y `perform` es llamado con los argumentos correctos.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `app/services/notification_dispatcher.rb` | Nuevo |
| `app/listeners/fcm_listener.rb` | Simplificar `conversation_labels_updated`, eliminar 2 métodos privados |
| `app/models/notification_setting.rb` | `DEFAULT_PUSH_FLAGS` 4 → 7 |
| `db/migrate/20260602000001_restore_push_flags_for_human_support_payment_review.rb` | Nueva migración |
| `spec/services/notification_dispatcher_spec.rb` | Nuevo |
| `spec/listeners/fcm_listener_spec.rb` | Actualizar mocks |
| `apps/frontend/components/notifications/notification-settings-dialog.tsx` | Expandir `PUSH_CATEGORIES` y `DEFAULT_PUSH_FLAGS` |

**No se modifican:** `NotificationMailer`, templates ERB, `NotificationSettingsController`, specs de mailer.
