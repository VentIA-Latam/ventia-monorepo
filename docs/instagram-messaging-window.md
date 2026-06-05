# Ventana de 24 horas para Instagram

## Contexto

Meta impone una ventana de 24 horas (Standard Messaging Window) en la Instagram Messaging API: una vez que el contacto envía un DM al negocio, hay 24 horas para responder libremente. Pasado ese tiempo sin nueva interacción del usuario, la Graph API rechaza el envío. La ventana se reinicia cada vez que el cliente vuelve a enviar un mensaje o interactúa (tap de botón de carousel, reply a story, etc.).

Esta política es idéntica en forma a la de WhatsApp, que el messaging service ya implementa.

## Estado anterior

`Conversations::MessageWindowService` declaraba ventana solo para `Channel::Whatsapp`:

```ruby
def messaging_window
  case @conversation.inbox.channel_type
  when 'Channel::Whatsapp'
    MESSAGING_WINDOW_24_HOURS
  end
end
```

Para `Channel::Instagram` el método devolvía `nil`, por lo que `Conversation#can_reply?` siempre retornaba `true`. Consecuencias:

- El banner "ventana expirada" en `message-view.tsx` nunca se mostraba para conversaciones de IG.
- El composer nunca se deshabilitaba.
- Los envíos fuera de las 24h llegaban hasta `Instagram::SendOnInstagramService`, Meta los rechazaba, y el mensaje quedaba como `failed` sin feedback útil previo al agente.

## Cambios

1. **Backend** (`apps/messaging/app/services/conversations/message_window_service.rb`): se agrega el branch `when 'Channel::Instagram'` con la misma constante de 24h. Se mantiene como branch separado del de WhatsApp para dejar abierta la extensión a 7 días con `HUMAN_AGENT` tag en una iteración futura sin tener que descomponer un `when` compuesto.

2. **Frontend** (`apps/frontend/components/conversations/message-view.tsx`): el texto del banner "ventana expirada" pasa a depender de `conversation.inbox?.channel_type`:
   - WhatsApp: "La ventana de 24 horas ha expirado. Solo puedes enviar plantillas de WhatsApp."
   - Instagram (y otros canales con ventana): "La ventana de 24 horas ha expirado. No es posible responder en este momento."

   El `disabled` del composer ya estaba ligado a `can_reply` y queda automáticamente activo para IG fuera de ventana.

3. **Tests** (`apps/messaging/spec/services/conversations/message_window_service_spec.rb`): nuevo spec con casos de IG (sin incoming / incoming 23h / incoming 25h) y regresión espejo para WhatsApp.

## Decisiones

- **Texto del banner para IG**: se eligió texto genérico ("No es posible responder en este momento") en vez de instruir al agente a esperar al cliente. Razón: el agente del producto ya conoce la política; un texto breve mantiene paridad visual con WhatsApp.
- **Sin validación servidor-side del envío**: WhatsApp tampoco la tiene hoy; el `MessagesController#create` confía en que el frontend respete `can_reply`. Mantenemos la simetría para no introducir un comportamiento divergente en este cambio.
- **No se introduce `travel_to`** en los tests: ningún spec del messaging service lo usa hoy. Los casos se modelan pasando `created_at:` explícito al `Message.create!`.

## Fuera de alcance

Quedan registrados para iteraciones futuras y se priorizan según necesidad real del negocio:

- **Tag `HUMAN_AGENT` + extensión a 7 días**: requiere distinguir sender humano vs automatizado en cada envío, y aplicar el tag solo cuando el agente es humano. Política de Meta detecta abuso del tag con bots — implementar mal pone en riesgo la cuenta.
- **Validación servidor-side**: rechazar en el endpoint `send_message` cuando `can_reply == false`, en vez de delegar solo al frontend. Útil si terceros usan la API directa.
- **`external_created_at` con timestamp de Meta**: hoy el `created_at` del mensaje incoming se llena con `Time.current` cuando se procesa el webhook. Bajo backlog o retries el desfase puede hacer que Ventia crea que la ventana sigue abierta cuando para Meta ya cerró. Usar `event['timestamp']` corregiría el cálculo.
- **Read receipts y reactions como interacción**: hoy solo mensajes de texto, adjuntos, postbacks y story replies cuentan como "interacción del usuario". Confirmar con la doc de Meta si los read receipts y reactions también resetean la ventana, y si sí, persistirlos para que `last_incoming_message` los considere.

## Referencias

- Política oficial de Meta: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/>
- Análisis previo del canal IG: [`docs/instagram-dm-analysis.md`](./instagram-dm-analysis.md)
- Comparación con Chatwoot: branch para Instagram con flag global `ENABLE_INSTAGRAM_CHANNEL_HUMAN_AGENT` que decide 24h vs 7d (ver `chatwoot/app/services/conversations/message_window_service.rb`). Ventia no replica ese flag global por las razones del scope arriba.
