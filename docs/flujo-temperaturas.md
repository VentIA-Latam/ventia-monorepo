# Flujo de Reminders por Temperatura

## Workflow: Temperature Reminder Trigger Nassau

### Diagrama del flujo

```
Schedule Trigger (cada hora, 7am-10pm)
        |
   Set Tenants (configura cuenta Chatwoot)
        |
GET Conversaciones (API Chatwoot - conversaciones abiertas con label "ventas-ia")
        |
  Procesar Pagina (acumula resultados, pagina de 25 en 25)
        |
  IF: Mas Paginas? ──(SI)──> vuelve a GET Conversaciones
        |
       (NO)
        |
  Filtrar Temperatura (clasifica por ventana de inactividad)
        |
  IF: Hay Resultados?
        |
       (SI)
        |
  Loop Conversaciones (procesa de a 1)
        |
  Switch Ventana
   /          \
  V1           V2
  |             |
Switch        Switch
Temperatura   Temperatura 2
 /  |  \        |
F   T   C       C
|   |   |       |
Msg Msg Msg    Msg
 \  |  /       /
  Wait 2s ◄───┘
    |
Enviar Mensaje Chatwoot (POST API)
    |
  Loop (siguiente conversacion)
```

---

## 1. Trigger

El workflow se ejecuta **cada hora entre las 7:00 y las 22:00** (cron: `0 7-22 * * *`).

---

## 2. Obtencion de conversaciones

### Set Tenants
Configura los datos del tenant (cuenta Chatwoot):
- `account_id`: ID de la cuenta
- `chatwoot_url`: URL de la instancia Chatwoot
- `api_token`: Token de autenticacion

### GET Conversaciones
Consulta la API de Chatwoot con los filtros:
- **status**: `open` (solo conversaciones abiertas)
- **labels[]**: `ventas-ia` (solo conversaciones etiquetadas para ventas con IA)

### Paginacion
El nodo **Procesar Pagina** acumula las conversaciones pagina por pagina (25 por pagina, maximo 20 paginas). Mientras haya mas paginas dentro de la ventana de 24 horas, vuelve a llamar a la API.

---

## 3. Filtrar Temperatura (nodo clave)

Este nodo determina **que conversaciones reciben un reminder** y en **que ventana** caen. Para cada conversacion valida debe cumplir:

1. Tener el label `ventas-ia`
2. Tener el custom attribute `temperature` definido (valores: `frio`, `tibio`, `caliente`)
3. Tener actividad registrada del contacto (`last_activity_at`)

### Ventanas de tiempo (anti-spam)

Se calcula las **horas de inactividad** del contacto desde su ultima actividad:

| Ventana | Horas de inactividad | Campo asignado | Descripcion |
|---|---|---|---|
| **Ventana 1** | 3 a 4 horas | `primer_recordatorio` | Primer follow-up tras inactividad corta |
| **Ventana 2** | 22 a 23 horas | `ultimo_recordatorio` | Ultimo follow-up antes de cumplir 24h |

Las ventanas de 1 hora de ancho (3-4h y 22-23h) combinadas con la ejecucion horaria del trigger garantizan que **cada conversacion reciba como maximo 1 mensaje por ventana** (mecanismo anti-spam).

---

## 4. Switch Ventana

Despues del loop, cada conversacion se rutea segun su campo `ventana`:

| Salida | Condicion | Destino |
|---|---|---|
| Salida 0 | `ventana` = `primer_recordatorio` | **Switch Temperatura** |
| Salida 1 | `ventana` = `ultimo_recordatorio` | **Switch Temperatura 2** |

---

## 5. Switch Temperatura (Ventana 1 - primer recordatorio)

Evalua el campo `temperatura` de la conversacion:

| Salida | Temperatura | Mensaje enviado |
|---|---|---|
| 0 | `frio` | "Hola, quedo pendiente el modelo que estas buscando. Estamos aqui para ayudarte en lo que necesites." |
| 1 | `tibio` | "Hola, queria saber si te quedo alguna duda." |
| 2 | `caliente` | "Hola, tienes alguna duda sobre los beneficios del producto, el envio o los metodos de pago?" |

---

## 6. Switch Temperatura 2 (Ventana 2 - ultimo recordatorio)

Evalua el mismo campo `temperatura` pero solo tiene mensaje configurado para caliente:

| Salida | Temperatura | Mensaje enviado |
|---|---|---|
| 0 | `frio` | *(sin mensaje configurado)* |
| 1 | `tibio` | *(sin mensaje configurado)* |
| 2 | `caliente` | "Hola, no dejes pasar la oportunidad" |

> **Nota:** Las conversaciones frias y tibias en ventana 2 no reciben segundo recordatorio.

---

## 7. Envio del mensaje

Todos los mensajes pasan por un **Wait de 2 segundos** (rate limiting) y luego se envian via la API de Chatwoot:

```
POST /api/v1/accounts/{account_id}/conversations/{conversation_id}/messages
```

Con los parametros:
- `content`: el mensaje segun temperatura
- `message_type`: `outgoing`
- `private`: `false`

Despues del envio, el loop continua con la siguiente conversacion.

---

## Resumen de mensajes por temperatura y ventana

| | Ventana 1 (3-4h) | Ventana 2 (22-23h) |
|---|---|---|
| **Frio** | "Quedo pendiente el modelo..." | *(no se envia)* |
| **Tibio** | "Queria saber si te quedo alguna duda" | *(no se envia)* |
| **Caliente** | "Tienes alguna duda sobre beneficios..." | "No dejes pasar la oportunidad" |

---

## Como modificar los mensajes por codigo

### Prerequisitos

- Node.js instalado
- Acceso a la API de n8n con un API key valido

### Variables de entorno

```bash
N8N_URL="https://n8n.ventia-latam.com"
N8N_API_KEY="tu-api-key-aqui"
WORKFLOW_ID="71T9is6ZuhnCQy98"
```

### Estructura del workflow (donde viven los mensajes)

Los mensajes estan en nodos de tipo `n8n-nodes-base.set`. Cada nodo tiene esta estructura:

```json
{
  "name": "Mensaje Frio",
  "type": "n8n-nodes-base.set",
  "parameters": {
    "assignments": {
      "assignments": [
        {
          "id": "msg",
          "name": "mensaje",
          "value": "Hola, quedo pendiente el modelo...",  // <-- TEXTO A MODIFICAR
          "type": "string"
        }
      ]
    }
  }
}
```

### Nodos que contienen los mensajes

| Nombre del nodo | Ventana | Temperatura | Ruta al texto |
|---|---|---|---|
| `Mensaje Frio` | 1 (3-4h) | frio | `node.parameters.assignments.assignments[0].value` |
| `Mensaje Tibio` | 1 (3-4h) | tibio | `node.parameters.assignments.assignments[0].value` |
| `Mensaje Caliente` | 1 (3-4h) | caliente | `node.parameters.assignments.assignments[0].value` |
| `Mensaje 2 Caliente` | 2 (22-23h) | caliente | `node.parameters.assignments.assignments[0].value` |

### Paso 1: Obtener el workflow

```javascript
const N8N_URL = "https://n8n.ventia-latam.com";
const N8N_API_KEY = "tu-api-key";
const WORKFLOW_ID = "71T9is6ZuhnCQy98";

// Obtener el workflow completo
const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
  headers: { "X-N8N-API-KEY": N8N_API_KEY }
});
const workflow = await res.json();
```

### Paso 2: Localizar los nodos de mensaje

```javascript
// Nombres exactos de los nodos de mensaje
const MESSAGE_NODES = {
  "Mensaje Frio":       "ventana1 - frio",
  "Mensaje Tibio":      "ventana1 - tibio",
  "Mensaje Caliente":   "ventana1 - caliente",
  "Mensaje 2 Caliente": "ventana2 - caliente",
};

// Encontrar un nodo por nombre
function findNode(workflow, nodeName) {
  return workflow.nodes.find(n => n.name === nodeName);
}

// Leer el texto actual de un nodo de mensaje
function getMessageText(node) {
  return node.parameters.assignments.assignments[0].value;
}

// Ejemplo: leer todos los mensajes actuales
for (const [nodeName, desc] of Object.entries(MESSAGE_NODES)) {
  const node = findNode(workflow, nodeName);
  console.log(`[${desc}] ${getMessageText(node)}`);
}
```

### Paso 3: Modificar un mensaje

```javascript
// Cambiar el texto de un nodo de mensaje
function setMessageText(node, newText) {
  // El "=" al inicio es requerido por n8n para indicar que es una expresion
  node.parameters.assignments.assignments[0].value = "=" + newText;
}

// Ejemplo: cambiar el mensaje frio
const nodoFrio = findNode(workflow, "Mensaje Frio");
setMessageText(nodoFrio, "Hola! Vi que estabas mirando un producto. Te puedo ayudar?");
```

> **Importante:** Los valores en n8n llevan un `=` al inicio cuando son expresiones. Todos los mensajes actuales lo tienen. Mantene ese prefijo al escribir nuevos textos.

### Paso 4: Guardar los cambios via API

```javascript
// Actualizar el workflow en n8n
const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
  method: "PUT",
  headers: {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: workflow.name,  // REQUERIDO por la API de n8n
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  })
});

if (updateRes.ok) {
  console.log("Workflow actualizado correctamente");
} else {
  console.error("Error:", await updateRes.text());
}
```

### Script completo de ejemplo

```javascript
// update-messages.js
// Uso: node update-messages.js

const N8N_URL = "https://n8n.ventia-latam.com";
const N8N_API_KEY = "tu-api-key";
const WORKFLOW_ID = "71T9is6ZuhnCQy98";

// Nuevos mensajes (editar aqui)
const NUEVOS_MENSAJES = {
  "Mensaje Frio":       "Hola, quedo pendiente el modelo que estas buscando. Estamos aqui para ayudarte en lo que necesites.",
  "Mensaje Tibio":      "Hola, queria saber si te quedo alguna duda.",
  "Mensaje Caliente":   "Hola, tienes alguna duda sobre los beneficios del producto, el envio o los metodos de pago?",
  "Mensaje 2 Caliente": "Hola, no dejes pasar la oportunidad",
};

async function main() {
  // 1. Obtener workflow
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { "X-N8N-API-KEY": N8N_API_KEY }
  });
  const workflow = await res.json();

  // 2. Modificar mensajes
  for (const [nodeName, nuevoTexto] of Object.entries(NUEVOS_MENSAJES)) {
    const node = workflow.nodes.find(n => n.name === nodeName);
    if (!node) {
      console.warn(`Nodo "${nodeName}" no encontrado, saltando...`);
      continue;
    }

    const textoAnterior = node.parameters.assignments.assignments[0].value;
    node.parameters.assignments.assignments[0].value = "=" + nuevoTexto;
    console.log(`[${nodeName}]`);
    console.log(`  Antes:   ${textoAnterior}`);
    console.log(`  Despues: =${nuevoTexto}`);
    console.log();
  }

  // 3. Guardar cambios
  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: "PUT",
    headers: {
      "X-N8N-API-KEY": N8N_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: workflow.name,  // REQUERIDO por la API de n8n
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    })
  });

  if (updateRes.ok) {
    console.log("Workflow actualizado correctamente.");
  } else {
    console.error("Error al actualizar:", await updateRes.text());
  }
}

main().catch(console.error);
```

### Con curl (lectura rapida)

```bash
# Ver el mensaje actual del nodo "Mensaje Frio"
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID" \
  | node -e "
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const wf = JSON.parse(Buffer.concat(chunks).toString());
      const node = wf.nodes.find(n => n.name === 'Mensaje Frio');
      console.log(node.parameters.assignments.assignments[0].value);
    });
  "
```
