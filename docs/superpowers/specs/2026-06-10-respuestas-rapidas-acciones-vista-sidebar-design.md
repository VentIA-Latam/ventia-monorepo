# Respuestas rápidas con acciones + vista en sidebar — Diseño

**Fecha:** 2026-06-10
**Rama:** feat/messaging-shortcuts-templates
**Estado:** Diseño aprobado (pendiente de plan de implementación)

## Objetivo

Evolucionar la feature de respuestas rápidas (canned responses) en dos frentes:

1. **Vista propia en el sidebar.** Mover la gestión (CRUD) desde el dialog dentro de
   Conversaciones a una página completa accesible desde el sidebar del dashboard.
2. **Acciones asociadas.** Permitir que cada respuesta rápida tenga una o más
   **acciones** que se ejecutan automáticamente cuando se envía un mensaje originado
   en esa respuesta (ej. agregar una etiqueta, pasar la conversación de IA a agente
   humano, resolver la conversación).

El apartado se diseña como un marco extensible: a futuro se podrán asociar nuevas
acciones a una respuesta rápida sin cambiar la arquitectura.

## Contexto y reutilización

El servicio de messaging (Rails, herencia de Chatwoot) ya tiene un esquema de
acciones reutilizable, compartido por `Macro` y `AutomationRule`:

- `actions` es una columna `jsonb` (array) de objetos `{ action_name, action_params }`.
- `Automation::ActionService` (`apps/messaging/app/services/automation/action_service.rb`)
  ejecuta esas acciones sobre una conversación. Recibe `rule:` (cualquier objeto que
  responda a `.actions`, `.id`, `.webhook_data`) y `conversation:`.
- Acciones ya implementadas en el ejecutor: `send_message`, `add_label`,
  `remove_label`, `change_status`, `resolve_conversation`, `send_webhook_event`.

Acoplamiento existente relevante: aplicar la etiqueta de sistema `soporte-humano`
pone `ai_agent_enabled = false` en la conversación, y quitarla lo reactiva
(`apps/messaging/app/controllers/api/v1/conversations/labels_controller.rb`). El
campo `ai_agent_enabled` también se controla vía `PATCH /conversations/:id`,
`POST /conversations/:id/escalate` y `POST /conversations/:id/resolve_escalation`,
que ya sincronizan la etiqueta `soporte-humano`
(`apps/messaging/app/controllers/api/v1/conversations_controller.rb`).

Estado base de la feature de canned responses (a partir del cual se construye):
modelo `CannedResponse` (account-scoped), controller CRUD
`api/v1/canned_responses_controller.rb` con autorización de escritura para
`administrator`/`superadmin`, proxy FastAPI/Next, y UI con picker
(`canned-response-picker.tsx`, trigger `/` + botón) y dialog de gestión
(`canned-responses-manager-dialog.tsx`).

## Decisiones de producto (cerradas en brainstorming)

- **Vista en sidebar = gestión completa.** Reemplaza al dialog de gestión actual.
- **Composer:** se conserva solo el trigger `/` para insertar. Se elimina el botón y
  el footer "Gestionar respuestas" del picker (la gestión ahora vive en el sidebar).
- **Disparo al enviar.** Las acciones corren cuando el mensaje se envía.
- **Vínculo robusto.** Al insertar, el mensaje queda "armado" con esa respuesta
  rápida; las acciones se disparan al enviar **aunque el agente edite el texto**.
- **Una respuesta rápida por envío.** Aplica a todas (tengan o no acciones). Si se
  inserta una segunda sin enviar, **gana la última** (el texto se inserta igual, pero
  la asociación para las acciones pasa a la última respuesta insertada).
- **Roles:** configurar acciones lo hacen los mismos roles que gestionan respuestas
  (`administrator`/`superadmin`). Una respuesta puede tener varias acciones.
- **Acciones del v1:** `add_label` / `remove_label` (etiquetas), `set_ai_agent`
  (agente↔IA), `change_status` / `resolve_conversation` (cambiar estado/resolver).

## Arquitectura

### Enfoque elegido: ejecución en el backend (Rails)

El frontend envía el `canned_response_id` junto con el mensaje. Al guardarse el
mensaje, Rails lee las acciones de esa respuesta y las ejecuta reusando
`Automation::ActionService`. Es la única fuente de verdad, atómico con el envío,
queda en el historial de actividad de la conversación, y no duplica la lógica de
etiquetas/IA en el cliente.

(Se descartaron: ejecución en frontend —round-trips, condiciones de carrera, no
atómico—; y un listener Wisper desacoplado —más piezas de las necesarias para v1.)

### 1. Modelo de datos (Rails)

- Migración **aditiva**: agregar `actions :jsonb, null: false, default: []` a
  `messaging.canned_responses`.
- Formato idéntico a `Macro`: `[{ "action_name": "...", "action_params": {...} }, ...]`.
- `CannedResponse` valida el formato de `actions` (misma lógica que
  `Macro#validate_actions_format`) restringido a la lista blanca del v1:
  `add_label`, `remove_label`, `set_ai_agent`, `change_status`,
  `resolve_conversation`.
- `CannedResponse` expone `.actions` (columna), `.webhook_data` (para
  `send_webhook_event` futuro) para encajar como `rule:` en el ejecutor.
- Sigue a nivel `account`, sin `brand_id`/`inbox_id` (forward-compat con la futura
  jerarquía organización→marca→sucursal; migración futura será aditiva).

### 2. Ejecución de acciones (Rails)

- **Punto de disparo:** `MessagesController#create`
  (`apps/messaging/app/controllers/api/v1/messages_controller.rb`), tras
  `message.save` y **solo para mensajes salientes** (`outgoing`).
- Se lee `canned_response_id` de los parámetros (ver §4) y se busca la respuesta
  *scoped al account actual* (`@current_account.canned_responses.find_by(id:)`) →
  defensa anti-IDOR. Si no existe o no pertenece al account, no se ejecuta nada.
- Ejecución:
  `Automation::ActionService.new(rule: canned_response, conversation: @conversation).perform`.
- **Nueva acción `set_ai_agent`:** se agrega al `case` de `Automation::ActionService`.
  Con `action_params: { "enabled": true|false }` reusa la lógica de
  escalate/resolve_escalation (actualiza `ai_agent_enabled` y deja que el callback
  `sync_soporte_humano_label` sincronice la etiqueta `soporte-humano`). Se agrega
  `set_ai_agent` a la lista blanca de acciones.
- **Aislamiento de errores:** `Automation::ActionService#perform` ya hace
  `rescue StandardError` + log, de modo que una acción que falle **no rompe el envío
  del mensaje**.
- **Auditoría:** persistir `canned_response_id` dentro de `message.content_attributes`
  para trazabilidad en el historial.

### 3. Proxy (FastAPI + Next)

- `SendMessageRequest` (FastAPI, `apps/backend/app/api/v1/endpoints/messaging.py`) y
  el route handler de Next propagan `content_attributes` end-to-end (ya soportan
  `in_reply_to`); se añade `canned_response_id` ahí.
- Los proxies de create/update de canned responses (FastAPI + Next + api-client)
  pasan el campo `actions`. El tipo `CannedResponse` en
  `apps/frontend/lib/types/messaging.ts` incorpora `actions`.

### 4. Frontend

**a. Vista en sidebar**

- Nueva ruta `app/dashboard/canned-responses/` (server `page.tsx` + `-client.tsx`,
  siguiendo el patrón del proyecto).
- Item en `dataPlatform` de `components/dashboard/app-sidebar.tsx` + entrada en
  `PAGE_META` de `dashboard-layout-client.tsx`.
- Acceso a gestión solo `administrator`/`superadmin`; otros roles ven el catálogo en
  modo lectura.
- La página reemplaza al `canned-responses-manager-dialog.tsx`: lista de respuestas +
  crear/editar con `short_code`, `content` (emoji picker reutilizado) y un
  **constructor de acciones**.

**b. Constructor de acciones (UI)**

- Permite agregar N acciones a la respuesta. Por tipo de acción, sus params:
  - `add_label` / `remove_label`: multiselect de etiquetas (catálogo de `Label`).
  - `set_ai_agent`: switch on/off (IA on = agente bot; off = soporte humano).
  - `change_status` / `resolve_conversation`: select de estado.

**c. Picker en el composer**

- Se mantiene el trigger `/` para insertar. Se eliminan el botón y el footer
  "Gestionar respuestas" del picker (`canned-response-picker.tsx`).
- Badge visual en las respuestas que llevan acciones.

**d. Composer / message-view (armado del mensaje)**

- `message-composer.tsx` trackea `armedCannedResponseId`. Al insertar desde el picker
  (`onSelect`) se setea, **gana la última**. Se limpia tras enviar y si el composer
  queda vacío.
- En `handleSend` (`message-view.tsx`) se incluye `canned_response_id` en el payload
  (dentro de `content_attributes`).

## Seguridad y casos límite

- Configurar/editar acciones gateado por `authorize_management!`
  (`administrator`/`superadmin`); test de regresión IDOR cross-account.
- `canned_response_id` se resuelve scoped al account (anti-IDOR). `label` y `status`
  se validan/scopean al account dentro del ejecutor (ya lo hacen `add_label` y
  `change_status`).
- Las acciones solo se disparan en mensajes **salientes**.
- Un mensaje sin `canned_response_id` no dispara ninguna acción (regresión cubierta
  por test).

## Testing

- **Rails:**
  - Model: validación de formato de `actions` y lista blanca.
  - Request specs: ejecución de acciones al enviar (etiquetas, `set_ai_agent` que
    voltea `ai_agent_enabled` y sincroniza `soporte-humano`, `change_status` /
    `resolve_conversation`); IDOR cross-account; regresión de "sin
    `canned_response_id` → sin acciones".
- **pytest (backend):** el proxy pasa `actions` (CRUD) y `canned_response_id`
  (`content_attributes`) correctamente.

Nota operativa: para correr rspec, los `spec/` se copian con `docker cp` al
contenedor `ventia-messaging` (no están bind-mounted); `app/` sí está bind-mounted.

## Fuera de alcance (v1)

- Variables `{{}}` en el contenido (aditivo futuro).
- Acciones futuras (suman al mismo esquema/ejecutor sin cambio de arquitectura):
  asignar a agente/equipo (`assign_agent`, `assign_team`), nota privada
  (`add_private_note`), cambiar prioridad (`change_priority`), posponer
  (`snooze_conversation`), cambiar etapa de venta (`update_stage`), marcar revisión
  de pago (`mark_payment_review`).
