# Canal Chat Web (Web Widget embebible) — Diseño técnico

**Fecha:** 2026-06-10
**Tarea:** [US-CANAL-002: Integración canal Chat Web](https://app.clickup.com/t/86ah8xv65) (Sprint sem2-junio-2026)
**Rama sugerida:** `feat/canal-chat-web-widget`
**Estimación de la tarea:** 5–7 días
**Estado:** Diseño propuesto (pendiente de plan de implementación)

## Objetivo

Agregar a Ventia un **canal de Chat Web**: un **widget JavaScript embebible**
(`ventia-chat-widget`, build standalone con Vite) que el cliente inserta en su sitio
con un snippet `<script>`. El widget:

- Crea un **inbox `web_widget`** en messaging y abre **conversaciones en tiempo real**
  vía **ActionCable** (igual pipeline de conversaciones/mensajes que WhatsApp/Instagram).
- Es **configurable desde el panel admin**: color primario, avatar, mensaje de
  bienvenida.
- **Notifica al agente** (push/broadcast existente) cuando llega un mensaje del visitante.
- Es **mobile responsive**.
- **Persiste la conversación** del visitante con un **token firmado en `localStorage`**
  (el visitante recupera su hilo al volver).
- **Captura visitor info** (URL actual, referrer, user-agent) como contexto para el agente.
- Soporta **identidad verificada por HMAC** (`identifier_hash`) para atar la conversación
  a un usuario logueado del sitio cliente.
- Muestra branding **"Powered by VentIA"** configurable (visible en plan gratis, oculto
  en plan pago).

El canal debe encajar en el **patrón polimórfico de canales ya existente**, sin reescribir
el pipeline de conversaciones/mensajes.

## Contexto y reutilización

El servicio de messaging es un **derivado de Chatwoot** (modelo polimórfico de canales,
`Message#content_type`, `RoomChannel` sobre ActionCable, comentarios "Chatwoot pattern").
Chatwoot tiene un **canal Web Widget maduro** (`Channel::WebWidget` + API pública
`api/v1/widget/*` + suscripción ActionCable por `pubsub_token`) del cual nos basamos
directamente, adaptándolo a las convenciones de este repo.

### Patrón de canal ya existente (lo que reutilizamos)

- **Canal = entidad polimórfica.** `Channel::Whatsapp` / `Channel::Instagram` son clases
  `< ApplicationRecord` con `self.table_name = 'channel_x'`, `belongs_to :account`,
  `has_one :inbox, as: :channel, dependent: :destroy`, `provider_config` jsonb y el
  concern `Reauthorizable` (`apps/messaging/app/models/channel/whatsapp.rb`).
- **Inbox polimórfico** (`channel_type` + `channel_id`) es el contenedor del canal. Se
  crea en `Api::V1::InboxesController#create_inbox_with_channel` → `build_channel` (case
  por `channel_params[:type]`), en transacción
  (`apps/messaging/app/controllers/api/v1/inboxes_controller.rb`).
- **`Account`** ya expone `whatsapp_channels`/`instagram_channels`; agregaremos
  `web_widget_channels`.
- **Resolución de contacto:** `ContactInbox` (join `contact`↔`inbox`) con `source_id`
  (NOT NULL, único por inbox). Para el widget, `source_id` = **token de navegador** del
  visitante (no un teléfono/IGSID).
- **Conversación:** `belongs_to :contact_inbox`; tiene `additional_attributes` jsonb
  (lo usaremos para `referer`, `initiated_at`, `browser`/user-agent del visitante) y
  `ai_agent_enabled`.
- **Mensaje:** `Message` tiene `message_type` (`incoming`/`outgoing`), `source_id`
  (indexado) y broadcasting por ActionCable. El callback `after_create_commit
  :send_reply` encola `SendReplyJob` para `outgoing`/`template`
  (`apps/messaging/app/models/message.rb`).
- **Envío saliente unificado:** `SendReplyJob` mapea `channel_type → service` en
  `CHANNEL_SERVICES`; cada servicio hereda de `Base::SendOnChannelService` (template
  method: valida canal, `outgoing?`, `perform_reply`).
- **Tiempo real:** `RoomChannel` (`apps/messaging/app/channels/room_channel.rb`) hace
  `stream_from pubsub_token` + `stream_from "account_#{id}"`. `Message`/`Conversation`
  hacen `broadcast(:message_created)` tras commit. El frontend de agentes ya consume estos
  eventos.
- **Multitenancy:** header `X-Tenant-Id` → `Account.ventia_tenant_id`
  (`apps/messaging/app/controllers/api/v1/base_controller.rb`). **Importante:** la API
  **pública** del widget NO usa este header (el visitante no conoce el tenant); el tenant
  se deriva del `website_token`/JWT (ver §3).

### Diferencia clave vs. WhatsApp/Instagram (lo que hace único a este canal)

WhatsApp/Instagram son **canales con proveedor externo**: entran por **webhook de Meta**
y salen llamando a la **API de Meta** (`SendOnWhatsappService` hace un HTTP POST a la
Cloud API). El Chat Web **no tiene proveedor externo**: el "otro lado" es el propio
**widget en el navegador del visitante**, conectado a **nuestro** ActionCable. Esto
implica dos inversiones respecto a los otros canales:

1. **Entrada (visitante→agente):** no hay webhook de un tercero. El widget hace `POST`
   directo a una **API pública nuestra** (`api/v1/widget/messages`). El "ingreso" es un
   controller público, no un `IncomingMessageService` disparado por webhook externo.
2. **Salida (agente→visitante):** no hay API externa que llamar. `SendOnWebWidgetService`
   **solo hace `broadcast`** al `pubsub_token` del visitante por ActionCable; el widget,
   suscrito, lo pinta. El "envío" ES el push en tiempo real.

Y una **divergencia de infraestructura** respecto al Chatwoot/Ventia actual: el visitante
es un **`Contact`, no un `User`**, y hoy `RoomChannel` solo admite `User` (ver §4 y
§Riesgos #1).

## Mapeo de acceptance criteria → diseño

| AC (ClickUp) | Dónde se resuelve |
|---|---|
| Snippet `<script src="https://chat.ventia.pe/widget.js" data-tenant="X">` carga el widget | Repo `ventia-chat-widget` (build Vite IIFE single-file) + bootstrap que lee `data-tenant` (= `website_token`) → `GET /api/v1/widget/config` (§5, §6) |
| Widget configurable: color, avatar, mensaje de bienvenida (desde panel admin) | Columnas en `channel_web_widget` (`widget_color`, `avatar`, `welcome_title`, `welcome_tagline`, `welcome_message`) + builder en `dashboard/settings/inboxes/new` (§2, §7) |
| Conversaciones en tiempo real (WebSocket vía ActionCable) | Visitante se suscribe a `RoomChannel` con su `pubsub_token`; `SendOnWebWidgetService` hace `broadcast` (§3, §4) |
| Notificaciones push al agente cuando llega mensaje | `Message incoming` → `broadcast(:message_created)` existente → frontend de agentes (§3) |
| Mobile responsive | Widget Vite con CSS responsive + breakpoint full-screen en móvil (§6) |
| Persistencia de conversación con localStorage (visitor token) | JWT `cw_conversation` (contiene `source_id`+`inbox_id`) persistido en `localStorage` (§3.2) |
| Captura de visitor info: URL, referrer, user agent | `Conversation.additional_attributes` (`referer`, `browser`, URL) seteados al crear la conversación (§3.1) |
| Branding "Powered by VentIA" configurable (gratis sí / pago no) | `channel_web_widget.branding_enabled` → expuesto en `/config` → render condicional en el widget (§2, §6) |
| Identidad de usuario (HMAC) | `setUser(identifier, { identifier_hash })`; `identifier_hash = HMAC-SHA256(hmac_token, identifier)`; `hmac_mandatory` (§3.3) |

## Decisiones (cerradas)

- **Transporte:** **REST público para enviar + ActionCable para recibir** (modelo
  Chatwoot). El widget hace `POST` a `api/v1/widget/*` y se suscribe a `RoomChannel` por
  `pubsub_token`. No se inventa un canal WebSocket bidireccional ni polling.
- **Auth pública por JWT firmado** (`cw_conversation`) con el secret de Rails; el payload
  lleva `source_id` (token de navegador del visitante) + `inbox_id`. Se persiste en
  `localStorage` → habilita la persistencia del hilo (AC).
- **HMAC en v1** (`identifier_hash`) para identidad verificada del visitante; columnas
  `hmac_token` + `hmac_mandatory` en el canal.
- **`ContactInbox.source_id`** = token de navegador (UUID generado al crear el contacto;
  NO PII). **`ContactInbox.pubsub_token`** (columna nueva) = canal ActionCable del visitante.
- **`Message.source_id`** para el widget: UUID del mensaje del lado cliente (echo/dedup
  optimista); no es load-bearing como en email/WhatsApp.
- **`RoomChannel` se extiende** para resolver **`User` O `ContactInbox`** por
  `pubsub_token`, sin romper el flujo de agentes (ver §4).
- **Widget = repo separado `ventia-chat-widget`** (Vite, build single-file servido por
  CDN). El monorepo solo aloja el backend del canal + el panel admin; el spec documenta
  el widget a igual profundidad (§6).
- **Pre-chat form fuera del v1** (solo costuras `pre_chat_form_enabled` /
  `pre_chat_form_options`). El contacto v1 nace anónimo (o identificado por HMAC).

## Arquitectura

Tres piezas:

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│  ventia-chat-widget      │  HTTPS  │  messaging (Rails)                    │
│  (widget.js, Vite, CDN)  │ ──────► │  API pública  api/v1/widget/*         │
│  - burbuja + panel chat  │  POST   │   WidgetController (config/bootstrap) │
│  - store (AC, mensajes)  │ messages│   Widget::{Contacts,Conversations,    │
│  - localStorage JWT      │         │             Messages}Controller       │
│                          │  WSS    │  ActionCable RoomChannel              │
│                          │ ◄══════ │   (stream_from pubsub_token visitante)│
└─────────────────────────┘ broadcast└──────────────────────────────────────┘
                                                  ▲  Message incoming → broadcast(:message_created)
                                                  │  Message outgoing → SendReplyJob →
                                                  │     WebWidget::SendOnWebWidgetService → broadcast
                                          ┌────────────────────┐
                                          │ Frontend agentes    │
                                          │ (Next + FastAPI)    │
                                          │ panel admin + builder│
                                          └────────────────────┘
```

### 1. Modelo de datos (Rails)

**Migración nueva** `create_channel_web_widget` (respetar schema `messaging`, como el
resto de tablas):

```ruby
create_table :channel_web_widget do |t|
  t.bigint  :account_id, null: false

  # Identidad pública del inbox
  t.string  :website_token, null: false            # = data-tenant del snippet
  t.string  :hmac_token,    null: false            # secreto para identifier_hash

  # Config visible (builder del panel admin)
  t.string  :website_url,   default: '', null: false # dominio(s) permitido(s) (CORS)
  t.string  :widget_color,  default: '#1f93ff', null: false
  t.string  :avatar                                  # URL del avatar del agente/bot
  t.string  :welcome_title,   default: ''
  t.string  :welcome_tagline, default: ''
  t.text    :welcome_message, default: ''            # channel greeting (1er mensaje)
  t.string  :reply_time,    default: 'in_a_few_minutes' # in_a_few_minutes|in_a_few_hours|in_a_day

  # Identidad / seguridad
  t.boolean :hmac_mandatory, default: false, null: false

  # Branding
  t.boolean :branding_enabled, default: true, null: false # "Powered by VentIA"

  # Forward-compat (NO implementado en v1)
  t.boolean :pre_chat_form_enabled, default: false, null: false
  t.jsonb   :pre_chat_form_options, default: {}, null: false
  t.jsonb   :feature_flags,         default: {}, null: false # {attachments:, emoji:}

  t.jsonb   :provider_config, default: {}, null: false
  t.timestamps
end
add_index :channel_web_widget, :website_token, unique: true
add_index :channel_web_widget, :account_id
```

**Migración** `add_pubsub_token_to_contact_inboxes` (pieza load-bearing del tiempo real):

```ruby
add_column :contact_inboxes, :pubsub_token, :string
add_index  :contact_inboxes, :pubsub_token, unique: true
```

**`Channel::WebWidget`** (mismo molde que `Channel::Whatsapp`):

```ruby
class Channel::WebWidget < ApplicationRecord
  include Reauthorizable
  self.table_name = 'channel_web_widget'

  has_secure_token :website_token       # 24+ chars URL-safe, único
  before_validation :ensure_hmac_token, on: :create

  validates :website_token, presence: true, uniqueness: true
  validates :account_id, presence: true

  belongs_to :account
  has_one :inbox, as: :channel, dependent: :destroy

  def name = 'Chat Web'

  # config pública que consume el widget (NUNCA expone hmac_token)
  def widget_config
    {
      website_token:, widget_color:, avatar:,
      welcome_title:, welcome_tagline:, welcome_message:,
      reply_time:, hmac_mandatory:, branding_enabled:,
      pre_chat_form_enabled:, feature_flags:
    }
  end

  private

  def ensure_hmac_token
    self.hmac_token ||= SecureRandom.hex(16)
  end
end
```

- `Account`: agregar `has_many :web_widget_channels, class_name: 'Channel::WebWidget',
  dependent: :destroy`.
- `ContactInbox`: generar `pubsub_token` al crear (`has_secure_token :pubsub_token` o
  `before_create`); exponerlo solo a través de la API pública del widget para ese visitante.
- `Inbox`: helper `def web_widget?` y, si aplica, `web_widget_script` (snippet listo para
  copiar, construido con `website_token` + URL del CDN).

### 2. Identidad pública del canal

- **`website_token`**: identificador **público** del inbox. Es el `data-tenant="X"` del
  snippet. Con él, el widget pide su config (`GET /api/v1/widget/config?website_token=…`)
  sin autenticación previa. No es secreto (va en el HTML del cliente).
- **`hmac_token`**: **secreto** del canal. NUNCA se expone en `/config` ni en responses
  del proxy. Se usa server-side del cliente para firmar `identifier_hash` (§3.3) y
  server-side nuestro para validarlo. Se muestra una sola vez en el panel admin (o se
  revela bajo acción explícita), igual que un API key.

### 3. Flujo de mensajes y sesión

#### 3.1 Bootstrap y entrada (visitante → agente)

```
1. Widget carga (snippet) → lee data-tenant (website_token)
2. GET /api/v1/widget/config?website_token=…           → widget_config (sin auth)
3. ¿Hay JWT cw_conversation en localStorage?
     NO  → POST /api/v1/widget/contacts (crea Contact + ContactInbox anónimos)
            ← devuelve { pubsub_token, jwt cw_conversation }  → guardar en localStorage
     SÍ  → se reutiliza (persistencia del hilo)
4. Widget abre WSS /cable y subscribe RoomChannel { pubsub_token }
5. Visitante escribe → POST /api/v1/widget/messages  (Authorization: jwt)
     → resuelve ContactInbox por source_id del JWT
     → find_or_create_conversation
     → Message incoming (message_type: :incoming, content)
     → setea conversation.additional_attributes: referer, browser (UA), current_url, initiated_at
     → after_create_commit broadcast(:message_created)  → notifica al panel de agentes (push)
```

**`find_or_create_conversation`**: una conversación abierta por `contact_inbox` (reabrir
la última si sigue `open`, o crear nueva). El `welcome_message` del canal se emite como
primer `Message outgoing` (de tipo bot/activity) al iniciar.

#### 3.2 Persistencia de sesión (JWT `cw_conversation`)

- Al crear el contacto, el backend firma un **JWT** con el secret de Rails:
  `payload = { source_id:, inbox_id: }`. Se devuelve al widget y se guarda en
  `localStorage` (clave `cw_conversation`).
- Cada request a `api/v1/widget/*` (salvo `/config`) manda `Authorization: <jwt>`. El
  controller decodifica el JWT → `ContactInbox.find_by(source_id:, inbox_id:)`. Si el
  token falta/expira/es inválido → 401 (el widget recrea contacto).
- Esto cubre el AC de **persistencia con localStorage**: el visitante recupera su hilo al
  recargar o volver al sitio.

#### 3.3 Identidad verificada (HMAC) — v1

Para atar la conversación a un **usuario real** del sitio cliente (no solo a un token de
navegador):

- El sitio cliente, **server-side**, calcula
  `identifier_hash = HMAC-SHA256(hmac_token, identifier)` (donde `identifier` es el id
  estable del usuario en su sistema) y se lo pasa al widget vía
  `window.ventiaSDK.setUser(identifier, { name, email, identifier_hash })`.
- El widget manda `identifier` + `identifier_hash` (+ atributos) en
  `POST /api/v1/widget/contacts` / un endpoint `set_user`. El backend **recomputa** el
  HMAC con su `hmac_token` y compara (comparación segura, `ActiveSupport::SecurityUtils
  .secure_compare`). Si coincide:
  - resuelve/crea el `Contact` por `identifier` (único por account) y lo asocia al
    `ContactInbox` del visitante (fusiona el contacto anónimo con el identificado).
- Si `hmac_mandatory` está activo, se **rechaza** cualquier `setUser` sin
  `identifier_hash` válido (no se permiten visitantes anónimos en ese canal).

#### 3.4 Salida (agente → visitante)

Reutiliza el pipeline existente, sin camino paralelo:

```
Agente responde en el panel → Message outgoing
  → after_create_commit :send_reply → SendReplyJob
     → CHANNEL_SERVICES['Channel::WebWidget'] = WebWidget::SendOnWebWidgetService
        → Base::SendOnChannelService#perform (valida canal + outgoing?)
           → perform_reply: ActionCable.server.broadcast(
                 contact_inbox.pubsub_token,
                 { event: 'message.created', data: message.as_widget_json }
             )
```

`WebWidget::SendOnWebWidgetService < Base::SendOnChannelService`:
- `channel_class = Channel::WebWidget`.
- `perform_reply`: hace `broadcast` al `pubsub_token` del `contact_inbox` del mensaje.
  **No hay API externa** — el envío ES el push. Marca `message.update!(status: :sent)`
  (o `delivered` cuando el widget confirme recepción, opcional v1).

Registrar `Channel::WebWidget => ::WebWidget::SendOnWebWidgetService` en
`SendReplyJob::CHANNEL_SERVICES`.

### 4. Tiempo real — extensión de `RoomChannel`

**Estado actual (divergencia con Chatwoot):** `RoomChannel#subscribed`
(`apps/messaging/app/channels/room_channel.rb:6-9`) hace `reject` si no encuentra un
`User` por `pubsub_token`. El visitante es un `Contact`/`ContactInbox`, así que hoy no
podría suscribirse.

**Cambio:** resolver `pubsub_token` contra **`User` O `ContactInbox`**:

```ruby
def subscribed
  if (user = User.find_by(pubsub_token: pubsub_token))
    subscribe_as_agent(user)        # comportamiento actual (presence, account stream)
  elsif (contact_inbox = ContactInbox.find_by(pubsub_token: pubsub_token))
    subscribe_as_visitor(contact_inbox)  # stream_from pubsub_token (solo su scope)
  else
    reject
  end
end
```

- `subscribe_as_visitor` hace **solo** `stream_from pubsub_token` (su canal privado). NO
  se suscribe a `account_#{id}` ni participa de presence de agentes → aislamiento.
- El visitante recibe `message.created`, `conversation.status_changed` y un
  `presence.update` de "agente escribiendo"/online si se decide exponerlo (opcional v1).
- El flujo de agentes (`subscribe_as_agent`) queda **idéntico** al actual → sin regresión.

### 5. API pública del widget (controllers)

Namespace público **sin** `X-Tenant-Id` ni auth de agente. Hereda de un
`Api::V1::Widget::BaseController` que:
- resuelve el canal/inbox por `website_token` (params) o por el JWT,
- valida **CORS/Origin** contra `website_url` del canal,
- decodifica el JWT `cw_conversation` para los endpoints autenticados.

| Endpoint | Auth | Qué hace |
|---|---|---|
| `GET /api/v1/widget/config` | website_token | Devuelve `widget_config` (sin `hmac_token`). |
| `POST /api/v1/widget/contacts` | website_token | Crea `Contact`+`ContactInbox` anónimos; devuelve `pubsub_token` + JWT. |
| `PATCH /api/v1/widget/contacts` (`set_user`) | jwt | Aplica HMAC `identifier_hash` → identifica/fusiona contacto. |
| `POST /api/v1/widget/conversations` | jwt | Abre conversación (si no hay abierta). |
| `GET /api/v1/widget/messages` | jwt | Historial de mensajes de la conversación (paginado). |
| `POST /api/v1/widget/messages` | jwt | Crea `Message incoming` + setea visitor info. |

Respuestas en el formato del repo (`{ success:, data: }`), pero con un serializer de
mensaje **acotado al widget** (`as_widget_json`: id, content, message_type, created_at,
attachments) — nunca datos internos del agente/cuenta.

### 6. Widget `ventia-chat-widget` (repo nuevo, Vite) — a igual profundidad

**Objetivo:** un único `widget.js` (+ CSS inyectado) servido por CDN
(`https://chat.ventia.pe/widget.js`), que el cliente incrusta con un `<script>`.

**Stack:** Vite + (Preact o Vue 3, ligero) + TypeScript. Build **IIFE/UMD single-file**
(`build.lib` con `formats: ['iife']`, `cssCodeSplit: false`) para que sea un solo archivo
auto-contenido. Objetivo de peso: bundle gzipped pequeño (~30–50 KB), sin dependencias
pesadas.

**Snippet de inserción** (lo que copia el cliente desde el panel):

```html
<script>
  (function(d,t){
    var s=d.createElement('script');s.async=1;
    s.src='https://chat.ventia.pe/widget.js';
    s.setAttribute('data-tenant','WEBSITE_TOKEN');
    d.getElementsByTagName('head')[0].appendChild(s);
  })(document);
</script>
```

**Estructura del repo:**

```
ventia-chat-widget/
├─ src/
│  ├─ bootstrap.ts        # lee data-tenant, monta el host (Shadow DOM), arranca
│  ├─ api/
│  │  ├─ client.ts        # fetch wrapper (base URL, JWT en header, manejo 401)
│  │  └─ cable.ts         # conexión ActionCable (WSS /cable) por pubsub_token
│  ├─ store/
│  │  └─ store.ts         # estado: config, mensajes, conexión, unread, identidad
│  ├─ components/
│  │  ├─ Bubble.tsx       # burbuja flotante (abrir/cerrar, badge unread)
│  │  ├─ Header.tsx       # título + reply_time + avatar
│  │  ├─ MessageList.tsx  # lista de mensajes (incoming/outgoing, timestamps)
│  │  ├─ Message.tsx      # burbuja de mensaje + adjuntos
│  │  ├─ Composer.tsx     # input + envío (+ emoji/adjuntos si feature_flag)
│  │  └─ Branding.tsx     # "Powered by VentIA" (condicional branding_enabled)
│  ├─ sdk.ts              # window.ventiaSDK: setUser(), toggle(), reset()
│  └─ styles/             # CSS scoped (Shadow DOM)
├─ vite.config.ts
└─ package.json
```

**Aislamiento de estilos:** montar el widget en un **Shadow DOM** (host `<div>` inyectado
en `<body>`) para que el CSS del widget no choque con el del sitio cliente ni viceversa.

**Ciclo de vida (store):**
1. `bootstrap` lee `data-tenant` → `GET /config` → guarda config en el store.
2. Resuelve sesión: lee `cw_conversation` de `localStorage`; si no hay, `POST /contacts`.
3. Abre ActionCable con `pubsub_token`; on `message.created` → push al store → render +
   incrementa `unread` si el panel está cerrado.
4. Captura visitor info (`location.href`, `document.referrer`, `navigator.userAgent`) y la
   envía con el primer mensaje.
5. `window.ventiaSDK.setUser(id, { identifier_hash, name, email })` → `PATCH /contacts`.

**Responsive:** burbuja + panel flotante en desktop (esquina inferior derecha); en móvil
(`max-width` breakpoint) el panel pasa a **full-screen**.

**Branding:** `Branding.tsx` se renderiza solo si `config.branding_enabled` (plan gratis);
en plan pago el panel admin lo desactiva y desaparece.

**Distribución/versionado:** build subido a CDN. Estrategia de cache: `widget.js`
inmutable por versión (`widget.<hash>.js`) + un loader estable en `widget.js` que apunta a
la última, o cache corta en `widget.js` con `Cache-Control`. Definir en infra (§Riesgos #4).

### 7. Panel admin + proxy (alta y configuración del canal)

**Backend Rails:** extender `InboxesController#build_channel` con la rama `web_widget`
(crea `Channel::WebWidget` con la config del builder + crea el `Inbox`), y ampliar
`channel_params`. Endpoint de detalle del canal que devuelve `website_token`, el **snippet
listo para copiar** y el estado (sin `hmac_token`, salvo acción explícita de "revelar").

**Proxy (FastAPI + Next):** la config viaja Rails ← FastAPI ← Next ← UI:
- Schema Pydantic `WebWidgetChannelCreate`/`WebWidgetChannelConfig` en
  `apps/backend/app/schemas/messaging.py`. `hmac_token` es **write-only / nunca se
  devuelve** en responses.
- Endpoint proxy en `apps/backend/app/api/v1/endpoints/messaging.py` +
  `messaging_service.py`.
- Route handler Next + `api-client/messaging.ts` + tipo `WebWidgetChannel` en
  `apps/frontend/lib/types/messaging.ts`.

**Frontend:** `apps/frontend/app/dashboard/settings/inboxes/new/web-widget-client.tsx`:
- **Widget builder** con **preview en vivo**: color primario, avatar, welcome
  title/tagline/message, reply_time, toggle branding, (toggle HMAC obligatorio).
- Tras crear: pantalla con el **snippet copiable** (`website_token` embebido) y el
  `hmac_token` mostrado una vez con instrucciones de uso server-side.
- Aplicar skills `frontend-design` / `interface-design` (builder + preview = tooling
  interactivo).

## Seguridad y casos límite

- **`hmac_token` secreto**: nunca en `/config` ni en responses del proxy; comparación con
  `secure_compare`. `website_token` es público por diseño.
- **CORS / Origin**: validar `Origin` de cada request del widget contra `website_url`
  (lista de dominios) del canal. Configurar `rack-cors` para el namespace `api/v1/widget`.
- **Aislamiento ActionCable**: el visitante solo `stream_from` su `pubsub_token`; jamás el
  stream `account_#{id}` ni el de otros contactos.
- **JWT**: firmado con el secret de Rails; payload mínimo (`source_id`, `inbox_id`); sin
  PII. Validación en cada request autenticado.
- **Rate limiting** en `api/v1/widget/*` (crear contacto / enviar mensaje) para evitar
  abuso/spam desde un endpoint público (`rack-attack` o equivalente).
- **Sanitización**: el `content` entrante del visitante se trata como texto (escape en el
  panel de agentes); sin HTML ejecutable.
- **Multitenancy**: canal, contacto, conversación y mensaje scoped a `account` (derivado
  del `website_token`/JWT, no de `X-Tenant-Id`).
- **Visitor info** (`referer`, `browser`, URL) se guarda en `additional_attributes` para
  contexto del agente; no se expone de vuelta al widget.
- **Reauthorizable**: no aplica como en WhatsApp (no hay credencial externa que caduque),
  pero el concern queda por consistencia del molde.

## Testing

- **Rails (rspec):**
  - Model `Channel::WebWidget`: genera `website_token` único y `hmac_token`; `widget_config`
    NO incluye `hmac_token`.
  - `Api::V1::Widget::ContactsController`: crea contacto anónimo (devuelve `pubsub_token`+JWT);
    `set_user` con `identifier_hash` válido identifica/fusiona; hash inválido → 401;
    `hmac_mandatory` rechaza anónimos.
  - `Api::V1::Widget::MessagesController`: `POST` crea `Message incoming` + setea visitor
    info; JWT inválido/ausente → 401; CORS de origen no permitido → bloqueado.
  - `WebWidget::SendOnWebWidgetService`: un `Message outgoing` hace `broadcast` al
    `pubsub_token` correcto (mock de ActionCable).
  - `RoomChannel`: un `User` se suscribe como agente (sin regresión); un `ContactInbox` se
    suscribe como visitante a su propio stream; token desconocido → `reject`.
- **Widget (Vitest / Playwright):** bootstrap lee `data-tenant` → pide config; persistencia
  (recargar reusa el JWT de localStorage); recibe `message.created` por ActionCable y lo
  pinta; responsive (panel full-screen en viewport móvil); branding condicional.
- **pytest (backend):** el proxy crea/actualiza el canal y **nunca** devuelve `hmac_token`.
- **Manual end-to-end:** página HTML de prueba con el snippet → abrir chat, enviar mensaje
  → aparece en el panel de agentes → responder → llega al widget en tiempo real → recargar
  la página y verificar que el hilo persiste.

> Nota operativa (rspec): los `spec/` no están bind-mounted en `ventia-messaging`; se
> copian con `docker cp`. `app/` sí está bind-mounted. Ver memoria
> `project_dev_runtime_topology`.

## Riesgos / a confirmar al implementar

1. **`RoomChannel` solo-agente (load-bearing).** Hoy `reject`a sin `User`
   (`room_channel.rb:6-9`). El canal Chat Web **no funciona** sin extenderlo a
   `ContactInbox`. Es un cambio en código compartido con el flujo de agentes → testear
   que no haya regresión en presence/streams de agentes.
2. **`contact_inboxes.pubsub_token` no existe.** Requiere migración + backfill no necesario
   (solo aplica a contactos de widget nuevos). Confirmar que ningún otro canal asume la
   ausencia de la columna.
3. **API pública sin `X-Tenant-Id`.** El resto de messaging deriva la cuenta del header de
   tenant; el widget la deriva del `website_token`/JWT. Asegurar que el
   `Widget::BaseController` NO pase por el `set_current_account` del `BaseController` de
   agentes (namespaces separados).
4. **Distribución del widget por CDN.** Dónde se hostea `chat.ventia.pe/widget.js`,
   estrategia de cache/versionado e invalidación. Es infra fuera del monorepo; coordinar.
   El dominio `chat.ventia.pe` del snippet del AC debe resolver al CDN/edge.
5. **CORS desde cualquier sitio cliente.** El widget corre en dominios de terceros →
   `api/v1/widget/*` debe permitir orígenes configurados por canal (no `*` global). Definir
   si la validación es estricta (lista blanca) o permisiva en v1.
6. **WSS desde dominios de terceros.** `ActionCable.allowed_request_origins` debe permitir
   los orígenes de los sitios cliente (o desactivar la verificación de origen solo para el
   path del cable del widget, con cuidado). Confirmar config de `cable.yml`/Origins.
7. **Fusión de contacto anónimo → identificado (HMAC).** Definir la política cuando un
   visitante anónimo con historial hace `setUser` y ya existe un `Contact` con ese
   `identifier`: ¿se reasigna el `ContactInbox`, se fusionan conversaciones? Política
   simple v1: reasignar el `ContactInbox` al contacto identificado.
8. **Rate limiting / anti-spam** en endpoints públicos. Confirmar gema (`rack-attack`) y
   umbrales.

## Fuera de alcance (v1)

- **Pre-chat form** (captura nombre/email antes de chatear) — solo costuras
  `pre_chat_form_enabled`/`pre_chat_form_options`.
- **CSAT** (encuesta de satisfacción al cerrar).
- **Business hours / off-line message** (horario de atención).
- **Continuity via email** (continuar la conversación por correo si el visitante deja email).
- **Mensajes proactivos / campañas** (abrir el chat automáticamente según reglas).
- **i18n** del widget (textos en un solo idioma en v1).
- **Adjuntos/emoji** en el widget si no entran en el tiempo — gated por `feature_flags`.

## Fuentes oficiales (verificación 2026-06-10)

**Chatwoot — Web Widget / canal website**
- Crear canal website (settings: color, welcome heading/tagline, channel greeting,
  pre-chat form): https://www.chatwoot.com/docs/product/channels/live-chat/create-website-channel
- WebSocket / `pubsub_token` + `RoomChannel` (subscribe con `{channel: "RoomChannel",
  pubsub_token}`): https://www.chatwoot.com/hc/user-guide/articles/1677691027-how-to-setup-a-web_socket-connection
- ContactInbox / `source_id` / `pubsub_token` por sesión (API channel, mismo modelo):
  https://www.chatwoot.com/hc/user-guide/articles/1677839703-how-to-create-an-api-channel-inbox
- Arquitectura de canales e inboxes (modelo polimórfico, `Channel::WebWidget`):
  https://deepwiki.com/chatwoot/chatwoot/3.5-inboxes-and-channels

**Repo y código de referencia (Chatwoot upstream)**
- `chatwoot/chatwoot` — `app/models/channel/web_widget.rb`, `app/controllers/api/v1/widget/*`,
  `app/channels/room_channel.rb`, SDK `@chatwoot/sdk`: https://github.com/chatwoot/chatwoot

**Vite / build de librería single-file**
- Library mode (`build.lib`, formato `iife`, `cssCodeSplit`):
  https://vitejs.dev/guide/build.html#library-mode
