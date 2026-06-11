# Canal Correo electrónico (IMAP/SMTP) — Diseño técnico

**Fecha:** 2026-06-10
**Tarea:** [US-CANAL-003: Integración canal Correo electrónico](https://app.clickup.com/t/86ah8xv7f) (Sprint sem2-junio-2026)
**Rama sugerida:** `feat/canal-email-imap-smtp`
**Estimación:** objetivo **7 días** para el v1 (basic-auth / Gmail), sin buffer —
cronograma día a día en el plan. OAuth2/O365 es alcance aparte (+3–5 días de dev +
semanas de calendario por CASA).
**Estado:** Diseño propuesto (pendiente de aprobación + plan)

## Objetivo

Agregar a la app de messaging un **canal de correo electrónico** que funcione vía
**IMAP (entrada) + SMTP (salida)**, de modo que:

- Los correos entrantes a una casilla configurada se conviertan en **conversaciones**
  y **mensajes entrantes** (igual que hoy ocurre con WhatsApp/Instagram).
- Las respuestas del agente (o del bot IA) salgan como **email** por SMTP,
  manteniendo el **hilo** del correo original.
- Adjuntos se preserven en ambos sentidos.
- Las credenciales IMAP/SMTP queden **encriptadas en BD**.
- Se manejen **bounces** y notificaciones de no entrega.

El canal debe encajar en el patrón polimórfico de canales ya existente, sin
reescribir el pipeline de conversaciones/mensajes.

## Contexto y reutilización

El servicio de messaging es un **derivado de Chatwoot** (lo confirman el enum
`Message#content_type` con `incoming_email: 8`, los comentarios "Chatwoot pattern",
y el modelo de canales polimórfico). Chatwoot tiene un **canal Email IMAP/SMTP
maduro** del cual nos basamos directamente, adaptándolo a las convenciones de este
repo (servicios `perform`, jobs Sidekiq, `Base::SendOnChannelService`, respuesta
`{ success:, data: }`).

### Patrón de canal ya existente (lo que reutilizamos)

- **Canal = entidad polimórfica.** `Channel::Whatsapp` / `Channel::Instagram` son
  clases `< ApplicationRecord` con `self.table_name = 'channel_x'`, `belongs_to
  :account`, `has_one :inbox, as: :channel, dependent: :destroy`, `provider_config`
  jsonb, `validate_provider_config`, el concern `Reauthorizable` y delegación a un
  `provider_service` (`apps/messaging/app/models/channel/whatsapp.rb`).
- **Inbox polimórfico** (`channel_type` + `channel_id`) es el contenedor del canal.
  Se crea en `Api::V1::InboxesController#create_inbox_with_channel` → `build_channel`
  (case por `channel_params[:type]`), dentro de una transacción
  (`apps/messaging/app/controllers/api/v1/inboxes_controller.rb`).
- **`Account`** ya expone `whatsapp_channels`; agregaremos `email_channels`.
- **Resolución de contacto:** `ContactInbox` (join `contact`↔`inbox`) con
  `source_id` (NOT NULL, único por inbox) = identificador externo del contacto en el
  canal. `Contact` ya tiene `email` único por account.
- **Conversación:** `belongs_to :contact_inbox`; tiene `additional_attributes` jsonb
  (lo usaremos para subject del hilo y cadena de `References`) y `ai_agent_enabled`.
- **Mensaje:** `Message` ya tiene `content_type: incoming_email`, `source_id`
  (indexado) y `store_accessor :content_attributes` con `in_reply_to`,
  `external_created_at`, `external_error`. El callback `after_create_commit
  :send_reply` encola `SendReplyJob` para `outgoing`/`template`
  (`apps/messaging/app/models/message.rb`).
- **Envío saliente unificado:** `SendReplyJob` mapea `channel_type → service` en
  `CHANNEL_SERVICES`; cada servicio hereda de `Base::SendOnChannelService`
  (template method: valida canal, `outgoing?`, `perform_reply`).
- **Ingreso (patrón a imitar):** `Whatsapp::IncomingMessageService` resuelve
  contacto → contact_inbox → conversation → message (+ attachments) dentro de una
  transacción, con **dedup en Redis + `Message.exists?(source_id:)`**
  (`apps/messaging/app/services/whatsapp/incoming_message_service.rb`).

### Diferencia clave vs. WhatsApp/Instagram

WhatsApp/Instagram son **push** (webhook entrante de Meta). El email es **pull**: hay
que **pollear IMAP** periódicamente. Por eso el ingreso se dispara desde un **job
recurrente** (sidekiq-cron) en lugar de un controller de webhook.

## Mapeo de acceptance criteria → diseño

| AC (ClickUp) | Dónde se resuelve |
|---|---|
| Panel admin configura IMAP (host, port, user, pass) + SMTP | `Channel::Email` + `InboxesController#build_channel` rama `email` + proxy FastAPI/Next + form en `dashboard/channels` |
| Worker que pollea IMAP cada 1 min y crea mensajes entrantes | `Email::PollInboxesJob` (sidekiq-cron, `*/1 * * * *`) → `Email::ImapPollerService` → `Email::IncomingEmailService` |
| Threading: emails con `In-Reply-To` agrupados en la misma conversación | `source_id = Message-ID`; lookup por `In-Reply-To`/`References` → conversación existente (ver §Threading) |
| Respuesta sale por SMTP con headers correctos para threading | `Email::SendViaSmtpService` setea `Message-ID`, `In-Reply-To`, `References`, `Subject: Re:` |
| Adjuntos preservados ida y vuelta | Inbound: parse `Mail` parts → ActiveStorage. Outbound: adjuntar `message.attachments` al `Mail` |
| Test con Gmail (App Password) y Office365 | Gmail ✅ con App Password. **Office365: NO alcanzable con basic-auth (IMAP/POP apagado en O365 desde ~2023) → requiere OAuth2** (§6 bis, §Riesgos #2). §Testing |
| Encriptación de credenciales IMAP/SMTP en BD | Columnas dedicadas `imap_password` / `smtp_password` con `encrypts` (Active Record Encryption, Rails 7.2) |
| Manejo de bounces y notificaciones de no entrega | Detección de DSN/`MAILER-DAEMON` en el poller → marca el `Message` original `failed` + `external_error` (ver §Bounces) |

## Decisiones (cerradas)

- **IMAP por polling con sidekiq-cron** (no IDLE, no webhooks). Se agrega la gema
  `sidekiq-cron`; job recurrente cada 1 min.
- **Credenciales en columnas dedicadas encriptadas** (`imap_password`,
  `smtp_password`) con `encrypts`. `provider_config`/columnas planas guardan lo no
  sensible (host, port, login, flags TLS). Más limpio, validable y testeable que
  encriptar un jsonb entero.
- **`source_id` del `Message` = `Message-ID` del correo** (RFC 5322). Es la pieza que
  habilita threading y dedup, y ya está indexada.
- **`ContactInbox.source_id` = dirección de email del contacto** (normalizada en
  minúsculas). Una conversación-hilo por cadena de `References`.
- **Envío reutiliza el pipeline existente:** el `Message` saliente dispara
  `SendReplyJob` → `Email::SendViaSmtpService` (subclase de
  `Base::SendOnChannelService`). No se inventa un camino paralelo.

## Proveedores de email soportados

El diseño IMAP/SMTP es **agnóstico al proveedor**: cualquier buzón con IMAP+SMTP
estándar funciona con el mismo código. Lo único que cambia es host/puerto y el método
de autenticación. **Todos los settings de esta sección están verificados contra
documentación oficial de cada proveedor** (ver §Fuentes oficiales).

### v1 — basic-auth (usuario + contraseña / App Password)

Un solo path cubre la mayoría de proveedores:

| Proveedor | IMAP | SMTP | Auth |
|---|---|---|---|
| **Gmail / Google Workspace** | `imap.gmail.com:993` SSL | `smtp.gmail.com:465` SSL o `:587` STARTTLS | **App Password** (requiere 2FA). En Gmail personal IMAP está siempre activo (toggle removido ene-2025); en Workspace el admin habilita IMAP y desde 1-may-2025 puede bloquear login legacy usuario/password. ✅ caso del AC. |
| **Office365 / Outlook** | `outlook.office365.com:993` | `smtp.office365.com:587` STARTTLS | ❌ **Basic-auth IMAP/POP permanentemente apagado en TODOS los tenants (~2023, irreversible).** El IMAP de O365 **requiere OAuth2** → ver §6 bis y §Riesgos #2. SMTP-AUTH basic-auth sigue activo (deshabilitado por defecto fin-2026). |
| **Yahoo / AOL** | `imap.mail.yahoo.com:993` | `smtp.mail.yahoo.com:465` (o `587`) | App Password obligatorio para clientes de terceros. |
| **Zoho Mail** | `imap.zoho.com:993` (personal) / `imappro.zoho.com:993` (org) | `smtp.zoho.com:465`/`587` (personal) / `smtppro.zoho.com` (org) | App-specific password si hay 2FA/SAML/SSO. |
| **iCloud Mail** | `imap.mail.me.com:993` | `smtp.mail.me.com:587` | App-specific password **obligatorio** (requiere 2FA en la cuenta Apple). |
| **cPanel / hosting propio / IONOS** | host:993 | host:465/587 | usuario+password (basic-auth suele seguir activo). |
| **SMTP/IMAP genérico** | configurable | configurable | el form expone host/port/user/pass/flags TLS → cualquier servidor. |

> **Conclusión de la verificación:** con basic-auth (App Password) el v1 cubre Gmail,
> Yahoo, Zoho, iCloud y hosting propio. **Office365 NO es alcanzable con basic-auth en
> el lado IMAP** (entrante) — su soporte completo exige la contingencia OAuth2 (§6 bis).

### Presets en el panel admin

El form de conexión incluye un **selector de proveedor** (`Gmail`, `Outlook/Office365`,
`Otro`) que **autocompleta** host, puerto y flags TLS según el preset, dejando que el
admin solo ingrese usuario y contraseña (reduce errores de configuración). `Otro`
deja todos los campos manuales. Los presets viven en una constante en el frontend
(no es necesaria una tabla); el backend sigue recibiendo y guardando los valores
concretos (host/port/flags), de modo que un preset es solo azúcar de UI.

### NO incluidos en este diseño: proveedores transaccionales por API

SendGrid, Mailgun, Amazon SES, Postmark, Resend, Brevo usan un **modelo distinto**
(envío por API HTTP + recepción por webhook *inbound parse*), no IMAP/SMTP. Mejor
deliverability/escala y bounces vía webhook, pero cada uno tiene su propia API/formato
y exige dominio verificado (SPF/DKIM). **No encajan con el AC** ("poll IMAP cada 1
min") ni con los archivos de la tarea. Quedan fuera de alcance; si en el futuro se
prioriza deliverability a escala, se agregarían como un `provider` adicional del mismo
`Channel::Email` (con su propio `provider_service`), sin romper el modelo de datos.

## Arquitectura

### 1. Modelo de datos (Rails)

**Migración nueva** `create_channel_email` (respetar schema `messaging`, como el resto
de tablas):

```ruby
create_table :channel_email do |t|
  t.bigint  :account_id, null: false

  # IMAP (entrada)
  t.boolean :imap_enabled, default: false, null: false
  t.string  :imap_address,  default: '', null: false
  t.integer :imap_port,     default: 993, null: false
  t.string  :imap_login,    default: '', null: false
  t.string  :imap_password, default: ''            # ENCRIPTADA (encrypts)
  t.datetime :imap_inbox_synced_at                 # checkpoint del poller
  t.integer  :imap_last_uid                         # UID del último correo procesado

  # SMTP (salida)
  t.boolean :smtp_enabled, default: false, null: false
  t.string  :smtp_address, default: '', null: false
  t.integer :smtp_port,    default: 587, null: false
  t.string  :smtp_login,   default: '', null: false
  t.string  :smtp_password, default: ''            # ENCRIPTADA (encrypts)
  t.string  :smtp_domain
  t.string  :smtp_authentication, default: 'plain'
  t.boolean :smtp_enable_starttls_auto, default: true
  t.boolean :smtp_enable_ssl_tls, default: false
  t.string  :smtp_openssl_verify_mode, default: 'none'

  # email "público" del inbox (la casilla)
  t.string  :email, null: false

  t.jsonb   :provider_config, default: {}, null: false  # extras / OAuth futuro
  t.timestamps
end
add_index :channel_email, :email, unique: true
add_index :channel_email, :account_id
```

**`Channel::Email`** (mismo molde que `Channel::Whatsapp`):

```ruby
class Channel::Email < ApplicationRecord
  include Reauthorizable
  self.table_name = 'channel_email'

  encrypts :imap_password
  encrypts :smtp_password

  validates :email, presence: true, uniqueness: true
  validates :account_id, presence: true

  belongs_to :account
  has_one :inbox, as: :channel, dependent: :destroy

  def name = 'Email'
  def imap_configured? = imap_enabled? && imap_address.present? && imap_login.present?
  def smtp_configured? = smtp_enabled? && smtp_address.present? && smtp_login.present?
end
```

> **Encriptación:** `encrypts` (Active Record Encryption) requiere configurar las
> llaves `active_record_encryption.{primary_key, deterministic_key,
> key_derivation_salt}` (credenciales/ENV). Es un **prerrequisito de infra** (ver
> §Riesgos). Sin `deterministic: true` no se puede hacer `where(imap_password:)`, lo
> cual aquí no necesitamos.

- `Account`: agregar `has_many :email_channels, class_name: 'Channel::Email',
  dependent: :destroy`.
- `ContactInbox.source_id` = email del contacto. `Contact` ya valida `email` único
  por account → al resolver contacto buscamos/creamos por `email`.
- `Conversation.additional_attributes` guarda: `mail_subject` (subject original sin
  `Re:`), `mail_references` (cadena de `Message-ID` del hilo) → para construir el
  header `References` saliente.

### 2. Ingreso de correos (inbound) — polling IMAP

Flujo (espejo del de WhatsApp, pero arrancado por cron en vez de webhook):

```
Email::PollInboxesJob (sidekiq-cron, cada 1 min)
  → por cada Channel::Email con imap_configured?:
      Email::ImapPollerService.new(channel:).perform
        → conecta IMAP (Net::IMAP / Mail), busca correos nuevos
          (UID > imap_last_uid, o SEARCH desde imap_inbox_synced_at)
        → por cada correo (envuelto como Mail::Message):
            dedup (Redis + Message.exists?(source_id: message_id))
            ¿es bounce/DSN? → Email::BounceHandler (ver §Bounces)
            si no → Email::IncomingEmailService.new(channel:, mail:).perform
        → actualiza imap_last_uid / imap_inbox_synced_at
```

**`Email::IncomingEmailService#perform`** (transacción atómica, como
`Whatsapp::IncomingMessageService`):

1. `find_or_create_contact` por `mail.from` (email normalizado; nombre desde el
   display name del header `From`).
2. `find_or_create_contact_inbox` con `source_id = contact.email`.
3. **Resolver conversación** (ver §Threading): por `In-Reply-To`/`References` →
   conversación existente; si no hay match → nueva conversación.
4. Crear `Message` entrante:
   - `message_type: :incoming`, `content_type: :incoming_email`,
   - `content` = cuerpo limpio (usar gema `email_reply_parser` para quitar el texto
     citado/firmas y quedarnos con la respuesta nueva; guardar el HTML/texto completo
     en `content_attributes`),
   - `source_id` = `Message-ID` del correo,
   - `content_attributes`: `in_reply_to` (Message-ID padre), `email_subject`,
     `cc`, `bcc`, `external_created_at` (fecha del header `Date`).
5. **Adjuntos:** iterar `mail.attachments` → `@message.attachments.new(file: { io:,
   filename:, content_type: })` (ActiveStorage, igual que WhatsApp).
6. El `Message` entrante **no** dispara `send_reply` (solo `outgoing`/`template`).

**Dedup:** `$redis.setex("email_message:#{message_id}", 5.minutes, true)` +
`Message.exists?(source_id: message_id)`. Esto evita duplicar si el poller relee el
mismo correo (no asumimos que podemos marcar `\Seen` o mover a carpeta).

### 3. Envío de respuestas (outbound) — SMTP

Reutiliza el pipeline existente:

```
Message outgoing creado (agente o bot IA)
  → after_create_commit :send_reply  → SendReplyJob
     → CHANNEL_SERVICES['Channel::Email'] = Email::SendViaSmtpService
        → Base::SendOnChannelService#perform (valida canal + outgoing?)
           → perform_reply: construye Mail y lo entrega por SMTP del canal
```

**`Email::SendViaSmtpService < Base::SendOnChannelService`:**

- `channel_class = Channel::Email`.
- `perform_reply`:
  1. Construye un `Mail.new` con `delivery_method :smtp` usando los settings del
     canal (`smtp_address`, `smtp_port`, `smtp_login`, `smtp_password`, STARTTLS/TLS,
     `smtp_authentication`, `smtp_domain`).
  2. `to` = email del contacto; `from` = `channel.email`; `subject` = `Re: <subject
     del hilo>` (de `conversation.additional_attributes['mail_subject']`).
  3. **Headers de threading:**
     - `In-Reply-To` = `source_id` del último mensaje entrante del hilo.
     - `References` = cadena acumulada (`conversation.additional_attributes
       ['mail_references']`).
     - `Message-ID` generado (o el que asigne `Mail`) → se persiste de vuelta en
       `message.update!(source_id: <generated Message-ID>)` para encadenar futuras
       respuestas (espejo de cómo WhatsApp guarda el `wamid` tras enviar).
  4. **Adjuntos:** por cada `message.attachments`, `mail.add_file(filename:,
     content: blob.download)`.
  5. `mail.deliver!`. En éxito → `message.update!(status: :delivered, source_id:)`.
     En error SMTP → `message.update!(status: :failed, external_error: e.message)` y
     `channel.authorization_error!` (Reauthorizable) si es fallo de auth.

Registrar `Channel::Email => ::Email::SendViaSmtpService` en `SendReplyJob::
CHANNEL_SERVICES`.

### 4. Threading (cómo se agrupan los correos en una conversación)

Regla de pertenencia al hilo, en orden:

1. Tomar `In-Reply-To` y `References` del correo entrante (lista de `Message-ID`).
2. Buscar el primer `Message` del account cuyo `source_id` ∈ esa lista →
   usar **su conversación**.
3. Si no hay match, **nueva conversación**; guardar `mail_subject` y arrancar
   `mail_references` con el `Message-ID` entrante.
4. En cada mensaje (entrante o saliente) se **acumula** el `Message-ID` en
   `conversation.additional_attributes['mail_references']` para que el header
   `References` saliente sea correcto.

Esto cubre el AC de threading y aprovecha que `source_id` está indexado.

### 5. Bounces y no-entrega

Los rebotes llegan **a la misma casilla IMAP** como correos especiales:

- **Detección:** `Content-Type: multipart/report; report-type=delivery-status`, o
  remitente `MAILER-DAEMON@`/`postmaster@`, o header `Auto-Submitted: auto-replied`.
- **`Email::BounceHandler`:** parsea el `message/delivery-status` y el
  `Original-Message-ID`/headers del adjunto `message/rfc822` para identificar el
  `Message` original (por `source_id`). Si lo encuentra:
  - `message.update!(status: :failed, external_error: <diagnostic-code>)`,
  - opcional: crear un `Message` de tipo `:activity` en la conversación
    ("El correo no pudo entregarse: …") para visibilidad del agente.
- **Auto-respuestas** (vacation/OOO, `Auto-Submitted: auto-generated`): se ignoran (no
  crean conversación) para no ensuciar el inbox.

### 6. Panel admin / configuración del canal

**Backend Rails:** extender `InboxesController#build_channel` con la rama `email`
(crear `Channel::Email` con los params IMAP/SMTP + crear el `Inbox`), y ampliar
`channel_params` para permitir los campos del canal email. Endpoint de estado/lista
de canales email análogo a WhatsApp/Instagram (id, email, imap/smtp configurado,
`reauthorization_required`).

**Proxy (FastAPI + Next):** igual que el resto de messaging, la config viaja
Rails ← FastAPI ← Next ← UI:
- Schema Pydantic `EmailChannelCreate`/`EmailChannelConfig` en
  `apps/backend/app/schemas/messaging.py` (passwords como `SecretStr`, nunca se
  devuelven en responses).
- Endpoint proxy en `apps/backend/app/api/v1/endpoints/messaging.py` +
  `messaging_service.py`.
- Route handler Next + `api-client/messaging.ts` + tipo `EmailChannel` en
  `apps/frontend/lib/types/messaging.ts`.

**Frontend:** form de conexión en `apps/frontend/app/dashboard/channels/` con un
**selector de proveedor** (`Gmail` / `Outlook-Office365` / `Otro`) que autocompleta
host/puerto/flags TLS desde un preset (ver §Proveedores), dejando al admin solo
usuario + contraseña; `Otro` deja todo manual. Campos: host, port, user, pass IMAP +
SMTP, flags TLS, email de la casilla. Botón "Probar conexión" (opcional v1) y card de
canal email reusando el patrón de WhatsApp/Instagram. **Las contraseñas nunca se
devuelven** desde el backend (solo se escriben).

### 6 bis. Contingencia: OAuth2 (Gmail / Microsoft) — fuera del v1, documentado

El v1 usa basic-auth (App Password). **Office365 obliga a esta vía** para el IMAP
(su basic-auth IMAP/POP está apagado, ver §Riesgos #2); Gmail puede usarla también.
Todo lo de abajo está verificado contra docs oficiales (§Fuentes oficiales). Lo
dejamos planteado para no rediseñar si se prioriza. Implicaría:

- **Registro de apps OAuth** con `client_id`/`client_secret` y redirect URIs:
  - **Google** (Google Cloud Console): scope **`https://mail.google.com/`** (cubre
    IMAP+SMTP vía XOAUTH2) + `access_type=offline` para refresh token. ⚠️ Es un
    **scope "Restricted"** → la app en producción requiere **verificación OAuth de
    Google + evaluación de seguridad CASA** (anual, con costo y semanas de lead time).
  - **Microsoft** (Microsoft Entra ID, ex-Azure AD): flujo delegado (por usuario) con
    scopes **`https://outlook.office.com/IMAP.AccessAsUser.All`**,
    **`https://outlook.office.com/SMTP.Send`** y **`offline_access`**. (Alternativa
    app-only/daemon: scope `https://outlook.office365.com/.default` + permisos
    `IMAP.AccessAsApp`/`SMTP.SendAsApp` + consentimiento de admin y registro del
    service principal en Exchange Online.)
- **Flujo de consentimiento por canal:** un par de endpoints OAuth (authorize +
  callback) en messaging, análogos a los de Instagram que ya existen
  (`instagram/callback`, `Api::V1::Instagram::AuthorizationsController`). El admin
  conecta la casilla vía "Iniciar sesión con Google/Microsoft" en vez de escribir
  contraseña.
- **Tokens en lugar de password:** columnas `oauth_access_token` /
  `oauth_refresh_token` / `oauth_expires_at` (encriptadas con `encrypts`) en
  `channel_email`, y `provider` = `google`/`microsoft` para enrutar la auth. El campo
  `provider_config` ya existe para guardar metadata OAuth.
- **Auth SASL XOAUTH2 en IMAP y SMTP:** el poller y el send service autentican
  presentando el access token con el mecanismo XOAUTH2
  (`base64("user=" + email + "^Aauth=Bearer " + token + "^A^A")`, documentado tanto
  por Google como por Microsoft). Se requiere **refrescar el token** con el refresh
  token cuando expira (servicio de refresh + manejo de `invalid_grant` →
  `reauthorization_required`).
- **Reautorización:** si el refresh falla (usuario revocó acceso, password cambió),
  marcar el canal con `Reauthorizable` y pedir reconexión en el panel.

Esfuerzo estimado adicional: comparable o mayor al del canal IMAP/SMTP básico
(registro de apps, dos flujos OAuth, refresh de tokens, **+ verificación/CASA de
Google** que añade tiempo y costo de calendario). Por eso queda **fuera del v1** salvo
que O365 sea bloqueante (ver §Riesgos #2).

### 7. Scheduling (sidekiq-cron)

- Agregar `gem 'sidekiq-cron'` al Gemfile (hoy no está; el initializer
  `config/initializers/sidekiq.rb` ya tiene un placeholder comentado para scheduler).
- Registrar en `config/initializers/sidekiq.rb` (o `config/schedule.yml` cargado al
  arranque del server) el job recurrente:
  ```yaml
  email_poll_inboxes:
    cron: "*/1 * * * *"
    class: "Email::PollInboxesJob"
    queue: default
  ```
- `Email::PollInboxesJob` es idempotente y barato si no hay canales con
  `imap_configured?`. Para evitar solapamiento si un poll tarda >1 min, usar un lock
  por canal en Redis (`SETNX email_poll_lock:#{channel_id}` con TTL).

## Seguridad y casos límite

- **Encriptación en reposo** de `imap_password`/`smtp_password` (AC explícito); las
  passwords **nunca** salen en responses de la API (write-only).
- **Aislamiento multitenant:** todo scoped a `account` (canal, contacto, conversación,
  mensaje) — igual que el resto de messaging.
- **Dedup** Redis + `source_id` único evita conversaciones/mensajes duplicados al
  repolear.
- **Lock de poll por canal** evita procesamiento concurrente del mismo buzón.
- **Límite de tamaño de adjuntos** (alinear con el límite de ActiveStorage / política
  actual; truncar/omitir adjuntos gigantes y registrar el evento, sin caer en silencio
  — coherente con "no silent caps").
- **Inyección de headers / spoofing:** sanitizar `Subject`/headers al construir el
  `Mail` saliente.
- **Loops de auto-respuesta:** ignorar `Auto-Submitted` y bounces para no crear
  conversaciones recursivas.
- **Reauthorizable:** fallos repetidos de auth IMAP/SMTP marcan
  `reauthorization_required` (se expone al panel para que el admin reingrese
  credenciales).

## Testing

- **Rails (rspec):**
  - Model: `Channel::Email` valida `email` único; `encrypts` cifra
    `imap/smtp_password` (el valor en BD ≠ plaintext).
  - `Email::IncomingEmailService`: crea contacto/conversación/mensaje desde un `.eml`
    fixture; threading (un segundo correo con `In-Reply-To` cae en la misma
    conversación); dedup (mismo `Message-ID` no duplica); adjuntos se guardan.
  - `Email::SendViaSmtpService`: arma el `Mail` con `In-Reply-To`/`References`/
    `Message-ID` correctos y adjunta archivos (mock de SMTP / `Mail::TestMailer`).
  - `Email::BounceHandler`: un DSN marca el `Message` original como `failed`.
  - `Email::PollInboxesJob`: solo procesa canales `imap_configured?`; respeta el lock.
- **Gmail (App Password):** `imap.gmail.com:993` SSL; `smtp.gmail.com:465` SSL o
  `:587` STARTTLS; requiere 2FA + App Password. IMAP ya está siempre activo en Gmail
  personal (en Workspace lo habilita el admin). Test manual end-to-end: enviar un
  correo a la casilla → aparece la conversación → responder desde la app → llega el
  email en el hilo correcto.
- **Office365:** ⚠️ **No testeable con basic-auth** — su IMAP/POP basic-auth está
  apagado a nivel plataforma (ver §Riesgos #2). Solo es testeable vía la contingencia
  OAuth2 (§6 bis). Confirmar con producto si O365 entra en el v1 o se descopa.
- **pytest (backend):** el proxy crea/actualiza canal email reenviando los campos
  IMAP/SMTP y **nunca** devuelve passwords.

> Nota operativa (rspec): los `spec/` no están bind-mounted en `ventia-messaging`; se
> copian con `docker cp`. `app/` sí está bind-mounted. Ver memoria
> `project_dev_runtime_topology`.

## Riesgos / a confirmar al implementar

1. **Active Record Encryption sin configurar.** `encrypts` requiere las 3 llaves en
   credenciales/ENV. **Prerrequisito de infra**: sin ellas el modelo no arranca.
   Confirmar manejo de llaves en dev/prod (Docker) antes de la Fase 1.
2. **Office365 NO funciona con basic-auth (verificado, docs oficiales MS).** Microsoft
   **apagó permanentemente** Basic Auth para **IMAP/POP** en **todos** los tenants
   (~2023, irreversible — ni el admin ni Microsoft pueden reactivarlo). Como el corazón
   de esta feature es el **polling IMAP entrante**, **O365 no es alcanzable con el v1
   basic-auth**: requiere **OAuth2/XOAUTH2** (§6 bis). Matices:
   - SMTP-AUTH basic-auth **sí sigue activo hoy**, pero se deshabilita por defecto a
     **fin de diciembre 2026** y se remueve definitivamente en **2027** (timeline
     oficial actualizado en ene-2026; la fecha previa de "marzo 2026" quedó postergada).
   - **Decisión de producto requerida:** o (a) se acepta que el AC "Test con O365" se
     cumple solo vía la contingencia OAuth2 (que suma trabajo + verificación/CASA en
     Google y registro de app en Entra), o (b) se descopa O365 del v1 y se cierra la
     tarea con Gmail/otros por App Password, dejando O365 como follow-up explícito.
   Gmail con App Password sí funciona end-to-end en el v1.
3. **Gemas IMAP/SMTP.** El `mail` gem (transitivo de ActionMailer) ya declara
   `net-imap`/`net-smtp`/`net-pop` como dependencias, así que están disponibles. Son
   *bundled gems* desde Ruby **3.1** (no 3.4); si Ruby emite warning por no estar en el
   Gemfile, agregarlas explícitas.
4. **Estrategia de "nuevos correos".** Decidir entre tracking por `UID` (preferido,
   robusto) vs. `SEARCH` por fecha desde `imap_inbox_synced_at`. UID evita reprocesos
   pero requiere persistir `imap_last_uid` por canal (ya contemplado en la migración).
5. **Solapamiento de polls** si un buzón grande tarda > 1 min: lock por canal en Redis
   (contemplado) — confirmar TTL.
6. **Limpieza de cuerpo** (`email_reply_parser`): definir qué se guarda como `content`
   visible (solo la respuesta nueva) vs. `content_attributes` (HTML/cita completa).

## Fuera de alcance (v1)

- OAuth2 para Gmail/Microsoft (App Password / basic-auth en v1). Planteado en
  §6 bis por si O365 lo hace necesario.
- Proveedores transaccionales por API (SendGrid/Mailgun/SES/Postmark) — modelo
  distinto, ver §Proveedores.
- IMAP IDLE / push en tiempo real (polling 1 min es suficiente para la tarea).
- Editor de email enriquecido (HTML/firma) en el composer — se envía texto plano
  (más HTML básico) en v1.
- Reglas de ruteo por carpeta IMAP / múltiples carpetas (solo INBOX en v1).
- Plantillas de email / campañas por correo.

## Fuentes oficiales (verificación 2026-06-10)

Todas las afirmaciones técnicas de este spec fueron verificadas contra documentación
oficial. Referencias:

**Settings IMAP/SMTP de proveedores**
- Gmail IMAP client settings: https://support.google.com/mail/answer/78892
- Gmail SMTP (465 SSL / 587 TLS): https://support.google.com/a/answer/176600
- Gmail App Password requiere 2-Step Verification: https://support.google.com/accounts/answer/185833
- Gmail personal — IMAP siempre activo (toggle removido): https://support.google.com/mail/answer/7126229
- Office365 IMAP4/POP3/SMTP (host/puertos): https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/pop3-and-imap4/pop3-and-imap4
- Yahoo Mail IMAP/SMTP + App Password: https://help.yahoo.com/kb/SLN4075.html
- Zoho Mail IMAP/SMTP (incl. hosts `pro` + app password): https://www.zoho.com/mail/help/imap-access.html
- iCloud Mail server settings + app-specific password: https://support.apple.com/en-us/102525

**Office365 / Microsoft — deprecación de Basic Auth y OAuth2**
- Deprecación Basic Auth en Exchange Online (IMAP/POP apagado ~2023, irreversible): https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online
- Timeline actualizado SMTP-AUTH basic auth (ene-2026: disabled-by-default fin-2026): https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835
- Autenticar IMAP/POP/SMTP con OAuth (scopes `IMAP.AccessAsUser.All` / `SMTP.Send`, XOAUTH2): https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth

**Gmail OAuth2 / XOAUTH2**
- Mecanismo XOAUTH2 + scope `https://mail.google.com/`: https://developers.google.com/gmail/imap/xoauth2-protocol
- Scopes de Gmail (`mail.google.com` = Restricted): https://developers.google.com/workspace/gmail/api/auth/scopes
- `access_type=offline` para refresh token: https://developers.google.com/identity/protocols/oauth2/web-server
- Verificación de scopes restringidos + evaluación CASA: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

**Rails / Ruby / gemas / RFCs**
- Active Record Encryption (`encrypts`, 3 llaves, `db:encryption:init`, determinístico): https://guides.rubyonrails.org/active_record_encryption.html
- sidekiq-cron (`Sidekiq::Cron::Job.load_from_hash`): https://github.com/sidekiq-cron/sidekiq-cron
- gema `mail` (deps net-imap/net-smtp/net-pop): https://github.com/mikel/mail
- net-* como bundled gems desde Ruby 3.1: https://www.ruby-lang.org/en/news/2021/12/25/ruby-3-1-0-released/
- `Net::IMAP` (`uid_search`/`uid_fetch`): https://docs.ruby-lang.org/en/master/Net/IMAP.html
- email_reply_parser: https://github.com/github/email_reply_parser
- RFC 5322 §3.6.4 (`Message-ID`/`In-Reply-To`/`References`): https://www.rfc-editor.org/rfc/rfc5322
- RFC 3464 (DSN / `multipart/report`): https://www.rfc-editor.org/rfc/rfc3464
