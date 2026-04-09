# Notification Settings — Design Document

**Fecha**: 2026-03-24
**Feature**: Configuración de notificaciones push por usuario
**Ubicación UI**: Dropdown del footer del sidebar → "Notificaciones" → Dialog con toggles

---

## Problema

Los agentes no pueden configurar qué categorías de notificaciones push recibir. Actualmente todas se envían según la lógica del FcmListener sin considerar preferencias individuales.

## Categorías configurables

| Categoría | Flag name | Default | Descripción |
|-----------|-----------|---------|-------------|
| Soporte humano | `human_support` | ON | Conversación derivada a soporte humano |
| Pago pendiente | `payment_review` | ON | Comprobante de pago enviado |
| Mensajes (IA OFF) | `message_ai_off` | ON | Mensaje nuevo con IA desactivada |
| Mensajes (IA ON) | `message_ai_on` | OFF | Mensaje nuevo con IA activada |

## Componentes

### Rails (Messaging)

| Componente | Cambio |
|-----------|--------|
| `NotificationSetting` model | Reemplazar FLAGS con las 4 categorías nuevas |
| `NotificationSettingsController` | GET (leer) + PUT (actualizar) preferencias push |
| `FcmListener` | Consultar preferencias del usuario antes de encolar job |
| Migración | Reset push_flags default a las nuevas categorías |

### FastAPI (Backend)

| Componente | Cambio |
|-----------|--------|
| Endpoint proxy | GET + PUT `/messaging/notification-settings` |

### Next.js (Frontend)

| Componente | Cambio |
|-----------|--------|
| `app-sidebar.tsx` | Agregar item "Notificaciones" en dropdown del footer |
| `NotificationSettingsDialog` | Dialog con 4 Switch toggles |
| API route | `/api/messaging/notification-settings` proxy |

## Flujo

```
Usuario abre dropdown footer → click "Notificaciones"
  → Abre dialog → GET /api/messaging/notification-settings
  → Muestra 4 toggles con estado actual
  → Usuario cambia un toggle → PUT /api/messaging/notification-settings
  → Rails actualiza push_flags bitmask
  → FcmListener consulta preferencias al enviar push
```

## UI

- Dialog modal con título "Notificaciones push"
- 4 filas: icono + título + descripción corta + Switch
- Colores VentIA: switches con accent aqua
- Responsive mobile
