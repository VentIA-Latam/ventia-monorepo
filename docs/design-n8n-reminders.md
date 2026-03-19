# Diseño: Recordatorios por Temperatura (n8n)

## Contexto

El workflow de n8n "Recordatorios por Temperatura" envía mensajes automáticos de follow-up a conversaciones de Chatwoot según la temperatura del lead y la ventana de inactividad. Actualmente los mensajes solo se pueden editar directamente en n8n.

Esta feature expone la edición de esos mensajes desde el dashboard de VentIA, sin permitir crear ni eliminar mensajes — solo modificar los existentes.

**Cada tenant puede tener distintas temperaturas y cantidades de mensajes.** Por ejemplo, un tenant puede tener 3 temperaturas (frío, tibio, caliente) y otro puede tener 4 (frío, tibio, caliente, visita física). El sistema descubre dinámicamente la estructura de cada workflow.

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

- `get_reminder_messages(workflow_id)` — lee el workflow, recorre el grafo de nodos dinámicamente y extrae todos los mensajes
- `update_reminder_messages(workflow_id, messages)` — actualiza los nodos de mensaje por ID y hace PUT al workflow

#### Algoritmo de descubrimiento dinámico

El cliente **no hardcodea** nombres ni cantidad de nodos. En su lugar, recorre el grafo de connections del workflow:

```
1. Buscar el nodo "Switch Ventana" (tipo n8n-nodes-base.switch)
   → Sus connections dan los Switch Temperatura de cada ventana

2. Por cada Switch Temperatura, leer sus rules.values
   → Cada rule tiene el valor de la temperatura (frio, tibio, caliente, visita fisica, etc.)

3. Seguir las connections de cada output del switch
   → Llega al nodo de mensaje (tipo n8n-nodes-base.set)

4. Del nodo de mensaje, extraer:
   → ID del nodo (para updates)
   → Nombre del nodo
   → Texto: node.parameters.assignments.assignments[0].value
```

#### Estructura del workflow en n8n

```
Switch Ventana (n8n-nodes-base.switch)
│   rules: [primer_recordatorio, ultimo_recordatorio]
│
├── output 0 → Switch Temperatura (V1)
│   │   rules: [frio, tibio, caliente, ...]
│   ├── output 0 → Mensaje Frio (n8n-nodes-base.set)
│   ├── output 1 → Mensaje Tibio (n8n-nodes-base.set)
│   ├── output 2 → Mensaje Caliente (n8n-nodes-base.set)
│   └── ...N temperaturas
│
└── output 1 → Switch Temperatura 2 (V2)
    │   rules: [frio, tibio, caliente, visita fisica, ...]
    ├── output 0 → Mensaje 2 Frio (n8n-nodes-base.set)
    ├── output 1 → Mensaje 2 Tibio (n8n-nodes-base.set)
    ├── output 2 → Mensaje 2 Caliente (n8n-nodes-base.set)
    ├── output 3 → Mensaje 2 Visita Fisica (n8n-nodes-base.set)
    └── ...N temperaturas
```

#### Cómo se recorren las connections de n8n

Las connections del workflow tienen esta estructura:
```json
{
  "Switch Ventana": {
    "main": [
      [{"node": "Switch Temperatura", "type": "main", "index": 0}],   // output 0 → V1
      [{"node": "Switch Temperatura 2", "type": "main", "index": 0}]  // output 1 → V2
    ]
  },
  "Switch Temperatura": {
    "main": [
      [{"node": "Mensaje Frio", ...}],      // output 0
      [{"node": "Mensaje Tibio", ...}],      // output 1
      [{"node": "Mensaje Caliente", ...}],   // output 2
      [{"node": "Loop Conversaciones", ...}] // fallback (ignorar)
    ]
  }
}
```

El cliente filtra los nodos destino por tipo `n8n-nodes-base.set` (ignora connections que van al Loop u otros nodos).

#### Datos extraídos por nodo de mensaje

| Campo | Fuente |
|-------|--------|
| `node_id` | `node.id` — identificador único, se usa como key para updates |
| `node_name` | `node.name` — nombre legible (ej: "Mensaje Frio") |
| `temperature` | `switch_temperatura.rules.values[output_index].conditions.conditions[0].rightValue` |
| `window` | Índice del output en Switch Ventana (0 = V1, 1 = V2) |
| `window_label` | `switch_ventana.rules.values[output_index].outputKey` (ej: "primer_recordatorio") |
| `text` | `node.parameters.assignments.assignments[0].value` (sin el prefijo `=`) |

### Endpoints (`app/api/v1/endpoints/reminders.py`)

| Método | Ruta                    | Descripción                                    |
|--------|------------------------|------------------------------------------------|
| GET    | `/reminders/messages`  | Devuelve todos los mensajes del tenant (dinámico) |
| PUT    | `/reminders/messages`  | Actualiza mensajes por node_id en n8n          |

### Permisos

- **SUPERADMIN** y **ADMIN**: lectura y escritura
- Otros roles: sin acceso (no ven la sección)

### Schema de response (GET)

```json
{
  "windows": [
    {
      "window": 0,
      "window_label": "primer_recordatorio",
      "messages": [
        {
          "node_id": "e5000001-0000-0000-0000-000000000003",
          "node_name": "Mensaje Frio",
          "temperature": "frio",
          "text": "Hola, quedó pendiente el tamaño que estás buscando..."
        },
        {
          "node_id": "e5000001-0000-0000-0000-000000000004",
          "node_name": "Mensaje Tibio",
          "temperature": "tibio",
          "text": "Hola, quería saber si te quedó alguna duda..."
        },
        {
          "node_id": "e5000001-0000-0000-0000-000000000005",
          "node_name": "Mensaje Caliente",
          "temperature": "caliente",
          "text": "Hola, ¿tienes alguna duda sobre los beneficios..."
        }
      ]
    },
    {
      "window": 1,
      "window_label": "ultimo_recordatorio",
      "messages": [
        {
          "node_id": "f7000001-0000-0000-0000-000000000002",
          "node_name": "Mensaje 2 Frio",
          "temperature": "frio",
          "text": "Hola, paso por aquí por si aún no renuncias..."
        },
        {
          "node_id": "f7000001-0000-0000-0000-000000000003",
          "node_name": "Mensaje 2 Tibio",
          "temperature": "tibio",
          "text": "Paso por aquí por si todavía estás evaluando..."
        },
        {
          "node_id": "f7000001-0000-0000-0000-000000000004",
          "node_name": "Mensaje 2 Caliente",
          "temperature": "caliente",
          "text": "Hola, no te conformes con cualquier colchón..."
        },
        {
          "node_id": "f084497a-4959-4f27-8d68-beedd3ef5684",
          "node_name": "Mensaje 2 Visita Fisica",
          "temperature": "visita fisica",
          "text": "Hola, no te olvides de probar tu próximo colchón..."
        }
      ]
    }
  ],
  "workflow_configured": true
}
```

> **Nota:** La cantidad de ventanas, temperaturas y mensajes es dinámica — varía por tenant según su workflow en n8n.

### Schema de request (PUT)

```json
{
  "messages": [
    {"node_id": "e5000001-0000-0000-0000-000000000003", "text": "Nuevo mensaje frío V1..."},
    {"node_id": "e5000001-0000-0000-0000-000000000004", "text": "Nuevo mensaje tibio V1..."},
    {"node_id": "e5000001-0000-0000-0000-000000000005", "text": "Nuevo mensaje caliente V1..."},
    {"node_id": "f7000001-0000-0000-0000-000000000002", "text": "Nuevo mensaje frío V2..."},
    {"node_id": "f7000001-0000-0000-0000-000000000003", "text": "Nuevo mensaje tibio V2..."},
    {"node_id": "f7000001-0000-0000-0000-000000000004", "text": "Nuevo mensaje caliente V2..."},
    {"node_id": "f084497a-4959-4f27-8d68-beedd3ef5684", "text": "Nuevo mensaje visita física V2..."}
  ]
}
```

El `node_id` es el identificador único del nodo en n8n. El backend valida que cada `node_id` corresponda a un nodo de mensaje real del workflow.

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

Página agrupada por ventanas. Cada ventana es una sección con un título (ej: "Primer recordatorio (3-4h)") y dentro tiene una card por mensaje. Cada card muestra:

- **Badge de temperatura**: color dinámico según temperatura (frío=azul, tibio=amarillo, caliente=rojo, otros=gris)
- **Textarea** editable con el mensaje actual
- **Contador de caracteres**

Botón global **"Guardar cambios"** al final que envía todos los mensajes al backend.

**Estado vacío**: Si el tenant no tiene `n8n_reminder_workflow_id` configurado, mostrar mensaje indicando que la funcionalidad no está habilitada.

> **Nota:** La UI renderiza dinámicamente N ventanas con N mensajes cada una, según lo que devuelva el GET.

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
2. Frontend → `GET /api/reminders/messages` → backend lee `workflow_id` del tenant → llama n8n API → recorre grafo de connections → extrae ventanas y mensajes → responde
3. Frontend renderiza N ventanas con N cards cada una según el response
4. Usuario edita textos y hace click en "Guardar cambios"
5. Frontend → `PUT /api/reminders/messages` con array de `{node_id, text}` → backend valida node_ids contra workflow real → actualiza nodos en n8n → responde OK
6. Toast de éxito/error

---

## Fuera de alcance (YAGNI)

- No se pueden crear ni eliminar mensajes, temperaturas ni ventanas
- No se editan ventanas de tiempo (eso es config del workflow en n8n)
- No hay preview de cómo se ve el mensaje en WhatsApp
- No hay historial de cambios de mensajes
- No se descubren workflows automáticamente — el `n8n_reminder_workflow_id` se configura manualmente por tenant
