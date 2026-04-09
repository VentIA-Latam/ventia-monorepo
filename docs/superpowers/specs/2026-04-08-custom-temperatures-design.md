# Temperaturas Personalizadas por Tenant

**Fecha:** 2026-04-08
**Estado:** Aprobado
**Enfoque:** JSON config en Account (Enfoque A)

## Problema

Las temperaturas de conversaciones son un enum fijo (`cold`, `warm`, `hot`) compartido por todos los tenants. Clientes necesitan definir sus propias clasificaciones (ej: "interesado", "negociando", "perdido") para que el agente n8n pueda clasificar conversaciones según el proceso comercial de cada negocio.

## Decisiones de diseno

| Decision | Resultado |
|----------|-----------|
| Almacenamiento de definiciones | Campo JSONB `temperature_config` en tabla `accounts` (messaging) |
| Almacenamiento en conversacion | Columna `temperature` cambia de integer (enum) a string |
| Configuracion inicial por tenant | Configurable: SUPERADMIN elige defaults (cold/warm/hot) o set custom |
| Quien gestiona | Solo SUPERADMIN, via panel de detalle del tenant |
| Propiedades por temperatura | `key`, `name`, `color`, `icon`, `position` |
| Colores | Paleta predefinida de 8 colores (mismos que labels) |
| Iconos | Set predefinido de ~15-20 iconos Lucide |
| Limite por tenant | Maximo 5 temperaturas |
| Asignacion a conversaciones | Manual (usuario) o automatica (agente n8n via API). Nuevas conversaciones nacen con `temperature = NULL` |
| Autenticacion endpoints | `require_permission_dual` (JWT SUPERADMIN + API Key) |

## Modelo de datos

### Estructura del JSON `temperature_config` (en `accounts`)

```json
[
  { "key": "cold", "name": "Frio", "color": "#1f93ff", "icon": "snowflake", "position": 0 },
  { "key": "warm", "name": "Tibio", "color": "#FF9800", "icon": "thermometer", "position": 1 },
  { "key": "hot", "name": "Caliente", "color": "#E91E63", "icon": "flame", "position": 2 }
]
```

**Reglas de validacion:**
- Maximo 5 entries
- `key`: unico dentro del array, snake_case, sin espacios
- `color`: debe estar en la paleta predefinida
- `icon`: debe estar en el set permitido de Lucide icons
- `position`: entero para orden visual (no jerarquia)

### Migracion de datos

Una sola migracion que:

1. Convierte valores existentes en `conversations.temperature`:
   - `0` -> `"cold"`
   - `1` -> `"warm"`
   - `2` -> `"hot"`
   - `NULL` -> sigue `NULL`
2. Cambia tipo de columna `conversations.temperature` de integer a string (default nil)
3. Agrega columna `accounts.temperature_config` como jsonb (default `[]`)

### Cambios en modelos Rails

**`Conversation`:**
- Eliminar `enum :temperature, { cold: 0, warm: 1, hot: 2 }, prefix: true`
- Agregar validacion: si `temperature` no es nil, debe existir como `key` en el `temperature_config` del account asociado

**`Account`:**
- Agregar validaciones del JSON `temperature_config` (max 5, keys unicas, colores/iconos validos)

### Bugfix incluido

Agregar `temperature: temperature` al metodo `webhook_data` en el modelo `Conversation` para que los cambios de temperatura se propaguen por WebSocket (ActionCable) a otros clientes conectados.

## API

### Rails (messaging) - Nuevos endpoints

**`GET /api/v1/accounts/temperature_config`**
- Devuelve el `temperature_config` del account (tenant determinado por header `X-Tenant-Id`)
- Response: `{ "data": [...] }`

**`PUT /api/v1/accounts/temperature_config`**
- Reemplaza el config completo
- Body: `{ "temperature_config": [...] }`
- Valida max 5, keys unicas, colores/iconos validos
- Response: `{ "data": [...] }`

### Rails - Cambios existentes

**`PATCH /api/v1/conversations/:id`**
- Al recibir `temperature`, valida que el valor exista como `key` en el `temperature_config` del account
- Si el config esta vacio (sin temperaturas configuradas), rechaza el update con error

**`GET /api/v1/conversations`**
- Filtro `?temperature=key` sigue funcionando, ahora contra string en vez de enum

### FastAPI (backend) - Nuevos endpoints proxy

**`GET /api/v1/messaging/temperature-config`**
- Query param: `tenant_id` (SUPERADMIN puede especificar cualquiera)
- Auth: `require_permission_dual("GET", "/messaging/temperature-config")`
- Proxy a Rails GET

**`PUT /api/v1/messaging/temperature-config`**
- Query param: `tenant_id`
- Auth: `require_permission_dual("PUT", "/messaging/temperature-config")`
- Proxy a Rails PUT

## Frontend

### Panel SUPERADMIN - Card de Temperaturas

**Ubicacion:** `/superadmin/tenants/:id` (pagina de detalle del tenant), debajo de la card de Webhook.

**Contenido de la card:**
- Titulo: "Configuracion de Temperaturas" con icono Thermometer
- Badge indicando estado: "3/5 configuradas" o "Sin configurar"
- Lista de temperaturas actuales: icono + nombre + color (circulo) + botones editar/eliminar
- Boton "Agregar temperatura" (deshabilitado si ya hay 5)
- Boton "Cargar defaults" (visible solo si el array esta vacio, carga cold/warm/hot)
- Al agregar/editar: formulario inline o mini dialog con:
  - Input nombre (texto)
  - Selector de color (grilla de 8 colores predefinidos)
  - Selector de icono (grilla de ~15-20 iconos Lucide)
- Confirmacion al eliminar. Si hay conversaciones usando esa temperatura, se eliminan igual pero las conversaciones que la tenian asignada quedan con `temperature = NULL` (se limpia en la migracion/endpoint)

### Componentes de conversaciones - Refactor a dinamico

**`temperature-selector.tsx`:**
- Recibe `temperatureConfig` como prop (o lo lee de contexto)
- Renderiza las opciones dinamicamente con color e icono del config
- Si el config esta vacio, no muestra el selector

**`conversation-filters.tsx`:**
- El dropdown de temperaturas se llena desde el config del tenant
- Si no hay config, no muestra la opcion de filtro por temperatura

**`conversation-item.tsx`:**
- Resuelve icono y color dinamicamente desde el config
- Si la temperatura de la conversacion no existe en el config actual (fue eliminada), muestra un fallback generico

### Tipo TypeScript

```typescript
// Cambia de:
type ConversationTemperature = "cold" | "warm" | "hot" | null;

// A:
type ConversationTemperature = string | null;

interface TemperatureDefinition {
  key: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}
```

### Carga del config

El `temperature_config` se carga una vez al entrar al modulo de conversaciones via `GET /api/v1/messaging/temperature-config` y se comparte por props a los componentes que lo necesitan.

### Paleta de colores predefinida

```
"#1f93ff" (azul), "#4CAF50" (verde), "#FF9800" (naranja), "#E91E63" (rosa),
"#9C27B0" (morado), "#00BCD4" (cyan), "#795548" (marron), "#607D8B" (gris)
```

### Set de iconos Lucide predefinidos

`snowflake`, `flame`, `thermometer`, `star`, `heart`, `zap`, `target`, `trophy`, `flag`, `bell`, `eye`, `clock`, `thumbs-up`, `thumbs-down`, `circle-check`, `circle-x`, `trending-up`, `trending-down`, `user-check`, `sparkles`

## Flujo del agente n8n

No requiere cambios de codigo en la aplicacion. El workflow de n8n se configura para:

1. Consultar `GET /api/v1/messaging/temperature-config?tenant_id=X` (via API Key) para obtener las opciones disponibles
2. Incluir las opciones en el prompt/instrucciones del agente clasificador
3. Setear la temperatura elegida via `PATCH /conversations/:id` con `{ temperature: "key" }`

## Resumen de cambios por capa

| Capa | Cambios |
|------|---------|
| Rails migracion | 1 migracion: temperature int->string + temperature_config jsonb en accounts |
| Rails modelos | Conversation (quitar enum, validacion), Account (validacion JSON) |
| Rails controller | Nuevo endpoint temperature_config (GET/PUT), bugfix webhook_data |
| FastAPI endpoints | 2 nuevos endpoints proxy con permission_dual |
| Frontend superadmin | Card de temperaturas en detalle de tenant |
| Frontend componentes | Icon picker, color picker, refactor 3 componentes a dinamico |
| Frontend tipos | ConversationTemperature -> string, nuevo TemperatureDefinition |
| n8n | Solo config de workflow (sin cambios de codigo) |
