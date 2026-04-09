# FCM Push Notifications — Design Document

**Fecha**: 2026-03-21
**Feature**: Push notifications para agentes de Messaging vía Firebase Cloud Messaging
**Enfoque elegido**: FCM directo desde Messaging (Rails)

---

## Problema

Los agentes no reciben notificaciones cuando llegan mensajes nuevos y no están viendo activamente el dashboard. Esto causa tiempos de respuesta altos, especialmente en derivaciones a soporte humano y pagos pendientes de validar.

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Dónde enviar FCM | Rails (Messaging) | Wisper events + OnlineStatusTracker ya están ahí. Sin hop extra. |
| Dónde guardar tokens | messaging_db | Acceso directo desde el listener, sin cruzar servicios. |
| Gem para FCM | `fcm` (~2.0) | Wrapper ligero, acepta credenciales via ENV. |
| Credenciales Firebase | Variables de entorno | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` |
| Deep link al click | Query param `?id=` | Mínimo cambio (~5 líneas). El panel split usa estado interno, no rutas dinámicas. |
| Preferencia notif. opcional | Por tenant | Campo `notify_ai_messages` en accounts. |
| Firebase SDK en frontend | Dynamic import | Evita cargar Firebase en el bundle inicial. |
| UX de permisos | Banner propio + prompt nativo | User gesture requerido por browsers, obligatorio en iOS. |

## Categorías de notificación

| Categoría | Trigger (Wisper) | Obligatoria | Título | Body |
|-----------|-----------------|-------------|--------|------|
| Derivación a soporte humano | `conversation_labels_updated` con label `soporte-humano` | Sí | "Conversación requiere soporte humano" | Nombre contacto + preview último mensaje |
| Pago pendiente de validar | `conversation_labels_updated` con label `en-revisión` | Sí | "Pago pendiente de validar" | Nombre contacto |
| Mensaje con IA OFF | `message_created` con `ai_agent_enabled == false` | Sí | "Nuevo mensaje" | Preview del contenido |
| Mensaje con IA ON | `message_created` con `ai_agent_enabled == true` | No (configurable) | "Nuevo mensaje" | Preview del contenido |

## Modelo de datos

### Nueva tabla: `messaging.push_subscription_tokens`

| Campo | Tipo | Notas |
|-------|------|-------|
| id | bigint PK | |
| user_id | bigint FK → users | Agente |
| account_id | bigint FK → accounts | Tenant |
| token | text NOT NULL | Token FCM del dispositivo |
| platform | enum('web','android','ios') | Default 'web' |
| device_info | jsonb | Browser, OS (debug) |
| created_at | timestamp | |
| updated_at | timestamp | |

**Índices**: UNIQUE (user_id, token), INDEX (account_id)

### Campo nuevo en `messaging.accounts`

- `notify_ai_messages` boolean DEFAULT false

## Componentes nuevos

### Rails (Messaging)

| Componente | Tipo | Responsabilidad |
|-----------|------|-----------------|
| `FcmListener` | Wisper listener | Escucha `message_created` y `conversation_labels_updated`, filtra por tipo, consulta OnlineStatusTracker, encola job |
| `Notifications::SendFcmJob` | Sidekiq job | Envía push via gem `fcm`, limpia tokens inválidos (UNREGISTERED) |
| `PushSubscriptionToken` | Model | Validaciones, scopes por account |
| `Api::V1::PushSubscriptionTokensController` | Controller | POST (registrar) + DELETE (eliminar) |
| `config/initializers/fcm.rb` | Initializer | Inicializa FCM client con ENV vars |
| Migración | DB | Tabla push_subscription_tokens + campo notify_ai_messages |

### FastAPI (Backend)

| Componente | Tipo | Responsabilidad |
|-----------|------|-----------------|
| Endpoint proxy push-tokens | POST + DELETE | Proxea a Messaging Rails |

### Next.js (Frontend)

| Componente | Tipo | Responsabilidad |
|-----------|------|-----------------|
| `lib/firebase-client.ts` | Lib | Dynamic import de Firebase SDK, requestPermission, onForegroundMessage |
| `components/notifications/notification-setup.tsx` | Client component | Banner de activación, registro de token, toasts in-app. Cargado con `next/dynamic` ssr:false |
| `public/firebase-messaging-sw.js` | Service Worker | Background push + click → deep link |
| `app/api/messaging/push-tokens/route.ts` | API route | Proxy POST/DELETE a FastAPI |
| Query param `?id=` en conversations-client | Modificación | Lee `searchParams.id` al montar, selecciona conversación |

## Flujos end-to-end

### Registro de token

```
Usuario abre dashboard → NotificationSetup (dynamic, ssr:false)
  → Banner "Activar notificaciones" → click
  → firebase-client.ts (dynamic import) → requestPermission() → token FCM
  → POST /api/messaging/push-tokens → FastAPI → Messaging Rails → DB
  → onForegroundMessage() queda escuchando para toasts
```

### Push notification (mensaje IA OFF — obligatorio)

```
Cliente envía WhatsApp → Messaging Rails recibe mensaje
  → Wisper broadcast(:message_created)
  → FCMListener: ai_agent_enabled? == false → ENVIAR
  → OnlineStatusTracker → agentes online [1, 3, 5]
  → PushSubscriptionToken.where(account_id:).where.not(user_id: online) → tokens offline
  → SendFcmJob → FCM API → push al dispositivo
  → Click en notificación → Service Worker → /dashboard/conversations?id=123
```

### Push notification (label soporte-humano — obligatorio)

```
IA agrega label "soporte-humano"
  → Wisper broadcast(:conversation_labels_updated)
  → FCMListener: label == 'soporte-humano' → ENVIAR
  → Misma lógica de filtro online/offline → push
```

### Push notification (label en-revisión — obligatorio)

```
Se agrega label "en-revisión"
  → Misma cadena, título: "Pago pendiente de validar"
```

### Push notification (mensaje IA ON — opcional)

```
Igual que IA OFF pero:
  → FCMListener: ai_agent_enabled? == true
  → Consulta account.notify_ai_messages → false? IGNORAR. true? ENVIAR
```

## Variables de entorno

### Messaging (Rails) — nuevas

```
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

### Frontend (Next.js) — nuevas

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

## Best practices aplicadas (Vercel/React)

- `bundle-dynamic-imports`: NotificationSetup con `next/dynamic` ssr:false
- `bundle-defer-third-party`: Firebase SDK con dynamic import
- `rerender-move-effect-to-event`: Setup disparado por click, no por useEffect
- `rerender-lazy-state-init`: Permission state inicializado una vez
- `async-parallel`: Query param ?id= sin waterfall con carga de conversaciones

## Dependencias nuevas

- **Rails**: `gem 'fcm', '~> 2.0'`
- **Frontend**: `firebase` (npm), `firebase-messaging-sw.js` (estático)
- **Firebase Console**: Proyecto configurado con Web Push (VAPID key)
