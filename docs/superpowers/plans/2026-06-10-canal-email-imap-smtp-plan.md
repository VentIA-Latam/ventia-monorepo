# Canal Correo electrónico (IMAP/SMTP) — Plan de Implementación

**Spec:** `docs/superpowers/specs/2026-06-10-canal-email-imap-smtp-design.md`
**Tarea:** [US-CANAL-003](https://app.clickup.com/t/86ah8xv7f) (Sprint sem2-junio-2026)
**Fecha:** 2026-06-10
**Rama sugerida:** `feat/canal-email-imap-smtp`

Orden de abajo hacia arriba (infra → modelo → ingreso → envío → bounces → config →
proxy → UI → tests). Las fases 0–6 dejan el canal funcionando end-to-end por consola
(ingreso y envío) antes de tocar proxy/UI. Cada fase es verificable de forma aislada.

> Nota operativa (rspec): los `spec/` no están bind-mounted en `ventia-messaging`; se
> copian con `docker cp`. `app/` sí está bind-mounted. Ver memoria
> `project_dev_runtime_topology`.

---

## Estimación de esfuerzo — objetivo 7 días

Estimaciones en **días de desarrollo** (1 dev mid/senior ya familiarizado con el repo;
**no** incluye ciclos de code review/QA ni esperas externas).

| Fase | Descripción | Estimación |
|---|---|---|
| 0 | Infra: AR Encryption + gemas + sidekiq-cron | 0.5 d |
| 1 | Migración + modelo `Channel::Email` | 0.5 d |
| 2 | `IncomingEmailService` (parsing, contacto/conv/msg, threading, adjuntos) | 1.0 d |
| 3 | `ImapPollerService` (conexión IMAP, UID, manejo de errores) | 0.75 d |
| 4 | `PollInboxesJob` (cron + lock) | 0.25 d |
| 5 | `SendViaSmtpService` + `BounceHandler` (headers threading, adjuntos, DSN) | 1.0 d |
| 6 | Alta del canal backend (`InboxesController`) | 0.25 d |
| 7 | Proxy FastAPI + Next | 0.5 d |
| 8 | Frontend: form + presets + card de canal | 1.0 d |
| 9 | Tests Rails (rspec) | 0.75 d |
| 10 | Tests pytest + verificación e2e manual | 0.5 d |
| | **TOTAL v1 (basic-auth / Gmail)** | **7.0 d** |

### Cronograma de 7 días

Los tests de cada componente se escriben **junto** con el componente (no se dejan todos
para el final); las Fases 9–10 son consolidación + e2e.

| Día | Trabajo | Hito verificable |
|---|---|---|
| **1** | Fase 0 + Fase 1 | Entorno con AR Encryption y cron listos; tabla `channel_email` migrada; modelo cifra credenciales. |
| **2** | Fase 2 | Dado un `.eml`, se crea contacto/conversación/mensaje con threading y adjuntos (specs incluidos). |
| **3** | Fase 3 + Fase 4 | **Ingreso end-to-end:** un correo enviado a la casilla aparece como conversación en ≤1 min (poll automático). |
| **4** | Fase 5 | **Envío end-to-end:** respuesta sale por SMTP en el hilo correcto; un DSN marca el mensaje `failed`. |
| **5** | Fase 6 + Fase 7 | Alta del canal por API (Rails) y proxy FastAPI/Next funcionando; passwords write-only. |
| **6** | Fase 8 | Panel admin: conectar Gmail desde la UI (con presets) y ver el canal. |
| **7** | Fase 9 + Fase 10 | Suite rspec + pytest verde; e2e manual con Gmail (recibir→responder→adjuntos). **Feature lista.** |

### Condiciones para cumplir los 7 días

Los 7 días son el **extremo optimista** (suma de los mínimos por fase) y asumen:

1. **Alcance = Gmail / IMAP-SMTP genérico por basic-auth.** Office365/OAuth2 **NO**
   entra (ver contingencia abajo).
2. **AR Encryption resuelto el Día 1** sin bloqueos de infra (llaves disponibles en
   dev y prod).
3. Sin imprevistos grandes de MIME/encoding/threading; un dev dedicado a tiempo
   completo; tests escritos en paralelo a cada fase.
4. Code review/QA y deploy van **fuera** de estos 7 días.

> ⚠️ **Sin buffer.** A 7 días no hay holgura para sorpresas (parsing de MIME raro,
> deliverability/SPF al probar, edge cases de threading). Si aparece un imprevisto, el
> amortiguador natural es **recortar pulido** (no funcionalidad core): p.ej. dejar el
> botón "Probar conexión" (opcional) o simplificar la UI de presets. Si se prefiere
> margen, considerar 8–9 días.

### Contingencia OAuth2 (si se decide soportar Office365)

| Concepto | Estimación |
|---|---|
| Desarrollo OAuth (2 flujos authorize+callback, refresh de tokens, XOAUTH2 en IMAP/SMTP, columnas de tokens) | **+3–5 d de dev** |
| Verificación OAuth de Google + **evaluación de seguridad CASA** (scope Restricted `mail.google.com`) | **semanas–meses de calendario** (no es dev; lead time + costo $) |
| Registro/aprobación de app en Microsoft Entra | días–semanas de calendario (según políticas del tenant) |

> ⚠️ La parte de **CASA/verificación de Google no es tiempo de desarrollo sino de
> calendario** (puede tomar semanas o meses y tiene costo). Si O365/Gmail-OAuth entra
> en alcance, hay que iniciar ese trámite **lo antes posible**, en paralelo al
> desarrollo. Esto **no cabe en una estimación de 4–5 días**; sería un alcance aparte.

---

## Fase 0 — Infra: Active Record Encryption + gemas + sidekiq-cron

**Objetivo:** dejar el entorno listo para encriptar credenciales y correr cron jobs.

**Archivos:**
- `apps/messaging/Gemfile`
- `apps/messaging/config/initializers/sidekiq.rb`
- Credenciales/ENV (Active Record Encryption)

**Cambios:**
1. Agregar `gem 'sidekiq-cron'`. Agregar `net-imap`, `net-smtp`, `net-pop` explícitas
   si Ruby 3.4 las exige (verificar `bundle install`).
2. Configurar **Active Record Encryption**: generar llaves
   (`bin/rails db:encryption:init`) y cargarlas vía credenciales encriptadas o ENV
   (`ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY`, `…_DETERMINISTIC_KEY`,
   `…_KEY_DERIVATION_SALT`). Documentar en `.env.example` del messaging y en
   docker-compose dev.
3. Registrar el cron de polling (se activa en Fase 4, pero dejar el scaffold):
   ```ruby
   # config/initializers/sidekiq.rb (configure_server)
   require 'sidekiq-cron'
   schedule = { 'email_poll_inboxes' => { 'cron' => '*/1 * * * *',
                                          'class' => 'Email::PollInboxesJob' } }
   Sidekiq::Cron::Job.load_from_hash(schedule)
   ```

**Verificación:**
- `docker exec ventia-messaging bundle install` sin errores.
- Consola: `ActiveRecord::Encryption.config.primary_key.present?` → true.

---

## Fase 1 — Rails: migración + modelo `Channel::Email`

**Objetivo:** existe la tabla `channel_email` y el modelo con credenciales
encriptadas.

**Archivos:**
- `apps/messaging/db/migrate/<ts>_create_channel_email.rb`
- `apps/messaging/app/models/channel/email.rb` (nuevo)
- `apps/messaging/app/models/account.rb`
- `apps/messaging/db/schema.rb` (autogenerado)

**Cambios:**
1. Migración `create_channel_email` con columnas IMAP/SMTP + `email` + flags TLS +
   `imap_inbox_synced_at`/`imap_last_uid` (schema `messaging`; ver spec §1). Índices
   únicos en `email`.
2. `Channel::Email` (`include Reauthorizable`, `self.table_name`, `encrypts
   :imap_password, :smtp_password`, validaciones, `belongs_to :account`, `has_one
   :inbox, as: :channel`, helpers `imap_configured?`/`smtp_configured?`, `name`).
3. `Account`: `has_many :email_channels, class_name: 'Channel::Email', dependent:
   :destroy`.

**Verificación:**
- `docker exec ventia-messaging bundle exec rails db:migrate`.
- Consola: crear un `Channel::Email`, setear `imap_password`; confirmar que la columna
  en BD está cifrada (`SELECT imap_password FROM messaging.channel_email` ≠ plaintext)
  y que el getter lo descifra.

---

## Fase 2 — Rails: ingreso `Email::IncomingEmailService` (sin IMAP aún)

**Objetivo:** dado un `Mail::Message`, crear contacto/conversación/mensaje/adjuntos
con threading. Aislado del transporte IMAP para poder testear con fixtures `.eml`.

**Archivos:**
- `apps/messaging/app/services/email/incoming_email_service.rb` (nuevo)
- (helper) `apps/messaging/app/services/email/mail_presenter.rb` (opcional, wrapper de
  `Mail` para extraer from/subject/body/message_id/refs/attachments)

**Cambios:**
1. `Email::IncomingEmailService.new(channel:, mail:).perform`:
   - dedup (`Message.exists?(source_id: message_id)` + Redis `email_message:<id>`),
   - `find_or_create_contact` por `mail.from` (email + display name),
   - `find_or_create_contact_inbox` (`source_id = contact.email`),
   - resolución de conversación por `In-Reply-To`/`References` (spec §Threading) o
     nueva; mantener `additional_attributes['mail_subject']` y `['mail_references']`,
   - crear `Message` `incoming` / `content_type: :incoming_email`, `source_id =
     Message-ID`, `content` = respuesta limpia (`email_reply_parser`),
     `content_attributes` (`in_reply_to`, `email_subject`, `external_created_at`, cc),
   - adjuntar `mail.attachments` vía ActiveStorage.
   - Todo en `ActiveRecord::Base.transaction`, imitando
     `Whatsapp::IncomingMessageService`.

**Verificación:** rspec (Fase 9) con fixtures `.eml`: correo nuevo → 1 conversación +
1 mensaje; correo con `In-Reply-To` → cae en la conversación existente; mismo
`Message-ID` repetido → no duplica; adjunto guardado.

---

## Fase 3 — Rails: poller IMAP `Email::ImapPollerService`

**Objetivo:** conectar a IMAP, traer correos nuevos y delegar a
`IncomingEmailService`.

**Archivos:**
- `apps/messaging/app/services/email/imap_poller_service.rb` (nuevo)

**Cambios:**
1. `Email::ImapPollerService.new(channel:).perform`:
   - conecta `Net::IMAP` (SSL según puerto/flags), autentica con
     `imap_login`/`imap_password`,
   - selecciona `INBOX`, busca correos con `UID > imap_last_uid` (o `SEARCH` desde
     `imap_inbox_synced_at` en el primer run),
   - por cada UID: `Mail.read_from_string(raw)`,
   - **¿bounce/DSN?** → `Email::BounceHandler` (Fase 5); si no →
     `Email::IncomingEmailService`,
   - actualiza `imap_last_uid` / `imap_inbox_synced_at`,
   - cierra la conexión en `ensure`; captura errores de auth → `channel
     .authorization_error!` (Reauthorizable).

**Verificación:** test manual contra Gmail (App Password) desde consola:
`Email::ImapPollerService.new(channel: ch).perform` → aparecen las conversaciones de
los correos no leídos.

---

## Fase 4 — Rails: job recurrente `Email::PollInboxesJob`

**Objetivo:** pollear todos los canales email cada 1 min.

**Archivos:**
- `apps/messaging/app/jobs/email/poll_inboxes_job.rb` (nuevo)
- `apps/messaging/config/initializers/sidekiq.rb` (activar el schedule de Fase 0)

**Cambios:**
1. `Email::PollInboxesJob#perform`: itera `Channel::Email` con `imap_configured?`; por
   cada uno toma un **lock Redis** (`SETNX email_poll_lock:<id>`, TTL ~50s) y llama a
   `Email::ImapPollerService`. Liberar el lock en `ensure`.
2. Confirmar que el cron quedó cargado (`Sidekiq::Cron::Job.all`).

**Verificación:** dejar corriendo Sidekiq; enviar un correo a la casilla → en ≤1 min
aparece la conversación sin intervención manual.

---

## Fase 5 — Rails: envío SMTP `Email::SendViaSmtpService` + bounces

**Objetivo:** las respuestas salientes salen por SMTP en el hilo correcto; los
rebotes marcan el mensaje original como fallido.

**Archivos:**
- `apps/messaging/app/services/email/send_via_smtp_service.rb` (nuevo)
- `apps/messaging/app/services/email/bounce_handler.rb` (nuevo)
- `apps/messaging/app/jobs/send_reply_job.rb`

**Cambios:**
1. `Email::SendViaSmtpService < Base::SendOnChannelService`
   (`channel_class = Channel::Email`, `perform_reply`):
   - arma `Mail` con `delivery_method :smtp` (settings del canal),
   - `to`/`from`/`subject (Re:)`, headers `In-Reply-To`/`References`/`Message-ID`,
   - adjunta `message.attachments` (`mail.add_file`),
   - `deliver!`; éxito → `message.update!(status: :delivered, source_id: <msg-id>)` y
     acumula el `Message-ID` en `conversation.additional_attributes['mail_references']`;
     error → `status: :failed` + `external_error` (+ `authorization_error!` si auth).
2. Registrar `'Channel::Email' => ::Email::SendViaSmtpService` en
   `SendReplyJob::CHANNEL_SERVICES`.
3. `Email::BounceHandler.new(channel:, mail:).perform`: detecta DSN/`MAILER-DAEMON`/
   `Auto-Submitted`; ubica el `Message` original por `Original-Message-ID` →
   `status: :failed` + `external_error`; ignora auto-respuestas.

**Verificación:**
- Crear un `Message` outgoing en una conversación email → llega el email en el hilo
  (probar respondiendo desde Gmail y ver que la siguiente respuesta de la app encadena
  bien `In-Reply-To`).
- Enviar a una dirección inexistente → el DSN entrante marca el mensaje `failed`.

---

## Fase 6 — Rails: alta del canal (panel admin backend)

**Objetivo:** poder crear un inbox de tipo email vía API con sus credenciales.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/inboxes_controller.rb`
- (rutas/serializer si se expone lista de canales email con estado)

**Cambios:**
1. `build_channel`: rama `when 'email'` → `current_account.email_channels.create!(...)`
   con los params IMAP/SMTP.
2. `channel_params`: permitir los campos del canal email (host/port/login/password
   IMAP y SMTP + flags TLS + `email`).
3. Respuesta de estado de canales email (id, email, `imap_configured?`,
   `smtp_configured?`, `reauthorization_required`) — **sin** passwords.

**Verificación:** `curl` POST `/api/v1/inboxes` con `channel: { type: 'email', ... }`
→ crea `Channel::Email` + `Inbox`; GET no expone passwords.

---

## Fase 7 — Proxy FastAPI + Next

**Objetivo:** la config del canal viaja desde el frontend hasta Rails.

**Archivos:**
- `apps/backend/app/schemas/messaging.py`
- `apps/backend/app/services/messaging_service.py`
- `apps/backend/app/api/v1/endpoints/messaging.py`
- Route handlers Next + `apps/frontend/lib/api-client/messaging.ts`
- `apps/frontend/lib/types/messaging.ts`

**Cambios:**
1. Pydantic: `EmailChannelCreate`/`EmailChannelConfig` (passwords `SecretStr`,
   write-only; responses sin passwords).
2. Endpoint + service proxy (crear/actualizar canal email, listar estado),
   propagando `X-Tenant-Id`/`X-User-Id` como el resto.
3. Next route handler + api-client + tipo `EmailChannel` en TS.

**Verificación:** `cd apps/backend && uv run python -c "from app.schemas.messaging
import EmailChannelCreate"`; `cd apps/frontend && pnpm build` (typecheck);
`curl` end-to-end.

---

## Fase 8 — Frontend: UI de configuración del canal

**Objetivo:** form para conectar la casilla email y card del canal.

**Archivos:**
- `apps/frontend/app/dashboard/channels/` (form + card email, patrón WhatsApp/IG)
- `apps/frontend/components/email/channel-card.tsx` (nuevo)

**Cambios:**
1. Form de conexión (IMAP host/port/user/pass + SMTP host/port/user/pass + flags TLS +
   email de la casilla). Passwords write-only (no se prefill desde el backend).
2. **Selector de proveedor con presets** (`Gmail` / `Outlook-Office365` / `Otro`) que
   autocompleta host/puerto/flags TLS desde una constante en el frontend; `Otro` deja
   todo manual. Ver spec §Proveedores.
3. Card de estado (configurado / requiere reautorización) reusando el patrón de los
   otros canales. Gating por rol (`administrator`/`superadmin`).
4. (Opcional v1) botón "Probar conexión".

**Verificación:** conectar Gmail desde la UI → enviar/recibir correo y verlo en la
bandeja de conversaciones.

---

## Fase 9 — Tests Rails

**Archivos:**
- `apps/messaging/spec/models/channel/email_spec.rb`
- `apps/messaging/spec/services/email/incoming_email_service_spec.rb`
- `apps/messaging/spec/services/email/send_via_smtp_service_spec.rb`
- `apps/messaging/spec/services/email/bounce_handler_spec.rb`
- `apps/messaging/spec/jobs/email/poll_inboxes_job_spec.rb`
- fixtures `.eml` en `spec/fixtures/emails/`

**Casos:** ver spec §Testing (encriptación, ingreso, threading, dedup, adjuntos,
headers de salida, bounce, gating del job por `imap_configured?` + lock).

**Verificación:** `docker cp` de specs + `docker exec ventia-messaging bundle exec
rspec spec/services/email spec/models/channel/email_spec.rb`.

---

## Fase 10 — Tests pytest (backend) + verificación e2e

**Archivos:**
- `apps/backend/tests/unit/services/test_messaging_email_channel.py`

**Casos:** create/update del canal reenvían los campos IMAP/SMTP; las responses
**nunca** incluyen passwords.

**Verificación e2e (manual):**
- Gmail (App Password): recibir → responder → encadena en el hilo; adjunto ida y
  vuelta.
- Office365: ⚠️ **NO testeable con basic-auth** — su IMAP/POP basic-auth está apagado a
  nivel plataforma (verificado, docs MS). O365 solo es alcanzable vía la contingencia
  OAuth2 (spec §6 bis). **Decisión de producto pendiente** (spec §Riesgos #2): incluir
  O365 vía OAuth en el v1, o descoparlo y cerrar la tarea con Gmail/otros por App
  Password.

---

## Riesgos / puntos a confirmar al implementar

1. **Active Record Encryption (Fase 0):** llaves deben existir en dev y prod antes de
   la Fase 1. Confirmar manejo en Docker.
2. **Office365 sin basic-auth (Fase 10) — verificado:** Microsoft apagó
   permanentemente el basic-auth IMAP/POP en todos los tenants (~2023, irreversible).
   O365 **requiere OAuth2/XOAUTH2** para el IMAP entrante; no hay fallback basic-auth.
   Decisión de producto: incluir OAuth en el v1 (suma flujos OAuth + verificación CASA
   de Google + app en Entra) o descopar O365. Ver spec §6 bis y §Riesgos #2.
3. **UID vs SEARCH (Fase 3):** preferir UID (`imap_last_uid`) para evitar reprocesos.
4. **Solapamiento de polls (Fase 4):** lock por canal en Redis; confirmar TTL.
5. **Limpieza de cuerpo (Fase 2):** definir qué se guarda en `content` (respuesta
   nueva) vs `content_attributes` (HTML/cita completa).
6. **Tamaño de adjuntos:** alinear con la política/límite de ActiveStorage; loguear lo
   omitido (no truncar en silencio).
