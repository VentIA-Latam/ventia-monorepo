# Chatwoot → Ventia Messaging: Migracion de Datos

## Contexto

Ventia reemplaza Chatwoot con un servicio de messaging propio (Rails). Necesitamos migrar el historial completo de conversaciones, mensajes, contactos y archivos de Chatwoot a nuestro messaging service.

### Fases del proyecto

- **Fase 1 (30 mar)**: Provisioning MV agentes AI con datos de prueba
- **Fase 2 (31 mar - 4 abr)**: Validacion equipo AI
- **Fase 3 (7 abr)**: Migracion a produccion
- **Fase 4 (14 abr)**: Decommission Chatwoot

## Datos de origen (Chatwoot DB)

### Accounts existentes

| ID | Nombre | Descripcion |
|----|--------|-------------|
| 4 | Ventia 4 | Tenant de prueba (ejemplo de migracion) |
| 18 | Nassau Collection | Cliente real |
| 19 | La Dore | Cliente real |
| 23 | Lucano | Cliente real |
| 24 | Not Pepper | Cliente real |

### Account 4 (ejemplo de migracion)

- **User**: id=2, "Equipo VentIA", role=administrator
- **Inbox**: id=18, "Ventia 4 Test", WhatsApp Cloud, phone=+51982675035
- **Channel**: id=12, whatsapp_cloud
- **Conversaciones**: 9
- **Contactos**: 9
- **Mensajes**: ~277 totales

## Mapeo de schemas

### Tablas a migrar (en orden de dependencia FK)

| # | Tabla Chatwoot | Tabla Messaging | Notas |
|---|----------------|-----------------|-------|
| 1 | accounts | accounts | Agregar `ventia_tenant_id` |
| 2 | users | users | Agregar `ventia_user_id`, sin campos auth |
| 3 | account_users | account_users | Agregar rol `superadmin` (2) |
| 4 | channel_whatsapp | channel_whatsapp | Misma estructura |
| 5 | inboxes | inboxes | Misma estructura |
| 6 | contacts | contacts | Misma estructura |
| 7 | contact_inboxes | contact_inboxes | Misma estructura |
| 8 | conversations | conversations | Campos nuevos: ai_agent_enabled, temperature, stage |
| 9 | messages | messages | Misma estructura base |
| 10 | labels | labels | Agregar campo `system` |
| 11 | conversation_labels | conversation_labels | Misma estructura |
| 12 | attachments | attachments | Solo metadata |
| 13 | active_storage_blobs | active_storage_blobs | Para archivos |
| 14 | active_storage_attachments | active_storage_attachments | Referencias blob→attachment |

### Diferencias de schema

| Campo | Chatwoot | Messaging | Solucion |
|-------|----------|-----------|----------|
| PKs | integer (serial) | bigint (serial) | Compatible, insertar con IDs explicitos |
| accounts.ventia_tenant_id | no existe | integer, required | Del config JSON |
| users.ventia_user_id | no existe | integer, required | Del user_mappings en config |
| users (auth fields) | encrypted_password, tokens, etc | no existen | Ignorar |
| conversations.display_id | existe | no existe | Ignorar |
| conversations.cached_label_list | existe | no existe | Ignorar |
| conversations.sla_policy_id | existe | no existe | Ignorar |
| conversations.ai_agent_enabled | no existe | boolean | Default `true` |
| conversations.temperature | no existe | integer | Default `null` |
| conversations.stage | no existe | integer | Default `0` (pre_sale) |
| labels.system | no existe | boolean | Default `false` |

### Roles en account_users

| Valor | Chatwoot | Messaging |
|-------|----------|-----------|
| 0 | agent | agent |
| 1 | administrator | administrator |
| 2 | — | superadmin (nuevo) |

## Storage de archivos

### Como funciona

- Ambos usan **Rails Active Storage**
- Chatwoot produccion: **disco local** del container (`Rails.root.join("storage")`)
- Ventia messaging: **Google Cloud Storage** en produccion, **disco local** en desarrollo
- Chatwoot **descarga** las imagenes/audios de WhatsApp y las guarda localmente (no usa URLs externas)

### Tablas de Active Storage

| Tabla | Contenido |
|-------|-----------|
| `active_storage_blobs` | Metadata del archivo (key, filename, content_type, byte_size, checksum) |
| `active_storage_attachments` | Vincula blob con record (attachment model) |

### Migracion de archivos

1. Migrar registros de `active_storage_blobs` y `active_storage_attachments` en la BD
2. Copiar directorio `storage/` del container de Chatwoot al de Messaging
3. Los archivos se organizan por el hash del blob key

## Formato del script

### Jupyter Notebook

Archivo: `apps/backend/scripts/migrate-chatwoot.ipynb`

Ventajas:
- Ejecutar celda por celda para verificar cada paso
- Ver resultados intermedios (counts, samples)
- Facil de debuggear si algo falla
- Reutilizable para Fase 1 (prueba) y Fase 3 (produccion)

### Config JSON

```json
{
  "chatwoot_db": "postgresql://postgres:password@localhost:5432/chatwoot",
  "messaging_db": "postgresql://postgres:messaging_password@localhost:5433/messaging_db",
  "migrations": [
    {
      "chatwoot_account_id": 4,
      "ventia_tenant_id": 2,
      "description": "Ventia 4 Test -> Nassau",
      "user_mappings": {
        "2": 1
      }
    }
  ]
}
```

- `chatwoot_db`: Connection string a la BD de Chatwoot
- `messaging_db`: Connection string a la BD de Messaging
- `migrations[]`: Lista de accounts a migrar
  - `chatwoot_account_id`: ID del account en Chatwoot
  - `ventia_tenant_id`: ID del tenant en Ventia
  - `user_mappings`: Chatwoot user_id → Ventia user_id

### Celdas del Notebook

| # | Celda | Descripcion |
|---|-------|-------------|
| 1 | Config + Conexion | Lee JSON, conecta a ambas BDs |
| 2 | Validacion | Verifica accounts/tenants existen |
| 3 | Migrar accounts | Crea account con ventia_tenant_id |
| 4 | Migrar users + account_users | Con ventia_user_id y roles |
| 5 | Migrar channel_whatsapp | Canal WhatsApp con config |
| 6 | Migrar inboxes | Inbox vinculado al channel |
| 7 | Migrar contacts | Contactos del account |
| 8 | Migrar contact_inboxes | Vinculos contacto-inbox |
| 9 | Migrar conversations | Con ai_agent_enabled, temperature, stage |
| 10 | Migrar messages | Con sender_type/sender_id |
| 11 | Migrar labels + conversation_labels | Labels del account |
| 12 | Migrar attachments | Metadata |
| 13 | Migrar active_storage | Blobs + attachment references |
| 14 | Copiar archivos | Genera comando docker cp |
| 15 | Verificacion | Counts comparativos |

### Manejo de IDs

- Si messaging DB esta vacia: insertar con IDs originales de Chatwoot
- Si ya hay datos: usar un offset para evitar colisiones (ej: offset=10000)
- El notebook calcula el offset automaticamente basado en max(id) de cada tabla

## Verificacion post-migracion

1. Counts coinciden entre Chatwoot y Messaging
2. Conversaciones visibles en el frontend de Ventia
3. Mensajes con contenido correcto y timestamps
4. Archivos adjuntos se visualizan (imagenes, audios)
5. WebSocket conecta y muestra datos en tiempo real
6. Contactos con nombre y telefono correctos
