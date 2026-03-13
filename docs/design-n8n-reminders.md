# Diseño: Recordatorios por Temperatura (n8n)

## Contexto

El workflow de n8n "Temperature Reminder Trigger" envía mensajes automáticos de follow-up a conversaciones de Chatwoot según la temperatura del lead (frío, tibio, caliente) y la ventana de inactividad (3-4h o 22-23h). Actualmente los mensajes solo se pueden editar directamente en n8n.

Esta feature expone la edición de esos mensajes desde el dashboard de VentIA, sin permitir crear ni eliminar mensajes — solo modificar los 4 existentes.

Referencia del flujo n8n: `docs/flujo-temperaturas.md`

---

## Arquitectura

```
Frontend (dashboard/reminders)
    | fetch /api/reminders/*
Next.js API Routes (proxy con auth)
    | fetch backend
FastAPI endpoints (/api/v1/reminders)
    | fetch n8n API
n8n instance (GET/PUT workflow)
```

---

## Backend

### Config (`app/core/config.py`)

Nuevas variables de entorno globales:

```python
N8N_BASE_URL: str = ""        # https://n8n.ventia-latam.com
N8N_API_KEY: str = ""          # API key de n8n
```

### Modelo: Tenant

Agregar campo `n8n_reminder_workflow_id` (nullable string) a la tabla `tenants`. Cada tenant apunta a su propio workflow en n8n.

```python
n8n_reminder_workflow_id = Column(String(50), nullable=True)
```

### Integración (`app/integrations/n8n_client.py`)

Cliente HTTP que interactúa con la API de n8n:

- `get_reminder_messages(workflow_id)` — lee el workflow completo y extrae los 4 nodos de mensaje por nombre
- `update_reminder_messages(workflow_id, messages)` — actualiza los nodos de mensaje y hace PUT al workflow

Nodos objetivo (nombres exactos en n8n):

| Nombre del nodo       | Key          | Ventana | Temperatura |
|----------------------|--------------|---------|-------------|
| `Mensaje Frio`       | `frio_v1`    | 1       | frio        |
| `Mensaje Tibio`      | `tibio_v1`   | 1       | tibio       |
| `Mensaje Caliente`   | `caliente_v1`| 1       | caliente    |
| `Mensaje 2 Caliente` | `caliente_v2`| 2       | caliente    |

Ruta al texto dentro de cada nodo: `node.parameters.assignments.assignments[0].value`

### Endpoints (`app/api/v1/endpoints/reminders.py`)

| Método | Ruta                    | Descripción                          |
|--------|------------------------|--------------------------------------|
| GET    | `/reminders/messages`  | Devuelve los 4 mensajes del tenant   |
| PUT    | `/reminders/messages`  | Actualiza los 4 mensajes en n8n      |

### Permisos

- **SUPERADMIN** y **ADMIN**: lectura y escritura
- Otros roles: sin acceso (no ven la sección)

### Schema de response (GET)

```json
{
  "messages": [
    {
      "key": "frio_v1",
      "temperature": "frio",
      "window": 1,
      "label": "Frío - Primer recordatorio (3-4h)",
      "text": "Hola, quedó pendiente el modelo..."
    },
    {
      "key": "tibio_v1",
      "temperature": "tibio",
      "window": 1,
      "label": "Tibio - Primer recordatorio (3-4h)",
      "text": "Hola, quería saber si te quedó alguna duda."
    },
    {
      "key": "caliente_v1",
      "temperature": "caliente",
      "window": 1,
      "label": "Caliente - Primer recordatorio (3-4h)",
      "text": "Hola, tienes alguna duda sobre los beneficios..."
    },
    {
      "key": "caliente_v2",
      "temperature": "caliente",
      "window": 2,
      "label": "Caliente - Último recordatorio (22-23h)",
      "text": "Hola, no dejes pasar la oportunidad"
    }
  ],
  "workflow_configured": true
}
```

### Schema de request (PUT)

```json
{
  "messages": [
    {"key": "frio_v1", "text": "Nuevo mensaje frío..."},
    {"key": "tibio_v1", "text": "Nuevo mensaje tibio..."},
    {"key": "caliente_v1", "text": "Nuevo mensaje caliente V1..."},
    {"key": "caliente_v2", "text": "Nuevo mensaje caliente V2..."}
  ]
}
```

---

## Frontend

### Ruta

`/dashboard/reminders` — nueva entrada "Recordatorios" en el sidebar.

### Sidebar

Agregar entrada en `app-sidebar.tsx`:
- Título: "Recordatorios"
- Icono: `Clock` (de lucide-react)
- Visible solo para roles ADMIN y SUPERADMIN

### UI

Página con una card por mensaje (4 cards). Cada card muestra:

- **Badge de temperatura**: Frío (azul), Tibio (amarillo), Caliente (rojo)
- **Badge de ventana**: "V1: 3-4 horas" / "V2: 22-23 horas"
- **Textarea** editable con el mensaje actual
- **Contador de caracteres**

Botón global **"Guardar cambios"** al final que envía los 4 mensajes al backend.

**Estado vacío**: Si el tenant no tiene `n8n_reminder_workflow_id` configurado, mostrar mensaje indicando que la funcionalidad no está habilitada.

### Estructura de archivos

```
apps/frontend/
├── app/dashboard/reminders/
│   ├── page.tsx                    # Server component
│   └── reminders-client.tsx        # Client component
├── app/api/reminders/
│   └── messages/route.ts           # Proxy GET/PUT al backend
└── lib/api-client/
    └── reminders.ts                # Cliente API
```

### Data flow

1. Usuario abre `/dashboard/reminders`
2. Frontend → `GET /api/reminders/messages` → backend lee `workflow_id` del tenant → llama n8n API → extrae mensajes → responde
3. Usuario edita textos y hace click en "Guardar cambios"
4. Frontend → `PUT /api/reminders/messages` con los 4 textos → backend valida → actualiza workflow en n8n → responde OK
5. Toast de éxito/error

---

## Fuera de alcance (YAGNI)

- No se pueden crear ni eliminar mensajes ni temperaturas
- No se editan ventanas de tiempo (eso es config del workflow en n8n)
- No hay preview de cómo se ve el mensaje en WhatsApp
- No hay historial de cambios de mensajes
