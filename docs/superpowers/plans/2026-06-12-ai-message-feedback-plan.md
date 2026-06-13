# Plan: Feedback (like/dislike) en mensajes de IA

**Branch:** `feat/ux-ai-message-feedback` (ya creada, HEAD actual).
**Spec:** `docs/superpowers/specs/2026-06-12-ai-message-feedback-design.md`

## Context

Agentes del dashboard evalúan con 👍/👎 las respuestas del bot/IA. El dislike
exige comentario; el like no lleva comentario. Modelo **uno por (mensaje,
agente)** (índice único `(message_id, user_id)`). Se expone un **export JSONL**
(solo ADMIN/SUPERADMIN) para construir el dataset.

Flujo de datos existente reutilizado:
**Frontend (Next route) → FastAPI (`messaging.py`) → Rails**, propagando
`X-Tenant-Id` / `X-User-Id`.

## Decisiones clave (ya validadas)

- Tabla dedicada `messaging.message_feedbacks` (no jsonb) → dataset consultable.
- Único por `(message_id, user_id)`; la burbuja muestra el voto del agente actual.
- `rating` enum `{ dislike: 0, like: 1 }`. `comment` obligatorio en dislike, `nil` en like.
- Solo mensajes de IA (`outgoing` + `sender` nil + sin `external_echo`) → si no, 422.
- Re-click en el voto activo propio → DELETE (neutral).
- Export solo ADMIN/SUPERADMIN; una fila por voto (con `user_id`); `context` = N mensajes previos (default 6).
- Sin broadcast WS del feedback (update optimista local; otros lo ven al recargar).

## Patrones reutilizados

| Pieza | Origen | Uso |
|---|---|---|
| Migración Rails | `db/migrate/20260606001924_create_notes.rb` | Mismo estilo `ActiveRecord::Migration[7.2]`, schema `messaging.` |
| Serializer mensaje | `messages_controller.rb#message_json` (+ `feedback_lookup` como `quoted_lookup`) | Añadir clave `feedback` |
| Lookup batch anti-N+1 | `messages_controller.rb#build_quoted_lookup` | Mismo patrón para feedback del agente actual |
| Controller REST + `render_success/render_error` | `Api::V1::BaseController`, `messages_controller.rb` | Nuevo `MessageFeedbacksController` |
| Proxy + headers `X-Tenant-Id/X-User-Id` | `apps/backend/app/services/messaging_service.py#_headers` | Nuevos métodos proxy |
| Permiso dual ADMIN/SUPERADMIN | `apps/backend/app/core/permissions.py` | Restringir export |
| Route handler proxy | `app/api/messaging/contacts/[id]/notes/route.ts` | Plantilla PUT/DELETE/GET |
| Botón hover en burbuja | `message-bubble.tsx` (botón "Responder") | Mismo patrón de hover/touch para 👍/👎 |
| `getSenderRole()` | `lib/utils/messaging.ts` | Gate de "solo IA" en el frontend |

**Cosas que hay que crear (no existen):**
- `MessageFeedback` modelo + migración + `MessageFeedbacksController` + specs.
- Endpoints export en Rails y proxy FastAPI.
- `MessageFeedbackControls` componente frontend + tests.
- Tipo `MessageFeedback` y campo `feedback` en `Message` (frontend types).

---

## Implementación

### Paso 1 — Rails: migración

`apps/messaging/db/migrate/<timestamp>_create_message_feedbacks.rb`:

```ruby
class CreateMessageFeedbacks < ActiveRecord::Migration[7.2]
  def change
    create_table :message_feedbacks do |t|
      t.references :message,      null: false, foreign_key: true, index: false
      t.bigint     :account_id,   null: false
      t.bigint     :conversation_id, null: false
      t.bigint     :user_id,      null: false
      t.integer    :rating,       null: false  # 0 dislike, 1 like
      t.text       :comment
      t.timestamps
    end

    add_index :message_feedbacks, [:message_id, :user_id], unique: true
    add_index :message_feedbacks, :account_id
    add_index :message_feedbacks, :conversation_id
    add_index :message_feedbacks, [:account_id, :rating, :created_at] # export/analítica
  end
end
```

Aplicar en development + test. Confirmar el `schema: messaging` que usan las demás
tablas (revisar `create_notes` para el prefijo correcto; replicar tal cual).

### Paso 2 — Rails: modelo `MessageFeedback`

`apps/messaging/app/models/message_feedback.rb`:

- `belongs_to :message`, `:account`, `:conversation`, `:user`.
- `enum rating: { dislike: 0, like: 1 }`.
- `before_validation`: si `like?` → `self.comment = nil`.
- Validaciones:
  - `rating` presente.
  - `comment` presente (no blank) cuando `dislike?`.
  - unicidad de `user_id` scoped a `message_id`.
- En `Message` (`message.rb`): `has_one :message_feedback?` **no** — usaremos
  `has_many :message_feedbacks, dependent: :destroy` (varios agentes). El de un
  agente concreto se resuelve por query (no asociación singular).

### Paso 3 — Rails: rutas

En `config/routes.rb`, dentro del bloque `resources :messages`:

```ruby
resources :messages, only: [:index, :create] do
  collection { get :search }
  member do
    put    :feedback, to: 'message_feedbacks#upsert'
    delete :feedback, to: 'message_feedbacks#destroy'
  end
end
```

Y a nivel de cuenta (fuera de conversations), para el export:

```ruby
resources :message_feedbacks, only: [] do
  collection { get :export }
end
```

### Paso 4 — Rails: `MessageFeedbacksController`

`apps/messaging/app/controllers/api/v1/message_feedbacks_controller.rb` (hereda
`Api::V1::BaseController`):

- `before_action :set_conversation` y `:set_message` (solo upsert/destroy).
- **`upsert`** (PUT):
  - Validar que `@message` sea de IA con un predicado nuevo `Message#ai_generated?`
    (`outgoing? && sender_id.nil? && !external_echo?`). Si no → `render_error(..., :unprocessable_entity)`.
  - `fb = MessageFeedback.find_or_initialize_by(message: @message, user_id: current_user.id)`.
  - `fb.assign_attributes(account: current_account, conversation: @conversation, rating:, comment:)`.
  - `fb.save` → `render_success(feedback_json(fb))`; si no → 422 con errores
    (cubre "dislike sin comentario").
- **`destroy`** (DELETE): borra el feedback del agente actual sobre `@message`
  (`MessageFeedback.where(message: @message, user_id: current_user.id).destroy_all`),
  `render_success({})`.
- Params: `permit(:rating, :comment)`; `rating` llega como `"like"|"dislike"`.
- `feedback_json(fb)` → `{ id, message_id, rating, comment, user_id, updated_at }`.

Añadir `Message#ai_generated?` en `message.rb` (reusar `external_echo?` que ya existe).

### Paso 5 — Rails: serialización del feedback del agente

En `messages_controller.rb`:

- `index`: construir `feedback_lookup = build_feedback_lookup(messages)` análogo a
  `build_quoted_lookup`:
  ```ruby
  def build_feedback_lookup(messages)
    return {} unless current_user
    ids = messages.map(&:id)
    MessageFeedback.where(message_id: ids, user_id: current_user.id).index_by(&:message_id)
  end
  ```
- Pasar `feedback_lookup` a `message_json` y añadir la clave:
  ```ruby
  feedback: (fb = feedback_lookup && feedback_lookup[message.id]) ?
            { rating: fb.rating, comment: fb.comment, user_id: fb.user_id, updated_at: fb.updated_at } : nil,
  ```
- `create`: pasar `feedback: nil` (mensaje recién creado por el agente, sin voto).
- `Message#webhook_data` (modelo): añadir `feedback: nil` para mantener la forma
  estable en el broadcast WS (los mensajes nuevos no tienen voto; los cambios de
  feedback no se broadcastean — fuera de alcance).

### Paso 6 — Rails: export JSONL

Acción `export` en `MessageFeedbacksController`:

- Scope base: `current_account.message_feedbacks` (añadir
  `has_many :message_feedbacks` a `Account`) con `includes(:message, :conversation)`.
- Filtros: `rating`, `inbox_id` (vía `conversation.inbox_id`), `from`/`to`
  (sobre `created_at`).
- `context = (params[:context] || 6).to_i.clamp(0, 20)`.
- Stream JSONL con `response.stream` (o construir y `render plain:` si el volumen
  es chico al inicio — empezar simple con `render plain:` y líneas `to_json`).
- Por cada feedback, una línea:
  ```ruby
  {
    message_id: fb.message_id, conversation_id: fb.conversation_id, user_id: fb.user_id,
    rating: fb.rating, comment: fb.comment,
    bot_response: fb.message.content,
    context: context_messages(fb.message, context).map { |m|
      { role: role_for(m), content: m.content }
    },
    inbox_id: fb.conversation.inbox_id, created_at: fb.created_at.iso8601
  }
  ```
  - `context_messages` = los N mensajes con `created_at < fb.message.created_at`
    en la misma conversación, `order(created_at: :desc).limit(N).reverse`,
    `where.not(message_type: :activity)`.
  - `role_for(m)` → `customer` (incoming) / `ai` (outgoing+sender nil+no echo) /
    `agent` (resto). Reusar `ai_generated?`.
- Content-Type `application/x-ndjson`.

### Paso 7 — FastAPI: proxy

- `messaging_service.py`: añadir
  - `set_message_feedback(tenant_id, conversation_id, message_id, payload, user_id)` → PUT.
  - `delete_message_feedback(tenant_id, conversation_id, message_id, user_id)` → DELETE.
  - `export_feedback(tenant_id, params)` → GET (devolver texto NDJSON crudo).
- `api/v1/endpoints/messaging.py`: endpoints
  - `PUT /messaging/conversations/{cid}/messages/{mid}/feedback`
  - `DELETE /messaging/conversations/{cid}/messages/{mid}/feedback`
  - `GET /messaging/feedback/export` — **dependencia de permiso ADMIN/SUPERADMIN**
    (usar el patrón `require_permission_dual`/rol existente). Devolver `StreamingResponse`
    o `PlainTextResponse` con el NDJSON tal cual.
- Schemas Pydantic en `schemas/messaging.py`: `MessageFeedbackUpsert { rating: Literal["like","dislike"]; comment: str | None }`.

### Paso 8 — Next.js: route handlers

- `app/api/messaging/conversations/[id]/messages/[messageId]/feedback/route.ts`
  (PUT + DELETE) — copiar plantilla de `contacts/[id]/notes/route.ts`.
- `app/api/messaging/feedback/export/route.ts` (GET) — devuelve el NDJSON
  (pasar `Content-Type` y body tal cual; permitir descarga).

### Paso 9 — Frontend: tipos + servicio

- `lib/types/messaging.ts`:
  ```ts
  export interface MessageFeedback {
    rating: "like" | "dislike";
    comment: string | null;
    user_id: number;
    updated_at: string;
  }
  ```
  y en `Message`: `feedback?: MessageFeedback | null;`.
- `lib/services/` (archivo de messaging existente): `setMessageFeedback(accessToken, conversationId, messageId, { rating, comment })` y `deleteMessageFeedback(...)`.

### Paso 10 — Frontend: `MessageFeedbackControls`

`components/conversations/message-feedback-controls.tsx` (memoizado):

- Props: `message`, callbacks `onSet(rating, comment?)`, `onClear()`.
- Render solo si `getSenderRole(message) === "ai"`.
- Estado local optimista del `feedback` actual (semilla = `message.feedback`).
- 👍 / 👎 con estado activo resaltado (verde/rojo, pulgar relleno), hover/touch
  igual que el botón "Responder" del bubble.
- Like: click → `onSet("like")` optimista; re-click activo → `onClear()`.
- Dislike: click → abre `Popover` (shadcn) con `textarea` + Enviar (disabled si
  vacío) / Cancelar. Enviar → `onSet("dislike", comment)`. Reabrir sobre un
  dislike existente permite editar el comentario.
- Errores: rollback del estado optimista + `toast` (`useToast()`).
- Integrar en `message-bubble.tsx` en la zona de acciones de la burbuja outgoing.

### Paso 11 — Tests

**RSpec (messaging):**
- `spec/models/message_feedback_spec.rb`: validaciones (comentario obligatorio en
  dislike, nil en like, unicidad `(message_id, user_id)`).
- `spec/requests/api/v1/message_feedbacks_spec.rb`: upsert, cambio de voto,
  destroy, 422 en mensaje no-IA, 422 en dislike sin comentario, aislamiento por
  cuenta, export (JSONL, filtros, `context`).
- (Si hay auth de rol en messaging para export, cubrir; si el gate de rol está
  solo en FastAPI, cubrirlo allí.)

**pytest (FastAPI):**
- Proxy: propagación de headers, mapeo de errores, **gate ADMIN/SUPERADMIN** en export.

**Frontend (vitest):**
- `MessageFeedbackControls`: estado activo, popover dislike (Enviar disabled sin
  texto), toggle like, optimista + rollback en error.

---

## Orden de ejecución sugerido

1. Migración + modelo + specs de modelo (verde).
2. Controller + rutas + serializer + request specs (verde).
3. Export + specs.
4. Proxy FastAPI + pytest.
5. Next routes + tipos + servicio.
6. Componente frontend + tests.
7. Verificación manual end-to-end (votar like, dislike con comentario, toggle,
   reload conserva estado, export descarga NDJSON).

## Riesgos / notas

- **Prefijo de schema `messaging.`**: confirmar cómo lo aplican las migraciones
  existentes (search_path vs nombre calificado) y replicar — un error aquí rompe
  la migración.
- **`current_user` en serializer**: si una request del index llega sin `X-User-Id`
  resoluble, `feedback_lookup` queda vacío → todos `feedback: nil` (degradación
  segura, no error).
- **Volumen del export**: empezar con `render plain:` (simple); migrar a streaming
  si el dataset crece.
- El campo `feedback` en `webhook_data` es siempre `nil` por ahora (sin broadcast
  de cambios); el frontend no debe asumir que el WS actualiza votos.
