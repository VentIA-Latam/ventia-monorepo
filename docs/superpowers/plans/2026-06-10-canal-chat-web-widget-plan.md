# Canal Chat Web (Web Widget embebible) — Plan de Implementación

**Spec:** `docs/superpowers/specs/2026-06-10-canal-chat-web-widget-design.md`
**Tarea:** [US-CANAL-002](https://app.clickup.com/t/86ah8xv65) (Sprint sem2-junio-2026)
**Fecha:** 2026-06-10
**Rama sugerida:** `feat/canal-chat-web-widget`

Orden de abajo hacia arriba (infra → modelo → tiempo real → API pública → envío → alta →
proxy → UI → widget → tests). Las fases 0–5 dejan el canal funcionando end-to-end por
`curl` + una suscripción manual al WebSocket (ingreso y salida en tiempo real) antes de
tocar proxy/UI/widget. Cada fase es verificable de forma aislada.

## Estimación de tiempo

Estimación total: **~6–7 días** efectivos (consistente con el rango 5–7 de la tarea;
el extremo alto absorbe el repo del widget y la coordinación de infra CORS/WSS/CDN).
Un día ≈ jornada efectiva de desarrollo.

| Fase | Descripción | Estimación |
|---|---|---|
| 0 | Infra: CORS, ActionCable origins, rate-limit, helper JWT | 0.5 d |
| 1 | Migración + modelo `Channel::WebWidget` + `pubsub_token` | 0.5 d |
| 2 | Extender `RoomChannel` (agente o visitante) | 0.5 d |
| 3 | API pública: `config`, `contacts` (anónimo + HMAC) | 0.75 d |
| 4 | API pública: `conversations`, `messages` (ingreso + visitor info) | 0.5 d |
| 5 | Salida `WebWidget::SendOnWebWidgetService` | 0.25 d |
| 6 | Alta del canal (panel admin backend) | 0.25 d |
| 7 | Proxy FastAPI + Next | 0.5 d |
| 8 | Frontend: panel admin (builder + preview + snippet) | 1.0 d |
| 9 | Repo `ventia-chat-widget` (Vite) — el widget embebible | 1.5 d |
| 10 | Tests Rails | 0.5 d |
| 11 | Tests widget + pytest + e2e | 0.5 d |
| | **Total** | **~7.25 d** (≈6–7 con paralelización) |

> Las estimaciones asumen que las decisiones de infra abiertas (CORS por canal, WSS
> origins, hosting del CDN del widget) están resueltas antes de empezar; si no, sumar
> tiempo de coordinación (ver §Riesgos #4, #5, #6).

> Nota operativa (rspec): los `spec/` no están bind-mounted en `ventia-messaging`; se
> copian con `docker cp`. `app/` sí está bind-mounted. Ver memoria
> `project_dev_runtime_topology`.

---

## Fase 0 — Infra: CORS, ActionCable origins, rate-limit, helper JWT

**Tiempo estimado:** 0.5 d

**Objetivo:** dejar el entorno listo para servir una API y un WebSocket **públicos**
(consumidos desde dominios de terceros) de forma segura.

**Archivos:**
- `apps/messaging/Gemfile` (`rack-cors`, `rack-attack` si no están)
- `apps/messaging/config/initializers/cors.rb`
- `apps/messaging/config/initializers/rack_attack.rb` (nuevo)
- `apps/messaging/config/cable.yml` / initializer de ActionCable origins
- `apps/messaging/app/services/widget/token.rb` (nuevo — encode/decode JWT)

**Cambios:**
1. `rack-cors`: habilitar CORS para el namespace `/api/v1/widget/*`. Origen permitido se
   valida **por canal** (ver Fase 3); en infra dejar la regla base que admite
   `Authorization`/`Content-Type` y métodos `GET/POST/PATCH`.
2. `rack-attack`: throttle de endpoints públicos (`POST /api/v1/widget/contacts` y
   `…/messages`) por IP + `website_token`. Umbrales conservadores (afinar en §Riesgos #8).
3. **ActionCable origins:** permitir conexiones WSS desde los dominios de los sitios
   cliente. Estrategia v1: `config.action_cable.disable_request_forgery_protection` solo
   donde aplique, o `allowed_request_origins` configurable. Confirmar con infra
   (spec §Riesgos #6).
4. `Widget::Token`: `encode(source_id:, inbox_id:)` y `decode(jwt)` firmando con
   `Rails.application.secret_key_base` (HS256). Sin expiración dura en v1 (la sesión vive
   en `localStorage`); incluir `iat`.

**Verificación:**
- `docker exec ventia-messaging bundle install` sin errores.
- Consola: `Widget::Token.decode(Widget::Token.encode(source_id: 'x', inbox_id: 1))` →
  `{ 'source_id' => 'x', 'inbox_id' => 1, ... }`.

---

## Fase 1 — Rails: migración + modelo `Channel::WebWidget` + `pubsub_token`

**Tiempo estimado:** 0.5 d

**Objetivo:** existen la tabla `channel_web_widget`, la columna
`contact_inboxes.pubsub_token` y los modelos asociados.

**Archivos:**
- `apps/messaging/db/migrate/<ts>_create_channel_web_widget.rb` (nuevo)
- `apps/messaging/db/migrate/<ts>_add_pubsub_token_to_contact_inboxes.rb` (nuevo)
- `apps/messaging/app/models/channel/web_widget.rb` (nuevo)
- `apps/messaging/app/models/contact_inbox.rb`
- `apps/messaging/app/models/account.rb`
- `apps/messaging/app/models/inbox.rb`
- `apps/messaging/db/schema.rb` (autogenerado)

**Cambios:**
1. Migración `create_channel_web_widget` (schema `messaging`; ver spec §1): `account_id`,
   `website_token` (índice único), `hmac_token`, `website_url`, `widget_color`, `avatar`,
   `welcome_title`/`welcome_tagline`/`welcome_message`, `reply_time`, `hmac_mandatory`,
   `branding_enabled`, `pre_chat_form_enabled`/`pre_chat_form_options` (forward-compat),
   `feature_flags`, `provider_config`.
2. Migración `add_pubsub_token_to_contact_inboxes`: `add_column :pubsub_token, :string` +
   índice único.
3. `Channel::WebWidget` (`include Reauthorizable`, `self.table_name`,
   `has_secure_token :website_token`, `ensure_hmac_token`, validaciones, `belongs_to
   :account`, `has_one :inbox, as: :channel`, `name`, `widget_config` que **NO** incluye
   `hmac_token`).
4. `ContactInbox`: generar `pubsub_token` al crear (`has_secure_token :pubsub_token`).
5. `Account`: `has_many :web_widget_channels, class_name: 'Channel::WebWidget',
   dependent: :destroy`.
6. `Inbox`: helper `web_widget?` y `web_widget_script` (snippet con `website_token`).

**Verificación:**
- `docker exec ventia-messaging bundle exec rails db:migrate`.
- Consola: crear un `Channel::WebWidget` → tiene `website_token` y `hmac_token`;
  `widget_config.key?(:hmac_token)` → false. Crear un `ContactInbox` → tiene
  `pubsub_token` único.

---

## Fase 2 — Rails: extender `RoomChannel` (agente **o** visitante)

**Tiempo estimado:** 0.5 d

**Objetivo:** un `ContactInbox` puede suscribirse a su propio stream por `pubsub_token`,
sin romper el flujo de agentes.

**Archivos:**
- `apps/messaging/app/channels/room_channel.rb`

**Cambios:**
1. `subscribed`: resolver `pubsub_token` contra `User` **o** `ContactInbox`:
   - `User` → comportamiento actual (`subscribe_as_agent`: presence + `stream_from
     pubsub_token` + `stream_from "account_#{id}"`).
   - `ContactInbox` → `subscribe_as_visitor`: **solo** `stream_from pubsub_token`. Sin
     presence de agentes, sin `account_#{id}`.
   - Ninguno → `reject`.
2. Refactor mínimo extrayendo los dos caminos a métodos privados; no tocar la lógica de
   agente existente.

**Verificación:**
- rspec (Fase 10): `User` se suscribe sin regresión; `ContactInbox` se suscribe a su
  stream; token desconocido → `reject`.
- Manual: con un `pubsub_token` de un `ContactInbox`, suscribir por `wscat`/JS a
  `/cable` → conexión aceptada.

---

## Fase 3 — Rails: API pública — `config`, `contacts` (anónimo + HMAC)

**Tiempo estimado:** 0.75 d

**Objetivo:** el widget obtiene su config, crea un contacto/sesión y puede identificarse
por HMAC.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/widget/base_controller.rb` (nuevo)
- `apps/messaging/app/controllers/api/v1/widget/configs_controller.rb` (nuevo)
- `apps/messaging/app/controllers/api/v1/widget/contacts_controller.rb` (nuevo)
- `apps/messaging/config/routes.rb`

**Cambios:**
1. `Widget::BaseController`: **no** pasa por `set_current_account` de agentes. Resuelve el
   canal por `website_token` (params) o por el JWT; valida **Origin** contra
   `channel.website_url`; helper `current_contact_inbox` (decodifica JWT →
   `ContactInbox.find_by(source_id:, inbox_id:)`); `render_unauthorized` (401) si falta/
   inválido.
2. `GET /api/v1/widget/config?website_token=…` → `channel.widget_config` (sin `hmac_token`).
3. `POST /api/v1/widget/contacts` → crea `Contact` anónimo + `ContactInbox`
   (`source_id = SecureRandom.uuid`); responde `{ pubsub_token, jwt }` (JWT vía
   `Widget::Token`).
4. `PATCH /api/v1/widget/contacts` (`set_user`): recibe `identifier` + `identifier_hash`;
   recomputa `HMAC-SHA256(channel.hmac_token, identifier)` y compara con
   `secure_compare`; si OK → find_or_create `Contact` por `identifier` y reasigna el
   `ContactInbox` (spec §3.3, §Riesgos #7). Si `hmac_mandatory` y no hay hash válido → 401.
5. Rutas bajo `namespace :widget` dentro de `api/v1`.

**Verificación:**
- `curl GET …/widget/config?website_token=…` → JSON sin `hmac_token`.
- `curl POST …/widget/contacts` → devuelve `pubsub_token` + `jwt`.
- `set_user` con hash correcto identifica el contacto; con hash incorrecto → 401;
  `hmac_mandatory` rechaza anónimos.

---

## Fase 4 — Rails: API pública — `conversations`, `messages` (ingreso + visitor info)

**Tiempo estimado:** 0.5 d

**Objetivo:** el visitante abre conversación, envía mensajes (que notifican al agente) y
lee el historial.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/widget/conversations_controller.rb` (nuevo)
- `apps/messaging/app/controllers/api/v1/widget/messages_controller.rb` (nuevo)
- `apps/messaging/app/models/message.rb` (serializer `as_widget_json` si no existe)
- `apps/messaging/config/routes.rb`

**Cambios:**
1. `POST /api/v1/widget/conversations` (jwt): `find_or_create_conversation` para el
   `contact_inbox` (reabrir la última `open` o crear nueva); al crear, setea
   `additional_attributes`: `referer`, `browser` (UA), `current_url`, `initiated_at`
   (recibidos del widget); emite el `welcome_message` como primer mensaje del bot.
2. `POST /api/v1/widget/messages` (jwt): crea `Message` `incoming` (`content`,
   `source_id = uuid cliente` para echo/dedup). `after_create_commit broadcast(:message_created)`
   ya notifica al panel de agentes.
3. `GET /api/v1/widget/messages` (jwt): historial paginado de la conversación, serializado
   con `as_widget_json` (id, content, message_type, created_at, attachments) — sin datos
   internos del agente/cuenta.

**Verificación:**
- `curl POST …/widget/messages` (con JWT) → aparece la conversación + mensaje en el panel
  de agentes; `additional_attributes` trae referer/UA/URL.
- `GET …/widget/messages` devuelve el historial acotado.

---

## Fase 5 — Rails: salida `WebWidget::SendOnWebWidgetService`

**Tiempo estimado:** 0.25 d

**Objetivo:** la respuesta del agente llega al visitante en tiempo real por ActionCable.

**Archivos:**
- `apps/messaging/app/services/web_widget/send_on_web_widget_service.rb` (nuevo)
- `apps/messaging/app/jobs/send_reply_job.rb`

**Cambios:**
1. `WebWidget::SendOnWebWidgetService < Base::SendOnChannelService`
   (`channel_class = Channel::WebWidget`, `perform_reply`):
   - `ActionCable.server.broadcast(contact_inbox.pubsub_token,
     { event: 'message.created', data: message.as_widget_json })`.
   - `message.update!(status: :sent)`. **No** hay API externa; el envío ES el push.
2. Registrar `'Channel::WebWidget' => ::WebWidget::SendOnWebWidgetService` en
   `SendReplyJob::CHANNEL_SERVICES`.

**Verificación:**
- Suscribir un cliente WS al `pubsub_token` del visitante; crear un `Message outgoing` en
  esa conversación desde consola → el cliente WS recibe `message.created`. End-to-end por
  consola/curl sin UI todavía.

---

## Fase 6 — Rails: alta del canal (panel admin backend)

**Tiempo estimado:** 0.25 d

**Objetivo:** crear un inbox `web_widget` vía API con su config inicial.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/inboxes_controller.rb`
- (serializer del canal con `website_token` + snippet)

**Cambios:**
1. `build_channel`: rama `when 'web_widget'` →
   `current_account.web_widget_channels.create!(...)` con la config del builder
   (color, avatar, welcome_*, website_url, branding_enabled, hmac_mandatory).
2. `channel_params`: permitir los campos del canal web widget.
3. Respuesta de detalle: `website_token`, **snippet listo para copiar**, estado. El
   `hmac_token` **no** se devuelve por defecto (acción explícita "revelar").

**Verificación:** `curl POST /api/v1/inboxes` con `channel: { type: 'web_widget', ... }`
→ crea `Channel::WebWidget` + `Inbox`; el detalle trae el snippet y **no** el `hmac_token`.

---

## Fase 7 — Proxy FastAPI + Next

**Tiempo estimado:** 0.5 d

**Objetivo:** la config del canal viaja desde el frontend hasta Rails.

**Archivos:**
- `apps/backend/app/schemas/messaging.py`
- `apps/backend/app/services/messaging_service.py`
- `apps/backend/app/api/v1/endpoints/messaging.py`
- Route handlers Next + `apps/frontend/lib/api-client/messaging.ts`
- `apps/frontend/lib/types/messaging.ts`

**Cambios:**
1. Pydantic: `WebWidgetChannelCreate`/`WebWidgetChannelConfig`. `hmac_token` **write-only /
   nunca en responses**; el `website_token` sí se devuelve (es público).
2. Endpoint + service proxy (crear/actualizar canal, listar/detalle con snippet),
   propagando `X-Tenant-Id`/`X-User-Id` como el resto.
3. Next route handler + api-client + tipo `WebWidgetChannel` en TS.

**Verificación:** `cd apps/backend && uv run python -c "from app.schemas.messaging import
WebWidgetChannelCreate"`; `cd apps/frontend && pnpm build` (typecheck); `curl` end-to-end.

---

## Fase 8 — Frontend: panel admin (builder + preview + snippet)

**Tiempo estimado:** 1.0 d

**Objetivo:** crear y configurar el canal Chat Web con vista previa en vivo y snippet
copiable.

**Archivos:**
- `apps/frontend/app/dashboard/settings/inboxes/new/web-widget-client.tsx` (nuevo)
- `apps/frontend/components/web-widget/channel-builder.tsx` (nuevo)
- `apps/frontend/components/web-widget/widget-preview.tsx` (nuevo)

**Cambios:**
1. **Widget builder** (aplicar skills `frontend-design` / `interface-design`): color
   primario, avatar, welcome title/tagline/message, reply_time, toggle branding, toggle
   HMAC obligatorio.
2. **Preview en vivo** que refleja la config (burbuja + panel con los textos/colores).
3. Pantalla post-creación: **snippet copiable** (con `website_token`) + `hmac_token`
   mostrado una vez con instrucciones de firma server-side.
4. Card de estado del canal y gating por rol (`administrator`/`superadmin`).

**Verificación:** crear el canal desde la UI → copiar snippet; el preview coincide con la
config guardada.

---

## Fase 9 — Repo `ventia-chat-widget` (Vite) — el widget embebible

**Tiempo estimado:** 1.5 d

**Objetivo:** `widget.js` standalone que consume la API pública + ActionCable.

**Archivos (repo nuevo `ventia-chat-widget`):**
- `vite.config.ts` (library mode, `formats: ['iife']`, `cssCodeSplit: false`)
- `src/bootstrap.ts`, `src/sdk.ts`
- `src/api/client.ts`, `src/api/cable.ts`
- `src/store/store.ts`
- `src/components/{Bubble,Header,MessageList,Message,Composer,Branding}.tsx`
- `src/styles/*`

**Cambios:**
1. **Bootstrap:** lee `data-tenant` (`website_token`), monta el host en **Shadow DOM**,
   `GET /config`, arranca el store.
2. **Sesión:** lee `cw_conversation` de `localStorage`; si no hay → `POST /contacts` →
   guarda JWT. Abre ActionCable con `pubsub_token`.
3. **API client:** fetch wrapper con base URL + `Authorization: <jwt>`; maneja 401
   (recrea contacto).
4. **Cable:** suscripción `RoomChannel { pubsub_token }`; on `message.created` → push al
   store → render + `unread` si el panel está cerrado.
5. **UI:** burbuja flotante, header (avatar + reply_time), lista de mensajes, composer;
   captura `location.href`/`document.referrer`/`navigator.userAgent` y la manda con el
   primer mensaje. **Responsive** (full-screen en móvil). **Branding** condicional a
   `config.branding_enabled`.
6. **SDK:** `window.ventiaSDK.setUser(id, { identifier_hash, name, email })` → `PATCH
   /contacts`; `toggle()`, `reset()`.
7. **Build:** `vite build` → `widget.js` single-file; documentar subida a CDN/versionado.

**Verificación:** página HTML de prueba con el snippet → abre el chat, envía mensaje (lo
ve el agente), responde el agente y llega al widget en tiempo real; recargar la página →
el hilo persiste (localStorage); responsive en viewport móvil; branding on/off.

---

## Fase 10 — Tests Rails

**Tiempo estimado:** 0.5 d

**Archivos:**
- `apps/messaging/spec/models/channel/web_widget_spec.rb`
- `apps/messaging/spec/channels/room_channel_spec.rb`
- `apps/messaging/spec/requests/api/v1/widget/contacts_spec.rb`
- `apps/messaging/spec/requests/api/v1/widget/messages_spec.rb`
- `apps/messaging/spec/services/web_widget/send_on_web_widget_service_spec.rb`

**Casos:** ver spec §Testing — `widget_config` sin `hmac_token`; `contacts` anónimo
(pubsub_token+JWT) y `set_user` HMAC (válido identifica / inválido 401 / `hmac_mandatory`
rechaza); `messages` crea `incoming` + visitor info, JWT inválido → 401, Origin no
permitido → bloqueado; `SendOnWebWidgetService` hace `broadcast` al `pubsub_token`
correcto; `RoomChannel` agente (sin regresión) / visitante / token desconocido `reject`.

**Verificación:** `docker cp` de specs + `docker exec ventia-messaging bundle exec rspec
spec/services/web_widget spec/requests/api/v1/widget spec/models/channel/web_widget_spec.rb
spec/channels/room_channel_spec.rb`.

---

## Fase 11 — Tests widget + pytest + verificación e2e

**Tiempo estimado:** 0.5 d

**Archivos:**
- `ventia-chat-widget/` tests (Vitest unit + Playwright e2e)
- `apps/backend/tests/unit/services/test_messaging_web_widget_channel.py`

**Casos:**
- **Widget (Vitest/Playwright):** bootstrap lee `data-tenant` → pide config; persistencia
  (recargar reusa JWT de localStorage); recibe `message.created` por ActionCable y lo
  pinta; responsive (full-screen en móvil); branding condicional.
- **pytest:** el proxy crea/actualiza el canal y **nunca** devuelve `hmac_token`.

**Verificación e2e (manual):** snippet en una página de prueba → enviar/recibir en tiempo
real → persistencia tras recarga → identidad HMAC desde un backend de prueba que firma el
`identifier_hash`.

---

## Riesgos / puntos a confirmar al implementar

1. **`RoomChannel` solo-agente (Fase 2) — load-bearing.** Hoy `reject`a sin `User`
   (`room_channel.rb:6-9`). Es código compartido con el flujo de agentes → testear que no
   haya regresión en presence/streams. Ver spec §4, §Riesgos #1.
2. **`contact_inboxes.pubsub_token` no existe (Fase 1).** Migración nueva; sin backfill
   (solo aplica a contactos de widget). Ver spec §Riesgos #2.
3. **API pública sin `X-Tenant-Id` (Fase 3).** El `Widget::BaseController` deriva la
   cuenta del `website_token`/JWT y NO debe pasar por el `set_current_account` de agentes.
   Namespaces separados. Ver spec §Riesgos #3.
4. **CDN del widget (Fase 9).** Dónde se hostea `chat.ventia.pe/widget.js`, cache/
   versionado/invalidación. Infra fuera del monorepo; coordinar. Ver spec §Riesgos #4.
5. **CORS por canal (Fase 0/3).** Lista blanca de dominios por canal (no `*`). Definir
   estricto vs permisivo en v1. Ver spec §Riesgos #5.
6. **WSS desde dominios de terceros (Fase 0).** `ActionCable.allowed_request_origins` debe
   admitir los orígenes de los sitios cliente. Confirmar `cable.yml`/Origins. Ver spec
   §Riesgos #6.
7. **Fusión anónimo→identificado (Fase 3).** Política v1: reasignar el `ContactInbox` al
   contacto identificado (sin fusionar historiales). Confirmar. Ver spec §Riesgos #7.
8. **Rate limiting (Fase 0).** `rack-attack` en endpoints públicos; confirmar umbrales.
   Ver spec §Riesgos #8.
