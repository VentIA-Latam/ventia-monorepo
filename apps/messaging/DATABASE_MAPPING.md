# Mapeo de Base de Datos: Ventia ↔ Messaging

## Estructura de Esquemas

```
ventia_db (PostgreSQL)
├── ventia (schema)          # App principal de Ventia
│   ├── tenants              # Empresas clientes
│   ├── users                # Usuarios de Ventia
│   ├── orders               # Pedidos de ecommerce
│   └── shopify_stores       # Tiendas conectadas
│
└── messaging (schema)       # Servicio de mensajería
    ├── accounts             # 1 Account = 1 Tenant de Ventia
    ├── inboxes              # Canales de comunicación
    ├── conversations        # Conversaciones
    ├── messages             # Mensajes individuales
    ├── contacts             # Contactos/clientes
    ├── channel_whatsapp     # Configuración WhatsApp
    ├── labels               # Etiquetas
    ├── campaigns            # Campañas masivas
    ├── automation_rules     # Reglas de automatización
    └── agent_bots           # Bots conversacionales
```

## Relación Entre Esquemas

### Ventia → Messaging (1:1)

```sql
-- Un tenant de Ventia = Una cuenta en Messaging
ventia.tenants.id (UUID) ←→ messaging.accounts.ventia_tenant_id (UUID)
```

**Ejemplo:**
```ruby
# Ventia tiene tenant: 123e4567-e89b-12d3-a456-426614174000
# Messaging crea account con:
Account.create!(
  ventia_tenant_id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Empresa Demo SAC"
)
```

### Contactos vs Clientes

```
messaging.contacts.phone_number ≈ ventia.orders.customer_phone
messaging.contacts.email ≈ ventia.orders.customer_email
```

**No hay FK directa**, pero puedes vincular por:
- **Phone**: `contacts.phone_number = orders.customer_phone`
- **Email**: `contacts.email = orders.customer_email`

## Queries Cross-Schema

### Obtener conversaciones de un tenant de Ventia

```sql
-- Desde PostgreSQL
SELECT
  c.id as conversation_id,
  c.status,
  cnt.name as contact_name,
  cnt.phone_number,
  t.name as tenant_name
FROM messaging.conversations c
JOIN messaging.contacts cnt ON c.contact_id = cnt.id
JOIN messaging.accounts a ON c.account_id = a.id
JOIN ventia.tenants t ON a.ventia_tenant_id = t.id
WHERE a.ventia_tenant_id = '123e4567-e89b-12d3-a456-426614174000';
```

### Desde FastAPI (Python)

```python
from sqlalchemy import text

async def get_tenant_conversations(tenant_id: UUID):
    query = text("""
        SELECT
            c.id,
            c.status,
            cnt.name,
            cnt.phone_number
        FROM messaging.conversations c
        JOIN messaging.contacts cnt ON c.contact_id = cnt.id
        JOIN messaging.accounts a ON c.account_id = a.id
        WHERE a.ventia_tenant_id = :tenant_id
    """)

    result = await db.execute(query, {"tenant_id": str(tenant_id)})
    return result.fetchall()
```

### Desde Rails (Ruby)

```ruby
# En app/models/account.rb
class Account < ApplicationRecord
  # ...

  def ventia_tenant
    # Query cross-schema
    ActiveRecord::Base.connection.exec_query(
      "SELECT * FROM ventia.tenants WHERE id = $1",
      "Ventia Tenant",
      [[nil, ventia_tenant_id]]
    ).first
  end
end
```

## Sincronización de Datos

### Opción 1: API Calls (Recomendado)

**Ventia Backend (FastAPI) → Messaging (Rails)**

```python
# Cuando se crea un tenant en Ventia
async def create_tenant(tenant_data):
    # 1. Crear tenant en ventia.tenants
    tenant = await create_ventia_tenant(tenant_data)

    # 2. Crear account en messaging
    async with httpx.AsyncClient() as client:
        await client.post(
            "http://messaging:3001/api/v1/accounts",
            json={
                "account": {
                    "name": tenant.name,
                    "ventia_tenant_id": str(tenant.id)
                }
            }
        )

    return tenant
```

### Opción 2: Database Triggers (Avanzado)

```sql
-- Crear función para sincronizar
CREATE OR REPLACE FUNCTION ventia.sync_tenant_to_messaging()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO messaging.accounts (ventia_tenant_id, name, created_at, updated_at)
    VALUES (NEW.id, NEW.name, NOW(), NOW())
    ON CONFLICT (ventia_tenant_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
CREATE TRIGGER tenant_to_messaging_trigger
AFTER INSERT ON ventia.tenants
FOR EACH ROW
EXECUTE FUNCTION ventia.sync_tenant_to_messaging();
```

### Opción 3: Background Jobs (Recomendado para bulk)

```python
# FastAPI job para sincronizar contactos
async def sync_order_contacts_to_messaging():
    orders = await get_recent_orders()

    for order in orders:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"http://messaging:3001/api/v1/contacts",
                headers={"X-Tenant-Id": str(order.tenant_id)},
                json={
                    "contact": {
                        "name": order.customer_name,
                        "email": order.customer_email,
                        "phone_number": order.customer_phone,
                        "contact_type": "customer",
                        "custom_attributes": {
                            "ventia_customer_id": order.customer_id,
                            "total_orders": order.customer_order_count
                        }
                    }
                }
            )
```

## Constraints y Consideraciones

### ❌ NO Soportado (PostgreSQL limita cross-schema FKs)

```sql
-- Esto NO funciona en PostgreSQL
ALTER TABLE messaging.accounts
ADD CONSTRAINT fk_ventia_tenant
FOREIGN KEY (ventia_tenant_id)
REFERENCES ventia.tenants(id);
-- Error: cross-schema FK no soportado
```

### ✅ Alternativa: Validación a Nivel Aplicación

```ruby
# En app/models/account.rb
class Account < ApplicationRecord
  validate :ventia_tenant_exists

  private

  def ventia_tenant_exists
    result = ActiveRecord::Base.connection.exec_query(
      "SELECT 1 FROM ventia.tenants WHERE id = $1",
      "Check Tenant",
      [[nil, ventia_tenant_id]]
    )

    if result.empty?
      errors.add(:ventia_tenant_id, "no existe en ventia.tenants")
    end
  end
end
```

## Migraciones

### Crear esquema messaging

```ruby
# db/migrate/20260205000001_create_messaging_schema.rb
class CreateMessagingSchema < ActiveRecord::Migration[7.2]
  def up
    execute "CREATE SCHEMA IF NOT EXISTS messaging"
  end

  def down
    execute "DROP SCHEMA IF EXISTS messaging CASCADE"
  end
end
```

### Migrar con Rails

```bash
# Crear migración
bundle exec rails generate migration AddFieldToAccounts

# Ejecutar migraciones
bundle exec rails db:migrate

# Rollback
bundle exec rails db:rollback
```

## Backups

### Backup completo (ambos esquemas)

```bash
pg_dump -h localhost -U postgres -d ventia_db > backup_completo.sql
```

### Backup solo messaging

```bash
pg_dump -h localhost -U postgres -d ventia_db -n messaging > backup_messaging.sql
```

### Restaurar

```bash
psql -h localhost -U postgres -d ventia_db < backup_messaging.sql
```

## Índices Recomendados

```sql
-- Para mejorar queries cross-schema
CREATE INDEX idx_accounts_ventia_tenant
ON messaging.accounts(ventia_tenant_id);

CREATE INDEX idx_conversations_account_status
ON messaging.conversations(account_id, status);

CREATE INDEX idx_messages_conversation_created
ON messaging.messages(conversation_id, created_at DESC);

CREATE INDEX idx_contacts_phone
ON messaging.contacts(phone_number);
```

## Resumen

| Aspecto | Estrategia |
|---------|-----------|
| **Vínculo principal** | `messaging.accounts.ventia_tenant_id = ventia.tenants.id` |
| **Sincronización** | API calls desde FastAPI a Rails |
| **Queries cross-schema** | SQL directo o API REST |
| **Integridad referencial** | Validación a nivel aplicación (no FK) |
| **Backups** | Mismo dump, esquemas separados |
| **Migrations** | Rails migrations para messaging schema |
