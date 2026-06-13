# Feedback (like/dislike) en mensajes de IA — Diseño

- **Fecha:** 2026-06-12
- **Rama:** `feat/ux-ai-message-feedback`
- **Estado:** Diseño aprobado, pendiente plan de implementación

## Objetivo

Permitir que los **agentes del dashboard** evalúen con 👍/👎 las respuestas
enviadas por el **bot/IA** en una conversación, para validar la calidad de las
respuestas y **construir un dataset** exportable que alimente mejoras de prompt
y/o fine-tuning.

## Alcance

- **Quién evalúa:** agentes en el dashboard de VentIA (no el cliente final).
- **Qué se captura:** voto binario (like/dislike) + **comentario obligatorio en
  el dislike** (sin comentario en el like).
- **Entrega:** captura/almacenamiento estructurado + **endpoint de exportación**
  (JSONL). No incluye una vista de revisión en el dashboard (queda para después).

### Fuera de alcance (YAGNI)
- Feedback del cliente final por el canal (reactions/botones de WhatsApp).
- Vista/panel de revisión de evaluaciones en el dashboard.
- Broadcast en vivo (WebSocket) del cambio de feedback a otros agentes.
- Reacciones genéricas/polimórficas sobre otras entidades.

## Identificación de un mensaje de IA

Un mensaje es de IA cuando (mismo criterio que `getSenderRole() === "ai"` en
`apps/frontend/lib/utils/messaging.ts`):

- `message_type == outgoing`, **y**
- `sender` es `nil`, **y**
- no tiene `content_attributes.external_echo` (eso sería un eco del agente desde
  la app nativa de WhatsApp, no IA).

Solo los mensajes de IA son evaluables. El backend valida esto y rechaza el
resto con **422**.

## Modelo de datos

Tabla nueva **`messaging.message_feedbacks`**:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | |
| `message_id` | bigint FK → messages | `on_delete: cascade` |
| `account_id` | bigint | índice (tenant) |
| `conversation_id` | bigint | índice (denormalizado para export/filtros) |
| `user_id` | bigint NOT NULL | agente que dio el voto (resuelto de `X-User-Id`) |
| `rating` | integer enum | `{ dislike: 0, like: 1 }` |
| `comment` | text, nullable | obligatorio si `dislike`; `nil` si `like` |
| `created_at` / `updated_at` | datetime | |

### Decisión: un feedback por **(mensaje, agente)**

- **Índice único en `(message_id, user_id)`** (no solo `message_id`).
- Cada agente tiene su propio voto+comentario; nadie sobrescribe a otro
  ("a prueba de futuro": evita pérdida de votos si dos agentes evalúan el mismo
  mensaje y permite medir consenso más adelante).
- La burbuja muestra **únicamente el voto del agente actual**.

### Reglas
- `rating = dislike` **requiere** `comment` no vacío → si falta, **422**.
- `rating = like` fuerza `comment = nil` (se ignora si llega).
- Re-click sobre el voto activo propio → se **elimina** la fila (vuelve a neutral).

## Backend (Rails — app de mensajería)

### Modelo `MessageFeedback`
- `belongs_to :message`, `:account`, `:conversation`, `belongs_to :user`
- `enum rating: { dislike: 0, like: 1 }`
- Validaciones: presencia de `comment` cuando `dislike`; `comment` nil cuando
  `like`; unicidad de `user_id` por `message_id`.
- Validación de negocio: el `message` destino debe ser de IA (ver criterio
  arriba) — encapsular en el servicio/controller.

### Endpoints REST (anidados bajo el mensaje)

```
PUT    /api/v1/conversations/:conversation_id/messages/:message_id/feedback
DELETE /api/v1/conversations/:conversation_id/messages/:message_id/feedback
```

- `PUT { rating, comment? }` → **upsert** del feedback del agente actual
  (`find_or_initialize_by(message_id:, user_id:)`). Valida mensaje-IA y reglas
  de comentario. Respuesta `{ success: true, data: { feedback } }`.
- `DELETE` → elimina el feedback del agente actual sobre ese mensaje.
- `user_id` se resuelve del header `X-User-Id` (patrón existente).

### Serialización
- `Message#webhook_data` y el serializer del index incluyen
  `feedback: { rating, comment, user_id, updated_at } | null`, donde `feedback`
  es **el voto del agente que hace la request** (no un agregado).
- Para evitar N+1 en el index: precargar los feedbacks del agente actual para
  los `message_id` de la página en una sola query
  (`MessageFeedback.where(message_id: ids, user_id: current_user_id).index_by(&:message_id)`)
  y adjuntarlos.

### Export (objetivo dataset)

```
GET /api/v1/message_feedbacks/export?rating=&inbox_id=&from=&to=&context=10
```

- Respuesta **JSONL** (streaming), **una línea por voto**:

```json
{"message_id":123,"conversation_id":45,"user_id":7,"rating":"dislike",
 "comment":"Dio un precio que no existe",
 "bot_response":"...texto del mensaje del bot...",
 "bot_attachments":[{"file_type":"image","url":"https://..."}],
 "context":[{"role":"customer","content":"...","attachments":[{"file_type":"image","url":"https://..."}]},
            {"role":"ai","content":"..."}],
 "inbox_id":7,"created_at":"2026-06-12T10:00:00Z"}
```

- `context` = los últimos **N** mensajes (default **10**, máx 20, param `context`)
  anteriores a la respuesta del bot dentro de la misma conversación (el
  prompt/contexto que originó la respuesta). `role` ∈ `customer` | `ai` | `agent`.
- **Adjuntos**: cada mensaje (contexto y el del bot) incluye `attachments`/
  `bot_attachments` con `{file_type, url}` de imágenes/audio/video/archivos
  (se omite la clave en mensajes de solo texto; location/contact no llevan URL).
- Filtros opcionales: `rating`, `inbox_id`, rango `from`/`to` (por `created_at`
  del feedback).
- Una fila por voto incluye `user_id`; la consolidación (mayoría/consenso) se
  decide aguas abajo por el consumidor del dataset.

## Proxy FastAPI + Next.js

### FastAPI (`apps/backend`)
- `messaging_service.py`: métodos `set_message_feedback`, `delete_message_feedback`,
  `export_feedback` que reenvían a Rails propagando `X-Tenant-Id`/`X-User-Id`.
- `api/v1/endpoints/messaging.py`: endpoints proxy correspondientes.
- **Export restringido a `ADMIN`/`SUPERADMIN`** (permiso dual existente). Los
  endpoints PUT/DELETE de feedback siguen el permiso de mensajería existente
  (cualquier agente que opera conversaciones).

### Next.js (`apps/frontend`)
- Route handler `app/api/messaging/conversations/[id]/messages/[messageId]/feedback/route.ts`
  (PUT/DELETE) — patrón de proxy existente (Auth0 token → FastAPI).
- Route handler `app/api/messaging/feedback/export/route.ts` (GET) para el export.

## Frontend (UX)

### Ubicación
- Solo en burbujas con `getSenderRole(message) === "ai"`, dentro de
  `components/conversations/message-bubble.tsx`.
- Lógica extraída a un componente propio **`MessageFeedbackControls`**
  (memoizado) para no inflar `message-bubble.tsx`; recibe `message` + callbacks.

### Aspecto y estado
- Botones 👍 / 👎 que aparecen al hover (igual que el botón "Responder";
  persistentes en touch vía `[@media(hover:none)]`).
- El voto activo del agente queda **fijo y resaltado** (pulgar relleno; verde =
  like, rojo = dislike) aunque no haya hover.
- Estado precargado desde `message.feedback` (serializer). Se añade `feedback`
  al tipo `Message` en `lib/types/messaging.ts`.

### Flujo like
- Click en 👍 → `PUT { rating: "like" }` (update optimista).
- Re-click en 👍 activo → `DELETE` (quita voto).

### Flujo dislike (comentario obligatorio)
- Click en 👎 → popover anclado a la burbuja con `textarea`
  ("¿Qué estuvo mal en esta respuesta?") + **Enviar** (deshabilitado si vacío) /
  **Cancelar**.
- Enviar → `PUT { rating: "dislike", comment }` (optimista; toast en error con
  `useToast()`).
- Cancelar / cerrar sin enviar → no se guarda nada.
- Un dislike ya guardado permite ver/editar su comentario reabriendo el popover.

### Servicio
- Función en `lib/services/` que recibe `accessToken` como primer parámetro
  (patrón del proyecto) para PUT/DELETE del feedback.

## Testing

### Backend (RSpec — app de mensajería)
- Modelo: validaciones (comentario obligatorio en dislike, nil en like,
  unicidad `(message_id, user_id)`).
- Request specs: upsert, toggle/delete, rechazo 422 sobre mensaje no-IA,
  rechazo 422 dislike sin comentario, aislamiento por tenant.
- Export: formato JSONL, filtros, ventana de `context`, permiso ADMIN/SUPERADMIN.

### Backend (pytest — FastAPI)
- Proxy: propagación de headers, mapeo de errores, restricción de rol en export.

### Frontend
- `MessageFeedbackControls`: render de estado activo, flujo de popover de
  dislike (Enviar deshabilitado sin comentario), toggle de like, update
  optimista y rollback en error.

## Archivos clave (referencia)

- `apps/messaging/app/models/message.rb` — `webhook_data`, criterio IA.
- `apps/messaging/app/services/whatsapp/incoming_message_service.rb` — cómo nacen
  los mensajes (echo/IA con `sender: nil`).
- `apps/messaging/config/routes.rb` — rutas anidadas de `messages`.
- `apps/frontend/lib/utils/messaging.ts` — `getSenderRole()`.
- `apps/frontend/components/conversations/message-bubble.tsx` — render de burbuja.
- `apps/backend/app/services/messaging_service.py` — proxy a Rails (headers).
- `apps/frontend/app/api/messaging/contacts/[id]/notes/route.ts` — plantilla de
  route handler proxy.
