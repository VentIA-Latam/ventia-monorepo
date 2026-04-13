# Plan: Manejo de mensajes WhatsApp "unavailable" (Meta error 131060)

## Contexto

Cuando un cliente escribe a un inbox de WhatsApp Cloud API y Meta no puede entregar el contenido del mensaje al webhook (típicamente en mensajes iniciados desde **Click-to-WhatsApp Ads**), el payload llega así:

```json
{
  "type": "unsupported",
  "unsupported": { "type": "unknown" },
  "errors": [{
    "code": 131060,
    "title": "This message is unavailable.",
    "message": "This message is unavailable.",
    "error_data": { "details": "This message is currently unavailable." }
  }]
}
```

**Comportamiento actual (bug)**: en `apps/messaging/app/services/whatsapp/incoming_message_service.rb:84-91`, el método `process_messages` descarta este payload con dos `next` consecutivos:

```ruby
next if error_webhook_event?(message_data)             # filtro 1: tiene 'errors'
next if unprocessable_message_type?(...)               # filtro 2: type='unsupported'
```

Resultado:
- No se crea contacto, ni conversación, ni mensaje en DB.
- No se loguea nada (el helper `log_error` está definido en `incoming_message_service_helpers.rb:28-31` pero **nunca se llama** — dead code).
- El agente humano nunca se entera de que llegó un lead. El cliente queda en silencio del lado del business.
- Caso confirmado en producción: contacto `+51941672294` mandó mensaje el 2026-04-11 11:38 desde un anuncio de Facebook/Instagram. Webhook llegó pero messaging lo descartó. Recién a las 11:55 el cliente reescribió por iniciativa propia y se creó el contacto (id=7399, account_id=29, inbox_id=58).

**Decisión del producto**: Meta tiene este bug mapeado pero sin fecha de fix. Mientras tanto, ventia debe:
1. **Capturar el evento** y abrir la conversación con un placeholder visible (estilo "Mensaje en espera" de WhatsApp).
2. **Auto-responder** con un texto genérico y natural (`"Hola, ¿cómo podemos ayudarte?"`) aprovechando la ventana de 24h que sí se abre del lado de Meta cuando se dispara el evento, sin referenciar el problema técnico.
3. **Persistir el `referral`** del CTWA si viene en el payload, para que el agente sepa de qué campaña vino el lead.
4. **Renderizar el mensaje placeholder en el frontend** con estilo distinto al normal, y marcar el auto-reply con un chip "Mensaje automático" debajo del bubble (solo para este caso).

**Decisiones tomadas explícitamente**:
- Sin fallback a templates de Meta (la ventana de 24h debería estar abierta; si no lo está y el send falla, el bubble queda como `failed` con el AlertCircle rojo existente, que es la señal visible para el agente).
- Sin variable `{{nombre}}` en el texto (no todos tienen nombre en perfil de WhatsApp).
- Sin frase de "tuvimos un problema técnico" (debe sonar natural y espontáneo).
- Sin anti-spam de "no responder si hay actividad reciente del agente" — responsabilidad de la marca.
- **Respetar `conversation.ai_agent_enabled`**: si la marca desactivó el agente, no auto-responder (solo crear el placeholder). Esto es coherente con que la marca tiene la responsabilidad de tomar el control.
- **Sender del auto-reply**: `nil` + `content_attributes.automated = true` (opción 1 — limpio, no requiere User fantasma).

## Validación clave: ¿`can_reply?` se actualiza con el placeholder?

**Sí, y esto es lo que hace que el plan sea viable.** `Conversations::MessageWindowService:23-31`:

```ruby
def last_message_in_messaging_window?(time)
  return false if last_incoming_message.nil?
  Time.current < last_incoming_message.created_at + time
end

def last_incoming_message
  @last_incoming_message ||= @conversation.messages.incoming.order(created_at: :asc).last
end
```

La query pivota **únicamente** sobre `message_type=incoming` y `created_at`. NO mira `content_attributes.is_unavailable`, ni `content`, ni nada más. Como creamos el placeholder con `message_type: :incoming`, **cuenta como mensaje incoming válido para `can_reply?`**, y la heurística retorna `true`.

Secuencia:

1. Crear placeholder (`incoming`, `is_unavailable=true`) → commit DB.
2. Crear auto-reply (`outgoing`) → `after_create_commit :send_reply` → `SendReplyJob.perform_later`.
3. Sidekiq ejecuta el job → `SendOnWhatsappService#perform_reply`.
4. `template_params.present? || !conversation.can_reply?`:
   - `template_params` → `nil` (no lo seteamos).
   - `can_reply?` → query encuentra el placeholder incoming → retorna `true`.
   - Resultado: `should_send_template_message = false`.
5. Cae en `send_session_message` → POST texto libre a Cloud API.

**Importante**: `can_reply?` es una heurística **local**, no consulta a Meta. Es una decisión de "qué method del channel llamar" (`send_message` vs `send_template`), no una pre-verificación con Meta. Aún si nuestro `can_reply?` dice `true`, Meta puede rechazar el send si su vista de la ventana difiere — ese es el escenario que la validación empírica con curl (sección Verificación) cubre. Si Meta rechaza, la exception cae en el rescue de `send_on_whatsapp_service.rb:15-17` y el mensaje queda con `status: :failed` + `external_error`, renderizado con el AlertCircle rojo existente. **No hay escenario "se envía a las puras"** — o sale bien o queda visible como fallido.

## Cambios

### Backend (Rails — `apps/messaging`)

#### 1. Nuevo service: `app/services/whatsapp/unavailable_message_handler.rb`

Service nuevo aislado en lugar de meter el caso especial en `IncomingMessageService` directamente. Razón: facilita test unitario, evita contaminar el path feliz, y deja un punto único de evolución si en el futuro Meta agrega otros códigos similares (131061, 131062, etc.).

**Responsabilidades**:
1. Dedup por `wamid` (Redis 5min + DB `Message.exists?(source_id:)`) — mismo patrón que `IncomingMessageService:106-109`.
2. Resolver contacto desde el array `contacts` del payload (que SÍ trae `wa_id` y `profile.name`).
3. `find_or_create_contact` / `find_or_create_contact_inbox` / `find_or_create_conversation` — reutilizar la misma lógica del service existente. **No duplicar** — extraer estos métodos a un módulo o llamarlos vía instancia del service existente. Recomendación: mover los 3 `find_or_create_*` a un módulo `Whatsapp::ContactResolution` que ambos servicios incluyan. Mínima superficie de cambio.
4. Crear el `Message` incoming con:
   ```ruby
   {
     account: @inbox.account,
     inbox: @inbox,
     conversation: @conversation,
     sender: @contact,
     sender_type: 'Contact',
     message_type: :incoming,
     status: :sent,
     content_type: :text,
     content: '',                                # vacío — el frontend renderiza por flag
     source_id: msg_id,                          # wamid → idempotencia
     content_attributes: {
       'is_unavailable' => true,
       'unavailable_reason' => '131060',
       'unavailable_title' => 'This message is unavailable',
       'wa_message_type' => 'unsupported',
       'referral' => extracted_referral_or_nil   # mismo formato que build_content_attributes
     }.compact
   }
   ```
5. **Loguear estructuradamente**:
   ```ruby
   Rails.logger.warn(
     "[WhatsApp][131060] Unavailable message received - " \
     "contact=#{phone} wamid=#{msg_id} inbox=#{@inbox.id} " \
     "account=#{@inbox.account_id} has_referral=#{referral.present?}"
   )
   ```
   Esto cierra el gap del `log_error` dead code y da grep-pattern útil para telemetría futura.
6. **Disparar el auto-reply** SOLO si:
   - El `Message` placeholder se acaba de crear ahora (no es duplicado del webhook), Y
   - `@conversation.ai_agent_enabled == true`

   Crear segundo `Message` con:
   ```ruby
   {
     account: @inbox.account,
     inbox: @inbox,
     conversation: @conversation,
     sender: nil,
     message_type: :outgoing,
     content_type: :text,
     content: 'Hola, ¿cómo podemos ayudarte?',
     content_attributes: {
       'automated' => true,
       'automated_reason' => 'unavailable_message_recovery'
     }
   }
   ```
   El `after_create_commit :send_reply` callback en `Message:83` dispara `SendReplyJob` automáticamente — **no llamamos a `SendOnWhatsappService` directamente**. El flujo existente decide:
   - Si `can_reply?` → `send_session_message` (texto libre, ventana abierta) → éxito, status `sent`.
   - Si `!can_reply?` → intenta template, no hay `template_params`, cae en `status :failed, external_error: 'Template not found...'` → bubble queda con AlertCircle rojo. Comportamiento correcto y deseado, sin código adicional.

#### 2. Hook en `incoming_message_service.rb:84-91`

Agregar la intercepción ANTES de los dos filtros existentes:

```ruby
def process_messages
  messages_data.each do |message_data|
    if unavailable_message?(message_data)
      Whatsapp::UnavailableMessageHandler.new(
        inbox: @inbox,
        message_data: message_data,
        contacts_data: contacts_data
      ).perform
      next
    end

    next if error_webhook_event?(message_data)
    next if unprocessable_message_type?(message_data['type'] || message_data[:type])

    process_single_message(message_data)
  end
end

def unavailable_message?(message_data)
  type = message_data['type'] || message_data[:type]
  errors = message_data['errors'] || message_data[:errors]
  return false unless type == 'unsupported'
  return false unless errors.is_a?(Array)
  code = errors.first&.dig('code') || errors.first&.dig(:code)
  code == 131060
end
```

**Importante**: el método mira ÚNICAMENTE el code 131060. Otros códigos de error o tipos `unsupported` sin error siguen el comportamiento actual (descarte silencioso). No queremos cambiar comportamiento de casos que no estamos seguros que necesiten manejo.

#### 3. Refactor mínimo: módulo `Whatsapp::ContactResolution`

Mover de `incoming_message_service.rb:135-170` los métodos `find_or_create_contact`, `find_or_create_contact_inbox`, `find_or_create_conversation` a un módulo nuevo `app/services/whatsapp/contact_resolution.rb` que ambos servicios incluyen. **Sin cambio de comportamiento**, solo extracción para reuso.

### Frontend (Next.js — `apps/frontend`)

#### 4. `lib/types/messaging.ts:126-132`

Extender `MessageContentAttributes`:

```ts
export interface MessageContentAttributes {
  cta_url?: CtaUrlData;
  referral?: ReferralData;
  items?: Array<{ title: string; value: string }>;
  contacts?: unknown[];
  in_reply_to?: string;
  // NUEVOS:
  is_unavailable?: boolean;
  unavailable_reason?: string;
  unavailable_title?: string;
  wa_message_type?: string;
  automated?: boolean;
  automated_reason?: string;
}
```

#### 5. `components/conversations/message-bubble.tsx`

**Dos cambios** en el componente:

**A. Render del mensaje incoming "unavailable"** (después de la guarda `isActivity` en línea 145, antes del bloque `return` principal):

```tsx
const isUnavailable = !isOutgoing && message.content_attributes?.is_unavailable === true;

if (isUnavailable) {
  return (
    <div className="flex max-w-[min(65%,500px)] mr-auto">
      <div className="relative rounded-lg rounded-tl-[4px] px-3 py-2 text-sm shadow-sm bg-card/60 border border-dashed border-border/60 min-w-0">
        {/* Referral preview if from CTWA */}
        {message.content_attributes?.referral ? (
          <ReferralBubble referral={message.content_attributes.referral} />
        ) : null}

        <div className="flex items-center gap-2 text-muted-foreground italic">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[13px]">Mensaje no disponible</span>
        </div>

        <span className="absolute bottom-1 right-2 text-[11px] text-muted-foreground/50">
          {time}
        </span>
      </div>
    </div>
  );
}
```

Estilo: `bg-card/60` (más pálido que un bubble normal) + `border-dashed` para reforzar que es un placeholder, ícono `AlertCircle` (ya importado) + texto italic "Mensaje no disponible". Si vino con `referral`, el `ReferralBubble` existente (`apps/frontend/components/conversations/referral-bubble.tsx`) se renderiza arriba mostrando la campaña — el agente igual ve de qué ad vino el lead.

**B. Chip "Mensaje automático" debajo del bubble outgoing cuando `automated === true`** (dentro del render principal del bubble outgoing, después del cierre del `<div>` interno del bubble pero antes del cierre del wrapper externo):

```tsx
{isOutgoing && message.content_attributes?.automated && (
  <span className="block text-[10px] text-muted-foreground/70 mt-0.5 text-right pr-1 italic">
    Mensaje automático
  </span>
)}
```

Solo aparece cuando el mensaje es outgoing Y tiene el flag `automated`. Cero impacto en mensajes outgoing normales del agente humano.

### Sin cambios necesarios

- **`message.rb`** — el `send_reply` callback ya dispara automáticamente para mensajes outgoing.
- **`send_on_whatsapp_service.rb`** — el flujo actual maneja correctamente el caso `can_reply?=false` con status `failed`.
- **`StatusIcon` / render de `failed`** — ya existe en `message-bubble.tsx:118-130`, no hay que tocar.
- **`ReferralBubble`** — ya existe y se renderiza cuando `content_attributes.referral` está presente.

## Archivos críticos a modificar

| Archivo | Cambio |
|---|---|
| `apps/messaging/app/services/whatsapp/incoming_message_service.rb:84-91` | Agregar interceptación + método `unavailable_message?` |
| `apps/messaging/app/services/whatsapp/unavailable_message_handler.rb` | **Nuevo** — handler del caso 131060 |
| `apps/messaging/app/services/whatsapp/contact_resolution.rb` | **Nuevo** — módulo extraído (refactor sin cambio de comportamiento) |
| `apps/messaging/app/services/whatsapp/incoming_message_service.rb:135-170` | Reemplazar métodos `find_or_create_*` por `include Whatsapp::ContactResolution` |
| `apps/frontend/lib/types/messaging.ts:126-132` | Extender interface `MessageContentAttributes` |
| `apps/frontend/components/conversations/message-bubble.tsx` | Render unavailable + chip "Mensaje automático" |

## Funciones / componentes existentes a reutilizar

| Existente | Dónde | Para qué |
|---|---|---|
| `ContactResolution` (extraído de `IncomingMessageService:135-170`) | `incoming_message_service.rb` | Crear contacto/conversación sin duplicar lógica |
| `Message.send_reply` callback | `message.rb:83,125-135` | Auto-disparar `SendReplyJob` al crear el outgoing — no llamar `SendOnWhatsappService` manual |
| `Whatsapp::SendOnWhatsappService:9` | `send_on_whatsapp_service.rb` | Manejo del path feliz (session) y del fallback (failed status) ya implementado |
| `ReferralBubble` | `components/conversations/referral-bubble.tsx` | Renderizar el referral del CTWA en el placeholder |
| `StatusIcon` con `case "failed"` | `message-bubble.tsx:118-130` | AlertCircle rojo cuando el auto-reply falla — sin código nuevo |
| Redis dedup pattern | `incoming_message_service.rb:351-357` | Mismo `whatsapp_message:#{source_id}` con TTL 5min |
| `build_content_attributes` para `referral` | `incoming_message_service.rb:319-334` | Mismo schema de keys (`source_url`, `headline`, `body`, etc.) |

## Verificación

### Validación previa (única, antes de mergear)

**Confirmar empíricamente que la ventana de 24h se abre cuando llega un 131060.** En la VM de prod, contra un número de prueba que haya generado un 131060 reciente:

```bash
# Sacar el token del channel
docker exec -it chatbot-prod-postgres psql -U postgres -d messaging_db -c "
  SELECT provider_config FROM channel_whatsapp WHERE phone_number_id = '<PHONE_NUMBER_ID>';
"

# Mandar un texto libre (NO template) al número de prueba
curl -i -X POST 'https://graph.facebook.com/v22.0/<PHONE_NUMBER_ID>/messages' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "<NUMERO_PRUEBA>",
    "type": "text",
    "text": { "body": "Test 24h window post-131060" }
  }'
```

- HTTP 200 + `messages[0].id` → ventana abierta. Hipótesis confirmada, deploy.
- HTTP 400 con `re-engagement message`/`outside the 24 hour window` → hipótesis FALSA. Re-evaluar antes de mergear.

### Tests automatizados (Rails)

`apps/messaging/spec/services/whatsapp/unavailable_message_handler_spec.rb`:

1. **Crea contacto + conversación + mensaje placeholder + auto-reply** cuando recibe payload 131060 válido.
2. **Es idempotente**: dos invocaciones con el mismo `wamid` solo crean un set de mensajes.
3. **Respeta `ai_agent_enabled=false`**: cuando la conversación tiene el agente desactivado, crea el placeholder pero NO crea el auto-reply.
4. **Persiste el `referral`** en `content_attributes` cuando viene en el payload.
5. **Sender del auto-reply es `nil`** y `content_attributes.automated == true`.
6. **No interfiere con mensajes normales**: payloads `type=text` sin errors siguen el flujo de `IncomingMessageService` sin cambios.

`apps/messaging/spec/services/whatsapp/incoming_message_service_spec.rb` — agregar:
1. Test que verifica que `unavailable_message?` retorna true SOLO para `type=unsupported && errors[0].code=131060`.
2. Test que verifica que otros payloads `type=unsupported` (sin errors) siguen siendo descartados silenciosamente como antes.

### E2E manual (post-deploy)

1. Buscar en logs de prod un caso real de 131060 (grep `[WhatsApp][131060]`).
2. Verificar en DB que el contacto y la conversación se crearon, y que hay 2 mensajes: el placeholder (`is_unavailable=true`) y el auto-reply (`automated=true`).
3. Abrir la conversación en el frontend de Ventia y validar visualmente:
   - Bubble incoming gris pálido con borde punteado y texto "Mensaje no disponible".
   - Bubble outgoing con "Hola, ¿cómo podemos ayudarte?" + chip "Mensaje automático" abajo.
   - Si el cliente venía de un ad, el `ReferralBubble` se muestra dentro del placeholder.
4. Si el cliente responde al auto-reply, el flujo normal continúa.

### Telemetría post-deploy

Query semanal para tracking:

```sql
SELECT
  date_trunc('day', created_at) AS day,
  inbox_id,
  count(*) AS unavailable_count
FROM messages
WHERE content_attributes->>'is_unavailable' = 'true'
GROUP BY day, inbox_id
ORDER BY day DESC;
```

Esto da munición concreta para escalar el ticket abierto con Meta ("recibimos N errores 131060 en X días, estimamos $Y de pipeline impactado") y para que marketing identifique campañas CTWA con tasas anormalmente altas.

## Out of scope (explícitamente no incluido)

- Anti-spam / debounce del auto-reply (es responsabilidad de la marca via `ai_agent_enabled`).
- Templates de Meta como fallback cuando la ventana está cerrada.
- Manejo de otros códigos de error WhatsApp (131061, 131062, etc.) — solo 131060.
- Variable de personalización con nombre en el texto del auto-reply.
- Cambio en el ícono del status `failed` o cualquier otra parte del render existente.
