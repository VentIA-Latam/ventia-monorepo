# Diseño: Sistema de Tickets para Reportes del Agente IA (MVP)

**Fecha:** 2026-04-30  
**Versión:** 1.0 (MVP)  
**Objetivo:** Crear un formulario que permita a clientes ADMIN reportar incidencias, solicitar ajustes y proponer desarrollos adicionales del agente de IA. Los datos se envían directamente a n8n para clasificación y creación de issues en ClickUp.

---

## 1. Visión General

### Propósito
VentIA integra un agente de IA que asiste en la gestión de órdenes. Los clientes necesitan una forma sencilla de reportar problemas, solicitar mejoras menores (ajustes) y proponer cambios estructurales (desarrollos adicionales).

### Flujo Completo
```
Cliente ADMIN navega a /dashboard/tickets
  → Completa formulario (tipo, descripción, conversación opcional)
  → Frontend valida datos localmente
  → Frontend obtiene datos del usuario y conversación (si aplica)
  → Frontend envía payload directamente a webhook n8n
  → Toast éxito + formulario se resetea
  → n8n recibe, clasifica y crea issue en ClickUp
  → Soporte gestiona y contacta cliente
```

### Importante: MVP sin BD
Esta es una implementación de prueba. El backend **no persiste** tickets en la BD de VentIA. Los datos fluyen directamente a n8n. En futuras versiones se añadirá un endpoint backend intermedio para mejor auditoría y control.

---

## 2. Ubicación y Acceso

### Ruta
- **Path:** `/dashboard/tickets`
- **Sidebar:** Opción "Tickets" visible únicamente para usuarios con rol `ADMIN`
- **Componentes:**
  - `apps/frontend/app/dashboard/tickets/page.tsx` (Server Component)
  - `apps/frontend/app/dashboard/tickets/new-ticket-client.tsx` (Client Component)

### Permisos
- Solo rol `ADMIN` puede acceder
- Validación en middleware de Next.js + verificación en el componente cliente

---

## 3. Estructura del Formulario

### 3.1 Selector de Tipo (Requerido)

**Control:** Radio buttons  
**Opciones:**
1. **🔴 Incidencia Crítica** → `critical_incident`
   - Descripción: "Errores o fallas del agente que afectan operación inmediata"
   - Ejemplos: respuesta incorrecta, formato equivocado, flujo roto
   - **Comportamiento:** Muestra selector de conversación
   - **Conversación:** Requerida

2. **🟡 Ajuste al Agente** → `agent_adjustment`
   - Descripción: "Cambios menores de comportamiento o contenido"
   - Ejemplos: cambiar saludo, ajustar tono, modificar cierre
   - **Comportamiento:** Oculta selector de conversación
   - **Payload:** Solo type, description, user

3. **🟢 Desarrollo Adicional** → `additional_development`
   - Descripción: "Mejoras o cambios estructurales profundos"
   - Ejemplos: nueva sección, rediseño de flujo, nueva integración
   - **Comportamiento:** Oculta selector de conversación
   - **Payload:** Solo type, description, user

**Validación:** Debe seleccionar uno  
**Error:** "Selecciona un tipo de ticket"

---

### 3.2 Textarea de Descripción (Requerido)

**Atributos:**
- **Placeholder:** "Describe el problema, solicitud o mejora con el máximo detalle posible"
- **Min caracteres:** 10
- **Max caracteres:** 5000
- **Contador visible:** Sí, en tiempo real (ej: "245 / 5000")
- **Validación en vivo:** Mientras el usuario escribe

**Validaciones:**
| Condición | Error |
|-----------|-------|
| < 10 caracteres | "Mínimo 10 caracteres" |
| > 5000 caracteres | "Máximo 5000 caracteres" |
| Vacío | "La descripción es requerida" |

---

### 3.3 Selector de Conversación (Condicional)

**Visibilidad:** Solo si `type === "critical_incident"`

**Control:** Select/Dropdown con búsqueda en tiempo real

**Búsqueda:**
- Filtro: `search` (busca por nombre, teléfono, email del contacto)
- Request: `GET /api/v1/messaging/conversations?search={query}`
- Timing: Instant search (sin debounce)
- Actualización: Mientras el usuario escribe

**Formato de Opción:**
```
"Nombre Contacto - +Número"
Ejemplo: "Renzo - +51904890457"
```

**Datos Mostrados:**
- `contact.name` + `contact.phone_number` (del endpoint de conversaciones)

**Comportamiento:**
- Requerido cuando visible
- Si no hay conversaciones: mostrar placeholder "No hay conversaciones recientes. Completa la descripción con detalles del problema"
- Al seleccionar: guardar `conversation_id`, `contact` e `inbox` completos

**Validación:**
- Conversación debe ser seleccionada
- conversation_id debe ser UUID válido

**Error:** "Selecciona una conversación"

---

### 3.4 Botón Enviar

**Texto:** "Enviar Ticket"

**Estados:**
| Estado | Condición | Apariencia |
|--------|-----------|-----------|
| Habilitado | Formulario válido | Normal, clickeable, color primary |
| Deshabilitado | Hay errores de validación | Grayedout, cursor not-allowed |
| Loading | Enviando a n8n | Spinner animado + "Enviando..." |
| Error | Fallo en request | Normal, permite reintentar |

---

## 4. Flujo de Datos y Obtención de Información

### 4.1 Datos del Usuario

**Endpoint:** `GET /api/v1/users/me`  
**Autenticación:** JWT (bearer token)  
**Campos a extraer:**
- `email` → incluir en payload
- `name` → incluir en payload
- `tenant_id` → incluir en payload

---

### 4.2 Datos de Conversación (Solo si critical_incident)

**Endpoint:** `GET /api/v1/messaging/conversations?search={query}`  
**Autenticación:** JWT (bearer token)  
**Campos a extraer (conversación seleccionada):**
- `id` → `conversation_id` en payload
- `contact` → objeto completo con { id, name, phone_number, email, last_activity_at }
- `inbox` → objeto completo con { id, name, channel_type }

---

### 4.3 Payloads a n8n

#### **Para Critical Incident:**
```json
{
  "type": "critical_incident",
  "description": "El agente no entiende cuando el cliente pregunta sobre estado de envío...",
  "user": {
    "email": "cliente@empresa.com",
    "name": "Juan Pérez",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "conversation_id": "550e8400-e29b-41d4-a716-446655440001",
  "contact": {
    "id": 5544,
    "name": "Renzo",
    "phone_number": "+51904890457",
    "email": null,
    "last_activity_at": "2026-04-30T20:26:40.915Z"
  },
  "inbox": {
    "id": 52,
    "name": "Ventia 9",
    "channel_type": "Channel::Whatsapp"
  }
}
```

#### **Para Agent Adjustment / Additional Development:**
```json
{
  "type": "agent_adjustment",
  "description": "Cambiar el saludo inicial del agente a un tono más amigable...",
  "user": {
    "email": "cliente@empresa.com",
    "name": "Juan Pérez",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## 5. Configuración de Request a n8n

**Método:** `POST`  
**URL:** `https://n8n.ventia-latam.com/webhook/clickup-test`  
**Content-Type:** `application/json`  
**Headers:** Ninguno especial (CORS habilitado en n8n)  
**Timeout:** 10 segundos  
**Reintentos:** Manual (usuario puede reintentar si falla)  

---

## 6. Validaciones y Manejo de Errores

### 6.1 Validaciones en Frontend

| Campo | Validación | Error |
|-------|-----------|-------|
| `type` | Seleccionado | "Selecciona un tipo de ticket" |
| `description` | 10-5000 caracteres | "Mínimo 10 caracteres" / "Máximo 5000 caracteres" |
| `conversation_id` | UUID válido + requerido si type=critical | "Selecciona una conversación" |

**Timing:** Validación en tiempo real mientras el usuario interactúa

---

### 6.2 Flujos de Error

#### **Error de Validación Local**
- Toast rojo con mensaje específico
- Resaltar campo con error (border rojo, ícono de error)
- Scroll a campo con error (si no está en viewport)
- Botón enviar deshabilitado

#### **Error de Red / n8n No Responde**
- Toast rojo: "Error al enviar el ticket. Intenta nuevamente"
- Mantener datos del formulario (para que no se pierda lo escrito)
- Botón enviar vuelve a estar disponible para reintentar manual

#### **Error de Conversación No Encontrada**
- Toast rojo: "La conversación seleccionada ya no está disponible"
- Limpiar campo de conversación
- Permitir seleccionar otra conversación

---

### 6.3 Flujo Post-Envío Exitoso

1. **Toast verde:** "✓ Ticket enviado. El equipo de soporte te contactará pronto"
2. **Reset automático:** Todos los campos se vacían
3. **Focus:** Volver al selector de tipo (para facilitar envío de múltiples tickets)

---

## 7. Consideraciones Técnicas

### 7.1 Estructura de Componentes

```
apps/frontend/app/dashboard/tickets/
├── page.tsx                     # Server component (validación de permisos)
└── new-ticket-client.tsx        # Client component (lógica del formulario)
```

**page.tsx (Server):**
- Valida que el usuario tenga rol ADMIN
- Renderiza el layout de la página
- Pasa datos necesarios al cliente

**new-ticket-client.tsx (Client):**
- Estado local del formulario
- Validaciones
- Llamadas a endpoints del backend (GET users/me, GET conversations)
- Envío a webhook n8n
- Manejo de errores y toasts

### 7.2 Hooks y Librerías

- **useToast():** Para notificaciones (error, éxito)
- **useState:** Estado local del formulario
- **useEffect:** Para obtener datos del usuario (GET /api/v1/users/me) al montar
- **shadcn/ui:** Radio, Select, Button, Textarea, Input

### 7.3 Estilos

- **Tailwind CSS v4** con tokens del proyecto (volt, aqua, cielo, marino, noche)
- **cn()** utility para merge de clases
- Diseño responsive (mobile-first)

### 7.4 Servicios API

Crear o reutilizar funciones en `lib/services/`:
- `getUserInfo()` → GET `/api/v1/users/me`
- `getConversations(search: string)` → GET `/api/v1/messaging/conversations?search={search}`

Ambas funciones reciben `accessToken` como parámetro (patrón del proyecto).

---

## 8. Testing

### 8.1 Frontend (Vitest / React Testing Library)

- ✓ Formulario renderiza selector de tipo
- ✓ Selector de tipo es requerido
- ✓ Si critical_incident → campo conversación visible, required
- ✓ Si no critical_incident → campo conversación oculto
- ✓ Descripción valida mínimo 10 caracteres
- ✓ Descripción valida máximo 5000 caracteres
- ✓ Contador de caracteres actualiza en vivo
- ✓ Búsqueda de conversaciones trabaja
- ✓ Botón enviar disabled hasta completar campos válidos
- ✓ Toast éxito al enviar
- ✓ Formulario resetea post-envío
- ✓ Error toast si falla envío
- ✓ Campos se resaltan con error
- ✓ Botón reintentar funciona post-error

---

## 9. Límites y Restricciones

- **Descripción:** 10-5000 caracteres (textarea)
- **Conversaciones a mostrar:** Sin límite en búsqueda (depende de la API)
- **Timeout a n8n:** 10 segundos
- **Frecuencia:** Sin límite por ahora (rate limiting puede añadirse después)
- **Formato de respuesta:** JSON
- **CORS:** Habilitado en n8n para dominio del frontend

---

## 10. Fases de Implementación (Próximo Step)

1. **Frontend:** Componente page.tsx + new-ticket-client.tsx
2. **Integración:** GET users/me + GET conversations + POST a n8n
3. **Testing:** Tests unitarios del formulario
4. **n8n:** Verificar CORS habilitado + probar webhook
5. **QA:** Prueba end-to-end del flujo completo

---

## Referencias

- **Arquitectura frontend:** CLAUDE.md - Frontend Structure
- **Componentes UI:** shadcn/ui + Tailwind CSS v4
- **Multitenancy:** CLAUDE.md - Key Concepts: Multitenancy
- **RBAC:** CLAUDE.md - Role-Based Access Control
- **Endpoints existentes:**
  - GET `/api/v1/users/me`
  - GET `/api/v1/messaging/conversations`
