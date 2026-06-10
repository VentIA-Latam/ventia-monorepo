# Respuestas rápidas con acciones + vista en sidebar — Plan de Implementación

**Spec:** `docs/superpowers/specs/2026-06-10-respuestas-rapidas-acciones-vista-sidebar-design.md`
**Date:** 2026-06-10
**Rama:** feat/messaging-shortcuts-templates

Orden de abajo hacia arriba (Rails → FastAPI → Next → UI). Las fases 1–6 dejan
funcionando end-to-end por API tanto el CRUD de `actions` como el disparo al enviar,
antes de tocar UI. Cada fase es verificable de forma aislada.

> Nota operativa (rspec): los `spec/` no están bind-mounted en `ventia-messaging`; se
> copian con `docker cp`. `app/` sí está bind-mounted. Ver memoria
> `project_dev_runtime_topology`.

---

## Fase 1 — Rails: migración `actions` + validación en el modelo

**Objetivo:** `canned_responses` guarda un array `actions` validado.

**Archivos:**
- Migración nueva: `apps/messaging/db/migrate/<ts>_add_actions_to_canned_responses.rb`
- `apps/messaging/app/models/canned_response.rb`
- `apps/messaging/db/schema.rb` (autogenerado al migrar)

**Cambios:**
1. Migración aditiva:
   ```ruby
   add_column :canned_responses, :actions, :jsonb, null: false, default: []
   ```
   (respetar el schema `messaging`, como el resto de tablas).
2. En `CannedResponse`:
   - Lista blanca v1:
     ```ruby
     ACTION_NAMES = %w[add_label remove_label set_ai_agent change_status resolve_conversation].freeze
     ```
   - `validate :validate_actions_format` con la misma lógica que
     `Macro#validate_actions_format` (array de hashes con `action_name` presente y
     dentro de `ACTION_NAMES`).
   - Exponer `webhook_data` (`{ id:, short_code:, actions: }`) para encajar como
     `rule:` en `Automation::ActionService` (lo usa `send_webhook_event`, futuro).

**Verificación:**
- `docker exec ventia-messaging bundle exec rails db:migrate`
- Consola: crear una `CannedResponse` con `actions` inválidas → error de validación;
  con `actions: [{ "action_name" => "add_label", "action_params" => { "labels" => [1] } }]` → válida.

---

## Fase 2 — Rails: acción `set_ai_agent` en el ejecutor

**Objetivo:** `Automation::ActionService` sabe ejecutar `set_ai_agent`.

**Archivos:**
- `apps/messaging/app/services/automation/action_service.rb`

**Cambios:**
1. Agregar al `case` de `execute_action`:
   ```ruby
   when 'set_ai_agent'
     set_ai_agent(action['action_params'])
   ```
2. Implementar:
   ```ruby
   def set_ai_agent(params)
     enabled = ActiveModel::Type::Boolean.new.cast(params['enabled'])
     return if enabled.nil?
     @conversation.update!(ai_agent_enabled: enabled)
   end
   ```
   - Dejar que el callback `sync_soporte_humano_label` (en `Conversation`) sincronice
     la etiqueta `soporte-humano`. **Verificar** que ese callback corre en
     `update!(ai_agent_enabled:)` y no solo en el flujo del controller; si la
     sincronización vive solo en `ConversationsController`, replicar aquí la
     creación/borrado de la etiqueta `soporte-humano` (o extraer un método de modelo
     reutilizable). Decidir según lo que exista al implementar.

**Verificación:** spec unitario del service (Fase 12) — `set_ai_agent` con
`enabled:false` voltea `ai_agent_enabled` y agrega `soporte-humano`; con `true` lo
revierte.

---

## Fase 3 — Rails: disparo al enviar en `MessagesController#create`

**Objetivo:** al enviar un mensaje saliente con `canned_response_id`, se ejecutan las
acciones de esa respuesta.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/messages_controller.rb`

**Cambios** (tras `if message.save`, dentro de `create`):
1. Leer `canned_response_id` de params (top-level, fuera de `message_params`).
2. Disparar solo si el mensaje es `outgoing` y hay id:
   ```ruby
   if message.outgoing? && params[:canned_response_id].present?
     cr = @current_account.canned_responses.find_by(id: params[:canned_response_id])
     if cr&.actions.present?
       Automation::ActionService.new(rule: cr, conversation: @conversation).perform
     end
   end
   ```
   - `find_by` scoped al account → anti-IDOR (id ajeno = `nil` = no-op).
   - `ActionService#perform` ya hace rescue+log → una acción fallida no rompe el envío.
3. **Auditoría:** persistir el id en `content_attributes` del mensaje
   (`message.content_attributes['canned_response_id'] = cr.id` antes de guardar, o en
   un `update_column` posterior). Permitir `canned_response_id` dentro de
   `content_attributes` en los params del mensaje si se decide enviarlo así (ver §
   Decisión de transporte abajo).

**Decisión de transporte del id:** el frontend lo manda dentro de
`content_attributes` (junto a `in_reply_to`). El controller puede leerlo de
`params[:content_attributes][:canned_response_id]`. Mantener una sola fuente: leerlo
de `content_attributes` y, ya que viaja ahí, queda persistido para auditoría sin
trabajo extra. Ajustar el `permit` de `content_attributes` para incluir
`canned_response_id`.

**Verificación:** request spec (Fase 12).

---

## Fase 4 — Rails: aceptar y exponer `actions` en el CRUD

**Archivos:**
- `apps/messaging/app/controllers/api/v1/canned_responses_controller.rb`

**Cambios:**
1. `canned_response_params`: permitir `actions` como array de hashes:
   ```ruby
   params.require(:canned_response).permit(:short_code, :content,
     actions: [:action_name, { action_params: {} }])
   ```
   (verificar el shape exacto de strong params para jsonb anidado; puede requerir
   `permit!` controlado sobre `action_params` o normalizar en el modelo).
2. Asegurar que la respuesta JSON (`render_success`) incluya `actions` (si usa un
   serializer/`as_json`, agregar `actions`).

**Verificación:** `curl` POST con `actions` → se persiste y vuelve en la respuesta;
GET la incluye.

---

## Fase 5 — FastAPI: schemas

**Archivos:**
- `apps/backend/app/schemas/messaging.py`

**Cambios:**
1. Definir el shape de acción:
   ```python
   class CannedResponseAction(BaseModel):
       action_name: str
       action_params: dict = Field(default_factory=dict)
   ```
2. Agregar `actions: list[CannedResponseAction] = []` a `CannedResponseCreate`,
   `CannedResponseUpdate` y al schema de respuesta de canned response.
3. En `SendMessageRequest`: asegurar que `content_attributes` admite
   `canned_response_id` (si `content_attributes` es `dict`/modelo laxo, ya pasa; si es
   un modelo tipado, añadir el campo opcional).

**Verificación:** `cd apps/backend && uv run python -c "from app.schemas.messaging import CannedResponseCreate, CannedResponseAction"`.

---

## Fase 6 — FastAPI: service + endpoints proxy

**Archivos:**
- `apps/backend/app/services/messaging_service.py`
- `apps/backend/app/api/v1/endpoints/messaging.py`

**Cambios:**
1. En los métodos `create_canned_response` / `update_canned_response` (o equivalentes
   si ya existen), incluir `actions` en el payload `{"canned_response": {...}}`.
2. En `send_message` / `send_message_with_file`: propagar `content_attributes`
   completo (con `canned_response_id`) hacia Rails. Verificar que hoy ya se reenvía
   `content_attributes` (lo hace para `in_reply_to`); si solo se cherry-pickean
   campos, agregar `canned_response_id`.
3. Endpoints `POST`/`PATCH` de canned responses: aceptar `actions` del body y pasarlo
   al service. Propagar `user_id` (rol Rails) como ya se hace.

**Verificación:** pytest (Fase 13) + manual `curl` end-to-end.

---

## Fase 7 — Next: route handlers + api-client + types

**Archivos:**
- Route handlers de canned responses y de envío de mensajes en `apps/frontend/app/api/messaging/...`
- `apps/frontend/lib/api-client/messaging.ts`
- `apps/frontend/lib/types/messaging.ts`

**Cambios:**
1. `types/messaging.ts`: agregar a `CannedResponse` el campo
   `actions: CannedResponseAction[]` y definir `CannedResponseAction`
   (`{ action_name: string; action_params: Record<string, unknown> }`).
2. `api-client/messaging.ts`: `createCannedResponse` / `updateCannedResponse` envían
   `actions`. `sendMessage` incluye `canned_response_id` dentro de
   `content_attributes`.
3. Route handlers: reenviar `actions` y `content_attributes` al backend.

**Verificación:** `cd apps/frontend && pnpm build` (typecheck).

---

## Fase 8 — Frontend: ruta + ítem en sidebar

**Archivos:**
- `apps/frontend/app/dashboard/canned-responses/page.tsx` (server) + `*-client.tsx`
- `apps/frontend/components/dashboard/app-sidebar.tsx` (array `dataPlatform`)
- `apps/frontend/app/dashboard/dashboard-layout-client.tsx` (`PAGE_META`)

**Cambios:**
1. Nueva ruta con server page (fetch inicial con `accessToken`) + client.
2. Ítem en `dataPlatform` (label "Respuestas rápidas", icono, href
   `/dashboard/canned-responses`).
3. Entrada en `PAGE_META` (título + breadcrumb).
4. Gating de gestión por rol (`administrator`/`superadmin`); rol menor → lectura.

**Verificación:** navegar al ítem; la página lista las respuestas existentes.

---

## Fase 9 — Frontend: constructor de acciones (componente)

**Archivos:**
- `apps/frontend/components/conversations/canned-response-actions-builder.tsx` (nuevo)
- (reutiliza catálogo de `Label` vía api-client existente)

**Cambios:**
- Componente controlado que recibe/emite `actions: CannedResponseAction[]`.
- Agregar/quitar acciones; por `action_name`, render de params:
  - `add_label`/`remove_label`: multiselect de etiquetas → `action_params.labels: number[]`.
  - `set_ai_agent`: switch → `action_params.enabled: boolean`.
  - `change_status`/`resolve_conversation`: select de estado → `action_params.status`.
- Validación cliente: no permitir acción sin params requeridos.

**Verificación:** integrarlo en el form de la página (Fase 8) y crear una respuesta
con acciones; confirmar persistencia (GET).

---

## Fase 10 — Frontend: ajustes al picker

**Archivos:**
- `apps/frontend/components/conversations/canned-response-picker.tsx`

**Cambios:**
1. Eliminar el footer "Gestionar respuestas" y la prop `onManage`/`canManage` que ya
   no aplican (la gestión vive en el sidebar). Verificar usos y limpiar el `mode:
   "button"` si el botón del composer se retira.
2. Badge visual en ítems cuya `actions.length > 0`.

**Verificación:** abrir el picker con `/`; ya no aparece el footer; las respuestas con
acciones muestran badge.

---

## Fase 11 — Frontend: armado en composer/message-view

**Archivos:**
- `apps/frontend/components/conversations/message-composer.tsx`
- `apps/frontend/components/conversations/message-view.tsx`

**Cambios:**
1. `message-composer`: estado `armedCannedResponseId`. En `onSelect` del picker se
   setea (**gana la última**). Se limpia tras enviar y cuando el input queda vacío.
2. Retirar el botón de gestión del composer (queda solo el trigger `/`).
3. `handleSend` (en `message-view`): incluir `canned_response_id` en
   `content_attributes` del payload de `sendMessage`. Limpiar el armado en el callback
   de éxito.

**Verificación:** insertar una respuesta con acción `set_ai_agent: false`, editar el
texto, enviar → el mensaje sale y la conversación pasa a soporte humano + etiqueta
`soporte-humano`.

---

## Fase 12 — Tests Rails

**Archivos:**
- `apps/messaging/spec/models/canned_response_spec.rb`
- `apps/messaging/spec/requests/api/v1/canned_responses_spec.rb`
- `apps/messaging/spec/requests/api/v1/messages_spec.rb` (o el que cubra create)
- `apps/messaging/spec/services/automation/action_service_spec.rb`

**Casos:**
- Model: validación de formato/lista blanca de `actions`.
- ActionService: `set_ai_agent` (true/false) voltea `ai_agent_enabled` y sincroniza
  `soporte-humano`.
- MessagesController#create: con `canned_response_id` válido dispara acciones (label
  agregada, estado cambiado); sin id → no dispara; id de otro account → no dispara
  (IDOR); mensaje entrante → no dispara.
- CRUD: `actions` se persiste; agente recibe 403 al escribir (regresión auth).

**Verificación:** `docker cp` de specs + `docker exec ventia-messaging bundle exec rspec ...`.

---

## Fase 13 — Tests pytest (backend)

**Archivos:**
- `apps/backend/tests/unit/services/test_messaging_canned_responses.py`

**Casos:** create/update reenvían `actions`; `send_message` reenvía
`content_attributes` con `canned_response_id`.

**Verificación:** `cd apps/backend && uv run pytest tests/unit/services/test_messaging_canned_responses.py`.

---

## Fase 14 — Verificación manual / e2e (opcional)

- Flujo completo en vivo: crear respuesta con varias acciones desde la vista del
  sidebar → insertarla con `/` en una conversación → enviar → verificar etiqueta,
  `ai_agent_enabled` y estado.
- e2e Playwright opcional (no bloqueante), siguiendo el criterio de la feature previa.

---

## Riesgos / puntos a confirmar al implementar

1. **Sincronización `soporte-humano` en `update!(ai_agent_enabled:)`** (Fase 2): si el
   callback no corre fuera del controller, replicar/extraer la lógica.
2. **Strong params para `actions` jsonb anidado** (Fase 4): el `action_params` libre
   puede requerir normalización manual en el modelo.
3. **Transporte de `canned_response_id`** (Fase 3/6/11): mantenerlo dentro de
   `content_attributes` end-to-end para no añadir un campo nuevo en cada capa.
4. **Limpieza del `mode: "button"` del picker** (Fase 10): confirmar que ningún otro
   consumidor depende de él antes de retirarlo.
