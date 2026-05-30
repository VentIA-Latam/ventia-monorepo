# Diseño: Carrusel (generic template) de Instagram vía API

**Fecha:** 2026-05-30
**Estado:** Aprobado (pendiente revisión del spec escrito)
**Rama base:** `feat/instagram-dm-channel`

## Contexto

Hoy los mensajes salientes de Instagram solo soportan **texto y adjuntos**
(`Instagram::Providers::GraphApiService` arma `message.text` / `message.attachment`).
Para mejorar la estética de las respuestas —sobre todo para **mostrar productos**— Meta ofrece
el **generic template**: un carrusel horizontal de hasta 10 tarjetas, cada una con imagen,
título, subtítulo y botones. Es un **formato de mensaje** (no una plantilla pre-aprobada tipo
WhatsApp HSM) y se envía **dentro de la ventana de 24h**, igual que un mensaje normal.

El disparo es **vía API**: el agente IA / n8n arma el carrusel y lo postea al endpoint de
mensajes que ya existe (`POST /api/v1/conversations/:id/messages`). No se necesita compositor
manual en la UI ni traer catálogo de productos a messaging.

## Objetivos

- Permitir enviar carruseles de Instagram posteando `content_type: "cards"` al endpoint existente.
- Soportar botones **`web_url`** (abren link, como el CTA de WhatsApp) y **`postback`** (devuelven
  un payload al bot, como el Quick Reply de WhatsApp).
- Manejar el **postback entrante** (nuevo evento del webhook) para que el bot reaccione al toque.
- Renderizar el carrusel saliente en el chat (que el agente vea lo que mandó el bot).

## Fuera de alcance (MVP)

- Compositor manual de carruseles en la UI.
- Traer catálogo de productos (Shopify/Woo) a messaging.
- Carrusel en WhatsApp (el shape se deja agnóstico para habilitarlo después, pero no se implementa).

## Decisiones de diseño

### D1 — El canal lo define la conversación, no la API
No hay endpoint `/templates`. Se postea al mismo `POST /conversations/:id/messages`. El routing
ya resuelve el canal en `SendReplyJob` (`send_reply_job.rb:11`) leyendo
`message.conversation.inbox.channel.class` contra `CHANNEL_SERVICES`. El bot no necesita saber si
la conversación es IG o WhatsApp.

### D2 — Validar al crear (fail-fast 422)
Si `content_type == "cards"` y el canal de la conversación **no** es `Channel::Instagram`,
el controller responde **422** inmediatamente (no se crea mensaje huérfano). Alternativa
descartada: dejar pasar y fallar async en el envío (confuso, deja mensaje fallido en el chat).

### D3 — Shape propio limpio, transformado al formato Meta en el envío
`content_attributes.cards` usa un shape simple y agnóstico al canal (igual criterio que el
`referral` normalizado). `GraphApiService` lo transforma al `generic` template de Meta. Si mañana
se agrega carrusel en WhatsApp, el mismo `content_type: "cards"` rutea a otro formateador.

## Shape de datos

`POST /api/v1/conversations/:id/messages`:
```jsonc
{
  "content_type": "cards",
  "content_attributes": {
    "cards": [                                  // 1..10
      {
        "title": "Zapatillas Runner",            // requerido, se trunca a 80
        "subtitle": "S/ 199.90 · Tallas 38-44",  // opcional, se trunca a 80
        "image_url": "https://.../shoe.jpg",      // opcional (recomendado), https
        "default_action_url": "https://tienda.com/p/runner", // opcional: abre al tocar la tarjeta
        "buttons": [                              // opcional, 0..3
          { "type": "web_url",  "title": "Ver producto", "url": "https://tienda.com/p/runner" },
          { "type": "postback", "title": "Quiero este",  "payload": "BUY_RUNNER_123" }
        ]
      }
    ]
  }
}
```

## Backend (Rails / messaging)

### 1. Validación al crear — `app/controllers/api/v1/messages_controller.rb`
En el `create`, cuando `content_type == "cards"`:
- Validar que `@conversation.inbox.channel` sea `Channel::Instagram` → si no, `render_error(422)`.
- Validar que `content_attributes["cards"]` sea un array no vacío → si no, `422`.

### 2. Envío del template — `app/services/instagram/providers/graph_api_service.rb`
`send_message` detecta `message.content_type == 'cards'` (o `content_attributes['cards']` presente)
y, en vez de `send_attachments`/`send_text`, arma el payload `generic`:
```jsonc
{
  "recipient": { "id": "<IGSID>" },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "...",                       // <= 80
            "subtitle": "...",                    // <= 80 (omitir si vacío)
            "image_url": "...",                   // omitir si vacío
            "default_action": { "type": "web_url", "url": "..." }, // omitir si no hay
            "buttons": [
              { "type": "web_url",  "title": "...", "url": "..." },
              { "type": "postback", "title": "...", "payload": "..." }
            ]
          }
        ]
      }
    }
  }
}
```
**Validación defensiva** (evitar 400 de Graph API): cap 10 elementos, cap 3 botones por tarjeta,
truncar `title`/`subtitle` a 80, descartar tarjetas sin `title`, descartar botones inválidos
(`web_url` sin `url`, `postback` sin `payload`). `process_response` guarda `source_id` igual que hoy.

### 3. Postback entrante — `app/services/instagram/incoming_message_service.rb`
Nuevo branch en `process_event` para `event['postback']` (junto a `message`/`read`):
- `postback = { mid?, title, payload }`.
- Dedup por `postback['mid']` (o clave sintética `igsid:timestamp:payload` si no viene `mid`).
- Crea un **mensaje incoming** con `content = postback['title']` y
  `content_attributes.postback_payload = postback['payload']`.
- Fluye al bot por el `webhook_listener` existente (evento `message_created`) y se ve en el chat.

El webhook de postback entra por el **mismo** `POST /webhooks/instagram` (misma firma
`X-Hub-Signature-256`), así que `instagram_controller.rb` no cambia.

## Frontend

### 1. Tipos — `lib/types/messaging.ts`
```ts
interface CarouselCardButton {
  type: "web_url" | "postback";
  title: string;
  url?: string;       // web_url
  payload?: string;   // postback
}
interface CarouselCard {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action_url?: string;
  buttons?: CarouselCardButton[];
}
// MessageContentAttributes += cards?: CarouselCard[]; postback_payload?: string;
```

### 2. Render — nuevo `components/conversations/carousel-bubble.tsx`
- Scroll horizontal de tarjetas (imagen arriba edge-to-edge, título, subtítulo, botones apilados).
- Botón `web_url` → link real (`<a target="_blank">`, ícono de link, estilo CtaUrl existente).
- Botón `postback` → chip inerte (igual a los Quick Reply de WhatsApp en `TemplateButtons`).
- La tarjeta es tappable si trae `default_action_url`.

### 3. Integración — `components/conversations/message-bubble.tsx`
- Detectar `message.content_attributes?.cards?.length` → render `CarouselBubble` (saliente),
  con bubble más ancho (estilo `max-w` de adjuntos media).
- Para el postback **entrante**: se ve como un mensaje incoming normal (su `content` es el título);
  no requiere UI especial (opcional: un chip sutil "respuesta a botón").

## Manejo de errores

- Carrusel a conversación no-IG → **422** al crear (D2).
- Tarjetas/botones inválidos → se descartan defensivamente en el envío; si no queda ninguna tarjeta
  válida, el mensaje se marca `failed` con `external_error` (patrón existente en `process_response`).
- Falla de Graph API → `message.update!(status: :failed, ...)` como hoy.

## Testing

- **rspec `GraphApiService`**: un mensaje `cards` produce el payload `template/generic` correcto
  (mockear `HTTParty.post`); validación defensiva (cap 10/3, truncado 80, descarte de inválidos).
- **rspec `IncomingMessageService`**: payload con `postback` crea un incoming con
  `content_attributes.postback_payload` y dedup por `mid`.
- **rspec `messages_controller`** (o request spec): `cards` en conversación WhatsApp → 422;
  en Instagram → 200 y crea el mensaje.
- **Frontend lint** del `CarouselBubble` y `message-bubble`.
- **E2E manual**: extender `apps/messaging/scripts/replay_instagram_webhook.sh` con un modo
  `--postback`; y un curl al endpoint de mensajes con `cards` para validar el envío real a IG.

## Archivos

| Capa | Archivo | Cambio |
|---|---|---|
| Backend | `app/controllers/api/v1/messages_controller.rb` | validación 422 al crear `cards` |
| Backend | `app/services/instagram/providers/graph_api_service.rb` | payload `generic` + validación defensiva |
| Backend | `app/services/instagram/incoming_message_service.rb` | branch `postback` entrante |
| Frontend | `lib/types/messaging.ts` | tipos `CarouselCard*`, `postback_payload` |
| Frontend | `components/conversations/carousel-bubble.tsx` | **nuevo** render |
| Frontend | `components/conversations/message-bubble.tsx` | integración del carrusel |
| Test/dev | `apps/messaging/scripts/replay_instagram_webhook.sh` | modo `--postback` |
