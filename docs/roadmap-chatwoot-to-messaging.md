# Roadmap: Migracion de Chatwoot a Ventia Messaging

## Contexto

Los clientes de VentIA usan Chatwoot para gestionar conversaciones de WhatsApp. Se construyo un modulo propio (Ventia Messaging) mas apegado al caso de uso de VentIA. La migracion es progresiva (marca por marca), sin downtime. Chatwoot y Messaging nunca corren al mismo tiempo para la misma marca.

```
Marca X en Chatwoot
    |  1. Importar historial → Messaging DB (marca sigue en Chatwoot)
    |  2. Cambiar webhook WhatsApp → Messaging (~5s de corte)
    |  3. Agregar tenant_id al array del front + deploy
    v
Marca X en Messaging (Chatwoot ya no recibe nada)
```

---

## 1. Versus de Modelos de Datos

### Conversations

| Campo | Chatwoot | Ventia Messaging | Estado |
|-------|----------|-----------------|--------|
| ID | integer | UUID | Mapping necesario al migrar |
| Tenant | `account_id` | `account_id` → `ventia_tenant_id` | Compatible |
| Canal | `inbox_id` | `inbox_id` | Compatible |
| Contacto | `contact_id` | `contact_id` | Compatible |
| Agente | `assignee_id` | `assignee_id` | Compatible |
| Equipo | `team_id` | `team_id` | Compatible |
| Status | open/resolved/pending/snoozed | Mismo enum AASM | Compatible |
| Prioridad | low/medium/high/urgent | Mismo enum | Compatible |
| Display ID | auto DB trigger | Mismo mecanismo | Compatible |
| Custom attrs | `custom_attributes` jsonb | **No tiene** | BRECHA — agregar campo |
| Labels | acts_as_taggable + cached_label_list | `conversation_labels` join table | Compatible (distinta impl) |
| Last activity | `last_activity_at` | `last_activity_at` | Compatible |
| First reply | `first_reply_created_at` | No tiene | BRECHA — agregar si se necesitan metricas SLA |
| Waiting since | `waiting_since` | No tiene | BRECHA |
| Campaign | `campaign_id` | `campaign_id` | Compatible |

### Messages

| Campo | Chatwoot | Ventia Messaging | Estado |
|-------|----------|-----------------|--------|
| ID | integer | UUID | Mapping necesario |
| Tipo | incoming/outgoing/activity/template | Mismo enum | Compatible |
| Content type | 12+ tipos | Mismo enum | Compatible |
| Status | sent/delivered/read/failed | Mismo enum | Compatible |
| Content | text (max 150K) | text | Compatible |
| Private | boolean | boolean | Compatible |
| Sender | polymorphic (User/Contact/AgentBot) | polymorphic (User/Contact) | AgentBot no soportado como sender |
| Source ID | `source_id` (WhatsApp msg ID) | `source_id` | Compatible |
| Attachments | has_many | has_many | Compatible |
| Sentiment | jsonb | No tiene | No migrar, no critico |

### Contacts

| Campo | Chatwoot | Ventia Messaging | Estado |
|-------|----------|-----------------|--------|
| ID | integer | UUID | Mapping necesario |
| Name | name + middle + last | name + middle + last | Compatible |
| Email | unique per account | unique per account | Compatible |
| Phone | phone_number | phone_number | Compatible |
| Identifier | unique per account | unique per account | Compatible |
| Type | visitor/lead/customer | visitor/lead/customer | Compatible |
| Custom attrs | jsonb | jsonb | Compatible |
| Blocked | boolean | boolean | Compatible |

### Brechas a Resolver Antes de Migrar

| Brecha | Prioridad | Solucion |
|--------|-----------|----------|
| `custom_attributes` en conversations | **Alta** | Agregar campo jsonb a conversations en Messaging |
| `first_reply_created_at` | Media | Agregar si se quieren metricas SLA |
| `waiting_since` | Media | Agregar si se quieren metricas SLA |
| Working hours en inboxes | Baja | Agregar solo si algun cliente lo usa |
| AgentBot como sender | Baja | Verificar si aplica en flujos actuales |

---

## 2. Feature Flag en Frontend (sin tocar backend/DB)

El control de que marca usa Chatwoot vs Messaging se hace con un array en el front:

```typescript
// lib/config/messaging-migration.ts
export const MESSAGING_TENANT_IDS: number[] = [
  // Agregar tenant_id conforme se migran
  // 5,  // marca piloto
];

export function usesVentiaMessaging(tenantId: number): boolean {
  return MESSAGING_TENANT_IDS.includes(tenantId);
}
```

El componente de conversaciones decide:

```
app/dashboard/conversations/
├── page.tsx              # Lee tenant_id del user → decide cual renderizar
├── chatwoot-view.tsx     # Embed de Chatwoot (ya existe)
└── messaging-view.tsx    # Nuevo UI conectado a Messaging API
```

Cuando TODOS los tenants esten migrados, se elimina el array, el chatwoot-view, y queda solo messaging-view.

---

## 3. Plan de Migracion por Fases

### Fase 0: Preparacion

**Infra & Deploy**
- [ ] Deploy de Messaging en produccion (Docker: Rails + Sidekiq + PostgreSQL + Redis)
- [ ] Dominio/SSL (ej: `messaging.ventia-latam.com` o subpath)
- [ ] Health check funcional
- [ ] Redis: configurar maxmemory y eviction policy
- [ ] Monitoreo basico (logs, uptime)

**Brechas de Modelo**
- [ ] Agregar `custom_attributes` jsonb a conversations en Messaging
- [ ] Decidir campos SLA (`first_reply_created_at`, `waiting_since`)
- [ ] Correr migraciones en produccion

**Script de Migracion de Datos**
- [ ] Script que exporta de `chatwoot_db` por account_id:
  - conversations + messages + contacts + contact_inboxes + attachments + labels + taggings
- [ ] Script que importa a `messaging_db`:
  - Crear UUIDs nuevos
  - Mantener mapping `chatwoot_id → messaging_uuid` en archivo JSON
  - Mapear contacts por phone_number/email (dedup)
  - Importar attachments (copiar archivos si estan en storage local)
- [ ] Test del script en entorno dev con data real

**Frontend Dual-Mode**
- [ ] Crear `lib/config/messaging-migration.ts` con el array vacio
- [ ] Modificar page.tsx de conversaciones para leer el flag
- [ ] Crear `messaging-view.tsx` (placeholder o version funcional)
- [ ] Verificar build OK

### Fase 1: Piloto (1 marca de bajo volumen)

- [ ] Seleccionar marca piloto
- [ ] Crear account en Messaging (`ventia_tenant_id` = tenant.id de la marca)
- [ ] Sincronizar usuarios del tenant → users en Messaging
- [ ] Crear inbox WhatsApp en Messaging con credenciales de la marca
- [ ] Ejecutar script de migracion de historial (Chatwoot → Messaging)
- [ ] Verificar datos: contar conversations, messages, contacts
- [ ] **Dia de corte:**
  1. Cambiar webhook de Meta WhatsApp → endpoint de Messaging
  2. Agregar tenant_id al array `MESSAGING_TENANT_IDS`
  3. Deploy frontend
- [ ] Actualizar workflow de n8n de la marca (si tiene reminders) → apuntar a Messaging API
- [ ] Test E2E:
  - Enviar mensaje desde WhatsApp → llega a Messaging
  - Responder desde dashboard → llega a WhatsApp
  - Asignar agente
  - Resolver conversacion
  - WebSocket: mensajes en vivo
  - Ver historial migrado
- [ ] Monitorear 1-2 semanas

### Fase 2: Migracion por lotes

- [ ] Migrar 2-3 marcas mas (bajo-medio volumen)
- [ ] Corregir issues de Fase 1
- [ ] Migrar marcas de alto volumen
- [ ] Cada marca sigue el checklist de Fase 1

### Fase 3: Decommission Chatwoot

- [ ] Verificar TODAS las marcas en Messaging
- [ ] Backup final completo de `chatwoot_db`
- [ ] Eliminar del frontend:
  - `chatwoot-view.tsx` y componentes Chatwoot
  - `lib/api-client/chatwoot.ts`
  - `lib/types/chatwoot.ts`
  - API routes de Chatwoot (`app/api/chatwoot/`)
  - Array `MESSAGING_TENANT_IDS` (ya no necesario)
- [ ] Eliminar del backend:
  - Endpoints de Chatwoot
  - Servicio de Chatwoot
  - Config de Chatwoot en `.env`
- [ ] Apagar instancia de Chatwoot en produccion
- [ ] Mantener backup de `chatwoot_db` por 6 meses (por si acaso)

---

## 4. Checklist por Marca

```
[ ] 1. Crear account en Messaging (ventia_tenant_id = tenant.id)
[ ] 2. Sincronizar usuarios → Messaging
[ ] 3. Crear inbox WhatsApp con credenciales
[ ] 4. Ejecutar script de migracion de historial
[ ] 5. Verificar datos importados (counts)
[ ] 6. Cambiar webhook WhatsApp → Messaging (CORTE ~5s)
[ ] 7. Agregar tenant_id al array del front + deploy
[ ] 8. Actualizar n8n workflows si aplica
[ ] 9. Test E2E (enviar, recibir, asignar, resolver, historial)
[ ] 10. Monitorear 48h
[ ] 11. Marcar como migrado
```

---

## 5. Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|--------|------------|
| Mensajes en vuelo durante cambio de webhook (~5s) | Aceptar perdida minima, hacer el cambio en horario bajo |
| Script de migracion falla a mitad | Hacer la migracion idempotente (re-ejecutable), testear en dev primero |
| n8n workflows no se actualizan | Checklist explicito por marca, verificar antes del corte |
| WebSocket inestable con carga real | Load test en staging antes de migrar marcas grandes |
| Attachments no se migran | Copiar archivos de storage + actualizar URLs en registros |
| Rollback necesario | Revertir webhook a Chatwoot + quitar tenant del array (< 5 min) |

---

## 6. Preguntas Abiertas

1. **Donde se despliega Messaging?** Mismo servidor o separado?
2. **Dominio?** `messaging.ventia-latam.com` o subpath?
3. **Attachments de Chatwoot**: estan en S3 o storage local?
4. **Cuantas marcas hay en total?** Para estimar timeline
5. **Hay marcas que usen features avanzados de Chatwoot?** (automations, CSAT, bots) — verificar cobertura
6. **Horario de migracion preferido?** (madrugada, fin de semana?)
