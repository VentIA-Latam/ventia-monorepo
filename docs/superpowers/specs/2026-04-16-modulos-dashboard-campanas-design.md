# Diseño: Módulos Dashboard + Campañas Masivas

**Fecha:** 2026-04-16
**Estado:** Aprobado

---

## Módulo 1: Activity Messages (Logs de derivación)

### Contexto
El messaging app ya tiene `message_type: :activity` (enum valor 2) en el modelo Message, pero no existen handlers que generen estos mensajes automáticamente. Se necesita el patrón de Chatwoot: concerns modulares que detecten cambios en conversaciones y creen mensajes de actividad inline.

### Historias de Usuario

#### US-ACT-001: Crear infraestructura base de Activity Messages
**Como** desarrollador
**Quiero** un sistema base que detecte cambios en conversaciones y genere mensajes de actividad
**Para** poder agregar handlers modulares fácilmente

**Criterios de aceptación:**
- Callback `after_update_commit` en Conversation que detecta qué campo cambió
- Módulo base `ActivityMessageHandler` con método `create_activity(conversation, content)`
- Resolución del usuario que hizo el cambio via `Current.user` (thread-local)
- Los mensajes de actividad se crean con `message_type: :activity`

**Estimación:** 3-4 horas

---

#### US-ACT-002: Handler de Escalación (AI on/off)
**Como** supervisor
**Quiero** ver en la conversación cuándo se desactivó/reactivó la IA y quién lo hizo
**Para** tener trazabilidad de las derivaciones a soporte humano

**Criterios de aceptación:**
- Cuando `ai_agent_enabled` cambia a `false` → "IA desactivada por [usuario]"
- Cuando `ai_agent_enabled` cambia a `true` → "IA reactivada por [usuario]"

**Estimación:** 1-2 horas

---

#### US-ACT-003: Handler de Labels
**Como** supervisor
**Quiero** ver en la conversación cuándo se agregaron o removieron etiquetas
**Para** rastrear cambios de estado como "en-revisión" o "soporte-humano"

**Criterios de aceptación:**
- Al agregar label → "Etiqueta '[nombre]' añadida por [usuario]"
- Al remover label → "Etiqueta '[nombre]' removida por [usuario]"

**Estimación:** 1-2 horas

---

#### US-ACT-004: Handler de Stage
**Como** supervisor
**Quiero** ver cuándo una conversación cambió de etapa (pre_sale → sale)
**Para** trackear el pipeline de ventas

**Criterios de aceptación:**
- Cuando `stage` cambia → "Etapa cambiada a [nueva etapa] por [usuario]"

**Estimación:** 1 hora

---

#### US-ACT-005: Handler de Status
**Como** supervisor
**Quiero** ver cuándo se resolvió, reabrió o pausó una conversación
**Para** entender el flujo de atención

**Criterios de aceptación:**
- Cuando `status` cambia → "Conversación [acción] por [usuario]"
- Acciones: abierta, resuelta, pendiente, pospuesta

**Estimación:** 1 hora

---

#### US-ACT-006: Handler de Temperatura
**Como** supervisor
**Quiero** ver cuándo se cambió la temperatura del agente IA en una conversación
**Para** entender ajustes de personalidad por conversación

**Criterios de aceptación:**
- Cuando `temperature` cambia → "Temperatura cambiada a [valor] por [usuario]"

**Estimación:** 1 hora

---

#### US-ACT-007: Handler de Asignación
**Como** supervisor
**Quiero** ver cuándo se asignó o reasignó un agente a una conversación
**Para** rastrear distribución de carga

**Criterios de aceptación:**
- Cuando `assignee_id` cambia → "Asignado a [nombre] por [usuario]"
- Si se desasigna → "Desasignado por [usuario]"

**Estimación:** 1-2 horas

---

#### US-ACT-008: Handler de Prioridad
**Como** supervisor
**Quiero** ver cuándo cambió la prioridad de una conversación
**Para** entender la urgencia histórica

**Criterios de aceptación:**
- Cuando `priority` cambia → "Prioridad cambiada a [nivel] por [usuario]"

**Estimación:** 1 hora

---

#### US-ACT-009: Toggle de Activity Messages en el frontend
**Como** agente
**Quiero** poder mostrar/ocultar los mensajes de actividad en el chat
**Para** no tener ruido visual cuando estoy atendiendo

**Criterios de aceptación:**
- Botón toggle en el header del chat
- Filtra visualmente mensajes con `message_type === 'activity'`
- No afecta WebSocket ni broadcast, solo la vista
- El estado del toggle persiste en la sesión del usuario

**Estimación:** 2-3 horas

---

### Resumen Módulo 1
| Historia | Estimación |
|----------|-----------|
| US-ACT-001: Infraestructura base | 3-4h |
| US-ACT-002: Handler Escalación | 1-2h |
| US-ACT-003: Handler Labels | 1-2h |
| US-ACT-004: Handler Stage | 1h |
| US-ACT-005: Handler Status | 1h |
| US-ACT-006: Handler Temperatura | 1h |
| US-ACT-007: Handler Asignación | 1-2h |
| US-ACT-008: Handler Prioridad | 1h |
| US-ACT-009: Toggle frontend | 2-3h |
| **Total** | **12-17h** |

---

## Módulo 2: Toggle de Reminders (n8n)

### Contexto
Cada tenant tiene un `n8n_reminder_workflow_id`. La API de n8n soporta `PATCH /workflows/{id}` con `{ "active": true/false }` para activar/desactivar workflows. Se necesita exponer esto en la página de recordatorios.

### Historias de Usuario

#### US-REM-001: Endpoint para consultar estado del workflow de reminders
**Como** admin del tenant
**Quiero** ver si los reminders están activos o no
**Para** saber el estado actual antes de hacer cambios

**Criterios de aceptación:**
- `GET /api/v1/reminders/workflow-status` → llama `GET /workflows/{id}` a n8n
- Retorna `{ "active": true/false, "workflow_id": "..." }`
- Si el tenant no tiene workflow_id configurado → retorna error descriptivo

**Estimación:** 2 horas

---

#### US-REM-002: Endpoint para activar/desactivar workflow de reminders
**Como** admin del tenant
**Quiero** poder activar o desactivar los reminders desde la web
**Para** no depender de acceso directo a n8n

**Criterios de aceptación:**
- `PATCH /api/v1/reminders/workflow-status` con `{ "active": true/false }`
- Llama `PATCH /workflows/{id}` a n8n con el campo `active`
- Valida que el tenant tenga `n8n_reminder_workflow_id`
- Retorna estado actualizado

**Estimación:** 2 horas

---

#### US-REM-003: Toggle UI en página de recordatorios
**Como** admin del tenant
**Quiero** un switch visual en la página de recordatorios
**Para** activar/desactivar fácilmente

**Criterios de aceptación:**
- Switch component en la página de reminders
- Al cargar la página, consulta el estado actual
- Al hacer toggle, llama al endpoint y actualiza el UI
- Feedback visual (loading, success, error con toast)

**Estimación:** 2-3 horas

---

### Resumen Módulo 2
| Historia | Estimación |
|----------|-----------|
| US-REM-001: GET estado workflow | 2h |
| US-REM-002: PATCH activar/desactivar | 2h |
| US-REM-003: Toggle UI | 2-3h |
| **Total** | **6-7h** |

---

## Módulo 3: KPI Tasa de Conversión

### Contexto
El campo `messaging_conversation_id` ya existe en `orders` pero no está poblado para órdenes históricas. El teléfono del cliente no se guarda en nuestra tabla orders, hay que consultarlo a Shopify. La métrica es: `orders con conversation_id y validado=true` ÷ `conversaciones totales` × 100.

### Historias de Usuario

#### US-CONV-001: Script de backfill para vincular órdenes con conversaciones
**Como** plataforma
**Quiero** poblar `messaging_conversation_id` en órdenes existentes
**Para** tener datos históricos para la métrica

**Criterios de aceptación:**
- Script que recorre órdenes con `messaging_conversation_id = NULL`
- Para cada orden, consulta Shopify API con `shopify_order_id` o `shopify_draft_order_id` para obtener teléfono del cliente
- Busca en messaging si existe contacto con ese teléfono para el tenant
- Si existe conversación y `conversation.created_at < order.created_at` → asigna `messaging_conversation_id`
- Logging de progreso y errores
- Rate limiting para no exceder límites de Shopify API

**Estimación:** 4-6 horas

---

#### US-CONV-002: Vincular conversación automáticamente en webhook de Shopify
**Como** plataforma
**Quiero** que cuando entre un pedido nuevo de Shopify, se busque automáticamente la conversación previa
**Para** mantener la métrica actualizada sin intervención manual

**Criterios de aceptación:**
- Al recibir pedido de Shopify, extraer teléfono del cliente del payload
- Buscar conversación en messaging para el tenant con ese teléfono
- Si existe y `conversation.created_at < order.created_at` → guardar `messaging_conversation_id`
- Si no existe conversación → dejar NULL (no es conversión)

**Estimación:** 3-4 horas

---

#### US-CONV-003: Endpoint de conteo de conversaciones por periodo
**Como** dashboard
**Quiero** obtener el total de conversaciones de un tenant en un rango de fechas
**Para** calcular el denominador de la tasa de conversión

**Criterios de aceptación:**
- Nuevo endpoint en messaging: `GET /api/v1/analytics/conversations_count?start_date=X&end_date=Y`
- Retorna `{ "total": N }` filtrando por `tenant/account` y rango de `created_at`
- Backend hace proxy de este endpoint

**Estimación:** 2-3 horas

---

#### US-CONV-004: StatsCard de Tasa de Conversión en dashboard
**Como** admin del tenant
**Quiero** ver la tasa de conversión del agente IA en el dashboard
**Para** medir el impacto del agente en las ventas

**Criterios de aceptación:**
- Nuevo StatsCard en el dashboard
- Muestra: porcentaje de conversión, número de conversiones, total de conversaciones
- Filtrable por el periodo existente (today, last_7_days, last_30_days, etc.)
- Fórmula: `orders con messaging_conversation_id != NULL y validado = true (en periodo)` ÷ `conversaciones totales (en periodo)` × 100

**Estimación:** 3-4 horas

---

### Resumen Módulo 3
| Historia | Estimación |
|----------|-----------|
| US-CONV-001: Script backfill | 4-6h |
| US-CONV-002: Vinculación en webhook | 3-4h |
| US-CONV-003: Endpoint conversaciones | 2-3h |
| US-CONV-004: StatsCard dashboard | 3-4h |
| **Total** | **12-17h** |

---

## Módulo 4: KPI Motivo de No Compra

### Contexto
Se necesita un campo para registrar por qué una conversación no resultó en compra. Se guarda en `custom_attributes` JSONB de conversations en messaging. No se toca frontend por ahora, solo backend.

### Historias de Usuario

#### US-NPC-001: Endpoint de agregación de motivos de no compra
**Como** dashboard
**Quiero** obtener los motivos de no compra agrupados con conteos
**Para** mostrar métricas de por qué no se cierran ventas

**Criterios de aceptación:**
- Nuevo endpoint en messaging: `GET /api/v1/analytics/no_purchase_reasons?start_date=X&end_date=Y`
- Query: agrupa `custom_attributes->>'no_purchase_reason'` donde no es NULL, en el rango de fechas
- Retorna: `{ "Precio alto": 15, "Sin stock": 8, "No respondió": 22 }`
- Filtra por account/tenant

**Estimación:** 2-3 horas

---

#### US-NPC-002: Proxy en backend para motivos de no compra
**Como** frontend
**Quiero** consumir los motivos de no compra desde el backend
**Para** mantener la arquitectura frontend → backend → messaging

**Criterios de aceptación:**
- `GET /api/v1/analytics/no-purchase-reasons?start_date=X&end_date=Y`
- Hace proxy al endpoint de messaging
- Respeta permisos y tenant del usuario

**Estimación:** 1-2 horas

---

### Resumen Módulo 4
| Historia | Estimación |
|----------|-----------|
| US-NPC-001: Endpoint messaging | 2-3h |
| US-NPC-002: Proxy backend | 1-2h |
| **Total** | **3-5h** |

---

## Módulo 5: Creación de Plantillas de Meta

### Contexto
La API de Meta permite crear templates via `POST /{waba_id}/message_templates`. Ya tenemos `sync_templates()` que lee templates aprobados. Se necesita el CRUD completo + UI de gestión. Se soportan todos los tipos que permite Meta.

### Historias de Usuario

#### US-TPL-001: Endpoint para crear template en Meta
**Como** admin del tenant
**Quiero** crear plantillas de WhatsApp desde la plataforma
**Para** no tener que ir al Business Manager de Meta

**Criterios de aceptación:**
- `POST /api/v1/whatsapp/templates` en messaging
- Acepta: name, category (MARKETING, UTILITY), language, components (HEADER, BODY, FOOTER, BUTTONS)
- Header soporta: TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION
- Body soporta variables `{{1}}`, `{{2}}`
- Botones soporta: URL, QUICK_REPLY, PHONE_NUMBER, COPY_CODE
- Llama `POST /{waba_id}/message_templates` a Meta Graph API
- Retorna respuesta de Meta (id, status: PENDING)
- Hace re-sync automático después de crear

**Estimación:** 4-6 horas

---

#### US-TPL-002: Endpoint para listar templates del canal
**Como** admin del tenant
**Quiero** ver todas mis plantillas con su estado actual
**Para** saber cuáles están aprobadas, pendientes o rechazadas

**Criterios de aceptación:**
- `GET /api/v1/whatsapp/templates` en messaging
- Lee de `channel_whatsapp.message_templates` JSONB
- Retorna: name, status (APPROVED, PENDING, REJECTED), category, language, components
- Filtrable por status

**Estimación:** 2 horas

---

#### US-TPL-003: Endpoint de re-sync manual de templates
**Como** admin del tenant
**Quiero** re-sincronizar templates desde Meta
**Para** ver si mis plantillas pendientes ya fueron aprobadas o rechazadas

**Criterios de aceptación:**
- `POST /api/v1/whatsapp/templates/sync` en messaging
- Llama `sync_templates()` existente
- Retorna lista actualizada de templates

**Estimación:** 1-2 horas

---

#### US-TPL-004: Endpoint para eliminar template en Meta
**Como** admin del tenant
**Quiero** eliminar plantillas que ya no necesito
**Para** mantener limpio mi catálogo de templates

**Criterios de aceptación:**
- `DELETE /api/v1/whatsapp/templates/:name` en messaging
- Llama `DELETE /{waba_id}/message_templates?name=X` a Meta
- Re-sync después de eliminar

**Estimación:** 1-2 horas

---

#### US-TPL-005: Proxy endpoints de templates en backend
**Como** frontend
**Quiero** consumir los endpoints de templates desde el backend
**Para** mantener la arquitectura consistente

**Criterios de aceptación:**
- Proxy de los 4 endpoints (create, list, sync, delete)
- Validación de permisos (ADMIN)
- Filtro por tenant

**Estimación:** 2-3 horas

---

#### US-TPL-006: UI de gestión de plantillas
**Como** admin del tenant
**Quiero** una página para crear y gestionar mis plantillas de WhatsApp
**Para** tener control visual sobre mis templates

**Criterios de aceptación:**
- Página `/dashboard/whatsapp-templates` (o dentro de la sección existente)
- Lista de templates con status (badge de color: verde=approved, amarillo=pending, rojo=rejected)
- Botón "Crear Plantilla" → formulario dinámico:
  - Nombre, categoría (dropdown), idioma (dropdown)
  - Header: selector de tipo (texto/imagen/video/documento/ubicación) + input correspondiente
  - Body: textarea con botón para insertar variables `{{N}}`
  - Footer: input de texto
  - Botones: agregar hasta 3 botones con tipo y valor
- Preview de cómo se verá el mensaje
- Botón "Sincronizar" para re-sync
- Acción de eliminar por template

**Estimación:** 10-14 horas

---

### Resumen Módulo 5
| Historia | Estimación |
|----------|-----------|
| US-TPL-001: Crear template | 4-6h |
| US-TPL-002: Listar templates | 2h |
| US-TPL-003: Re-sync | 1-2h |
| US-TPL-004: Eliminar template | 1-2h |
| US-TPL-005: Proxy backend | 2-3h |
| US-TPL-006: UI gestión | 10-14h |
| **Total** | **20-29h** |

---

## Módulo 6: Campañas Masivas

### Contexto
Ya existe el modelo Campaign, TriggerService y TriggerJob en messaging. Los gaps principales son: trigger síncrono (debería ser async), no hay envío programado (cron), no hay importación CSV, y no hay UI en el frontend de VentIA.

### Historias de Usuario

#### US-CMP-001: Corregir trigger de campaña a async
**Como** plataforma
**Quiero** que el trigger de campañas use Sidekiq en vez de ejecución síncrona
**Para** no bloquear el request HTTP en campañas grandes

**Criterios de aceptación:**
- Controller llama `Campaigns::TriggerJob.perform_later(campaign.id)` en vez de ejecutar síncrono
- Campaign se marca como `triggered` inmediatamente
- El job ejecuta `TriggerService` en background

**Estimación:** 1-2 horas

---

#### US-CMP-002: Cron job para envío programado
**Como** admin del tenant
**Quiero** programar una campaña para que se envíe a una hora específica
**Para** enviar campañas en el momento óptimo (ej: 8pm)

**Criterios de aceptación:**
- Job recurrente cada 5 minutos (Sidekiq-cron o similar)
- Busca campañas activas con `scheduled_at <= Time.current` y `triggered_at = NULL`
- Encola `Campaigns::TriggerJob` para cada una
- Campo `scheduled_at` ya existe en el modelo

**Estimación:** 2-3 horas

---

#### US-CMP-003: Importación de contactos por CSV
**Como** admin del tenant
**Quiero** importar una lista de contactos desde un archivo CSV
**Para** crear audiencias de campaña rápidamente

**Criterios de aceptación:**
- Endpoint en messaging: `POST /api/v1/contacts/import` con archivo CSV
- Columnas soportadas: `name`, `phone_number`, `email`
- Crea contactos nuevos, detecta duplicados por `phone_number`
- Asigna label automáticamente (recibido como parámetro)
- Retorna: cantidad importados, duplicados, rechazados (sin teléfono)
- Procesamiento async via job para archivos grandes

**Estimación:** 4-6 horas

---

#### US-CMP-004: Template con variables dinámicas desde CSV
**Como** admin del tenant
**Quiero** que al subir un CSV con columnas de variables, se reemplacen en el template
**Para** personalizar mensajes masivos (ej: "Hola {{1}}, tu pedido {{2}}")

**Criterios de aceptación:**
- Al seleccionar template, detectar variables del body (`{{1}}`, `{{2}}`, etc.)
- Validar que el CSV tenga columnas: `phone_number` + `var_1`, `var_2`, etc.
- Si falta columna → error: "Falta la columna para la variable {{N}}"
- Al enviar, cada contacto recibe el template con sus variables personalizadas
- Modificar `TriggerService` para inyectar variables por contacto

**Estimación:** 5-7 horas

---

#### US-CMP-005: Proxy endpoints de campañas en backend
**Como** frontend
**Quiero** consumir campañas desde el backend
**Para** mantener la arquitectura consistente

**Criterios de aceptación:**
- Proxy de: create, list, trigger, pause, resume, delete
- Proxy de importación CSV
- Validación de permisos (ADMIN)

**Estimación:** 3-4 horas

---

#### US-CMP-006: UI de creación y gestión de campañas
**Como** admin del tenant
**Quiero** crear y gestionar campañas masivas desde la web
**Para** enviar comunicaciones a mis clientes

**Criterios de aceptación:**
- Página `/dashboard/campaigns` (ya existe la ruta)
- Lista de campañas con: título, status, fecha programada, inbox
- Formulario de creación:
  - Título de campaña
  - Seleccionar inbox (WhatsApp)
  - Seleccionar template → muestra preview con variables
  - Inputs para variables (envío manual) o subir CSV (envío masivo)
  - Seleccionar audiencia por labels (multi-select)
  - Programar fecha y hora de envío
- Acciones: pausar, reanudar, ver progreso (conversaciones creadas)

**Estimación:** 12-16 horas

---

### Resumen Módulo 6
| Historia | Estimación |
|----------|-----------|
| US-CMP-001: Trigger async | 1-2h |
| US-CMP-002: Cron job programado | 2-3h |
| US-CMP-003: Import CSV | 4-6h |
| US-CMP-004: Variables dinámicas CSV | 5-7h |
| US-CMP-005: Proxy backend | 3-4h |
| US-CMP-006: UI campañas | 12-16h |
| **Total** | **27-38h** |

---

## Resumen General

| Módulo | Estimación | Prioridad |
|--------|-----------|-----------|
| 1. Activity Messages | 12-17h | Alta |
| 2. Toggle Reminders | 6-7h | Alta |
| 3. KPI Tasa Conversión | 12-17h | Alta |
| 4. KPI Motivo No Compra | 3-5h | Alta |
| 5. Plantillas Meta | 20-29h | Alta |
| 6. Campañas Masivas | 27-38h | Alta |
| **Total** | **80-113h** |  |

**Nota:** Las estimaciones son de desarrollo puro (código + tests básicos). No incluyen: QA exhaustivo, deploy, documentación, ni reuniones de alineación.
