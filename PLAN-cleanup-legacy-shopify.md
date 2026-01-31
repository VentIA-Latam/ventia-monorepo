# Plan: Limpieza de Código Legacy de Shopify

## Contexto

El sistema está en desarrollo y se migró de columnas legacy de Shopify a un sistema unificado de settings JSON que soporta múltiples plataformas (Shopify + WooCommerce).

**No hay datos de producción**, por lo tanto podemos eliminar el código legacy completamente.

---

## Alcance de la Limpieza

### 1. Columnas Legacy en Modelo Tenant

**Archivo:** `app/models/tenant.py`

| Elemento | Líneas | Acción |
|----------|--------|--------|
| `shopify_store_url` | 62-66 | Eliminar columna |
| `_shopify_access_token_encrypted` | 67-71 | Eliminar columna |
| `shopify_api_version` | 72-77 | Eliminar columna |
| `shopify_access_token` property (getter) | 137-156 | Eliminar |
| `shopify_access_token` property (setter) | 158-172 | Eliminar |

---

### 2. ShopifyService (Reemplazado por EcommerceService)

**Archivo:** `app/services/shopify.py`

- **ELIMINAR ARCHIVO COMPLETO**
- Ya existe `EcommerceService` en `app/services/ecommerce.py` que lo reemplaza
- Soporta múltiples plataformas (Shopify + WooCommerce)

**Actualizar:** `app/services/__init__.py`
- Remover import y export de `ShopifyService` y `shopify_service`

---

### 3. Schemas de Tenant con Campos Legacy

**Archivo:** `app/schemas/tenant.py`

Eliminar de **TenantBase** (líneas 26-31):
- `shopify_store_url`
- `shopify_api_version`

Eliminar de **TenantCreate** (líneas 83-118):
- `shopify_store_url` (DUPLICADO - aparece 2 veces)
- `shopify_access_token` (DUPLICADO - aparece 2 veces)
- Validador `validate_shopify_url`

Eliminar de **TenantUpdate** (líneas 159-181):
- `shopify_store_url`
- `shopify_access_token`
- `shopify_api_version`
- Validador `validate_shopify_url`

Eliminar de **TenantResponse** (línea 197):
- `shopify_store_url`

Eliminar de **TenantWithToken** (líneas 236-238):
- `shopify_access_token`

---

### 4. Servicio de Tenant

**Archivo:** `app/services/tenant.py`

| Líneas | Cambio |
|--------|--------|
| 115-116 | Remover `shopify_store_url`, `shopify_api_version` de creación |
| 123 | Remover `tenant.shopify_access_token = ...` |
| 234-237 | Remover manejo especial de `shopify_access_token` en update |

---

### 5. Endpoint de Órdenes

**Archivo:** `app/api/v1/endpoints/orders.py`

| Línea | Cambio |
|-------|--------|
| 27 | Cambiar `from app.services import shopify_service` → `ecommerce_service` |
| 420 | Remover validación de `tenant.shopify_access_token` y `tenant.shopify_store_url` |
| 440 | Cambiar `shopify_service.validate_and_complete_order()` → `ecommerce_service.validate_order()` |

---

### 6. Endpoint de Tenants

**Archivo:** `app/api/v1/endpoints/tenants.py`

- Actualizar docstrings que mencionan `shopify_store_url`, `shopify_access_token`, `shopify_api_version`
- La documentación de los endpoints ya no debe mencionar campos de Shopify

---

### 7. Seed Script

**Archivo:** `scripts/seed.py`

- Remover asignaciones de campos legacy en los 5 tenants (líneas 54-56, 76-78, 96-98, 116-118, 136-138)
- Actualizar para usar `tenant.set_ecommerce_settings()` con el nuevo formato JSON

---

### 8. Migración de Base de Datos

**Nueva migración Alembic:**

```python
def upgrade():
    op.drop_column('tenants', 'shopify_store_url')
    op.drop_column('tenants', '_shopify_access_token_encrypted')
    op.drop_column('tenants', 'shopify_api_version')

def downgrade():
    # No downgrade - estamos en desarrollo
    pass
```

---

## Archivos a Modificar

| Archivo | Acción |
|---------|--------|
| `app/models/tenant.py` | Eliminar columnas y properties legacy |
| `app/services/shopify.py` | **ELIMINAR ARCHIVO** |
| `app/services/__init__.py` | Remover exports de ShopifyService |
| `app/services/tenant.py` | Remover uso de campos legacy |
| `app/schemas/tenant.py` | Remover campos legacy + limpiar duplicados |
| `app/api/v1/endpoints/orders.py` | Usar `ecommerce_service` |
| `app/api/v1/endpoints/tenants.py` | Actualizar documentación |
| `scripts/seed.py` | Usar nuevo formato de settings |
| `alembic/versions/` | Nueva migración |

---

## Orden de Ejecución

1. Crear migración Alembic para eliminar columnas legacy
2. Modificar `app/models/tenant.py` - eliminar columnas y properties
3. Modificar `app/schemas/tenant.py` - limpiar schemas y duplicados
4. Eliminar `app/services/shopify.py`
5. Actualizar `app/services/__init__.py`
6. Modificar `app/services/tenant.py`
7. Modificar `app/api/v1/endpoints/orders.py` - usar ecommerce_service
8. Actualizar `app/api/v1/endpoints/tenants.py`
9. Actualizar `scripts/seed.py`
10. Ejecutar linting, tests y verificar

---

## Verificación

```bash
# 1. Aplicar migración
uv run alembic upgrade head

# 2. Verificar linting
uv run ruff check .

# 3. Ejecutar tests
uv run pytest

# 4. Probar seed
uv run python scripts/seed.py

# 5. Verificar imports
uv run python -c "from app.services import ecommerce_service; print('OK')"
```

---

## NO Tocar

- `app/api/deps.py` - Las funciones `require_permission` y `require_role` están en uso activo
- `app/models/order.py` - Los campos `shopify_draft_order_id` y `shopify_order_id` son necesarios para órdenes
