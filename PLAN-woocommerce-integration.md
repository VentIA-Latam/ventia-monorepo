# Plan: Integración WooCommerce (Settings JSON Unificado)

## Resumen

Migrar configuración de e-commerce al campo `settings` JSON existente, soportando:
- Sin e-commerce
- Shopify
- WooCommerce
- Futuras plataformas (sin migraciones DB)

---

## Estructura de Settings

### JSON en Base de Datos

```json
// Tenant con Shopify
{
  "ecommerce": {
    "sync_on_validation": true,
    "shopify": {
      "store_url": "https://store.myshopify.com",
      "access_token_encrypted": "gAAAAABf...",
      "api_version": "2024-01"
    }
  }
}

// Tenant con WooCommerce
{
  "ecommerce": {
    "sync_on_validation": true,
    "woocommerce": {
      "store_url": "https://mystore.com",
      "consumer_key_encrypted": "gAAAAABf...",
      "consumer_secret_encrypted": "gAAAAABf..."
    }
  }
}

// Tenant sin e-commerce
{
  "ecommerce": {
    "sync_on_validation": false
  }
}
```

### Schemas Pydantic (Tipado Fuerte)

```python
# app/schemas/tenant_settings.py

from pydantic import BaseModel, Field, model_validator
from typing import Literal


class ShopifyCredentials(BaseModel):
    """Credenciales Shopify (descifradas en memoria)."""
    store_url: str = Field(..., description="URL de la tienda Shopify")
    access_token: str = Field(..., description="Token de acceso Admin API")
    api_version: str = Field("2024-01", description="Versión de API")


class WooCommerceCredentials(BaseModel):
    """Credenciales WooCommerce (descifradas en memoria)."""
    store_url: str = Field(..., description="URL de la tienda WooCommerce")
    consumer_key: str = Field(..., description="Consumer Key")
    consumer_secret: str = Field(..., description="Consumer Secret")


class EcommerceSettings(BaseModel):
    """
    Configuración de e-commerce.

    Solo una plataforma puede estar configurada a la vez.
    La plataforma activa se detecta por qué credentials existen.
    """
    sync_on_validation: bool = Field(
        True,
        description="Si true, validar pago sincroniza con e-commerce. Si false, solo actualiza fechas locales."
    )
    shopify: ShopifyCredentials | None = None
    woocommerce: WooCommerceCredentials | None = None

    @model_validator(mode='after')
    def validate_single_platform(self):
        """Validar que solo una plataforma esté configurada."""
        platforms = [self.shopify, self.woocommerce]
        configured = [p for p in platforms if p is not None]
        if len(configured) > 1:
            raise ValueError('Solo puede configurar una plataforma e-commerce a la vez')
        return self

    @property
    def platform(self) -> Literal["shopify", "woocommerce"] | None:
        """Plataforma activa (calculada)."""
        if self.shopify:
            return "shopify"
        if self.woocommerce:
            return "woocommerce"
        return None

    @property
    def has_ecommerce(self) -> bool:
        """True si hay alguna plataforma configurada."""
        return self.platform is not None


class TenantSettings(BaseModel):
    """Estructura completa de settings del tenant."""
    ecommerce: EcommerceSettings = Field(default_factory=EcommerceSettings)
    # Futuras secciones:
    # notifications: NotificationSettings | None = None
    # invoicing: InvoicingSettings | None = None
```

---

## Cambios Requeridos

### Fase 1: Schema de Settings

#### 1.1 Crear `app/schemas/tenant_settings.py`

Archivo nuevo con los schemas definidos arriba.

---

### Fase 2: Modelo Tenant

#### 2.1 Modificar `app/models/tenant.py`

```python
from app.schemas.tenant_settings import TenantSettings, EcommerceSettings

class Tenant(Base, TimestampMixin):
    # ... campos existentes se mantienen por ahora ...

    # Campos Shopify antiguos (deprecados, migrar a settings)
    shopify_store_url = Column(String, nullable=True)  # DEPRECADO
    _shopify_access_token_encrypted = Column(String, nullable=True)  # DEPRECADO
    shopify_api_version = Column(String, default="2024-01", nullable=True)  # DEPRECADO

    # Settings JSON (nuevo enfoque)
    settings = Column(JSON, nullable=True)

    def get_settings(self) -> TenantSettings:
        """
        Obtiene settings con credenciales descifradas.

        Soporta lectura híbrida:
        1. Si hay config en settings.ecommerce, usa eso
        2. Si no, lee de columnas legacy (shopify_*)
        """
        from app.core.encryption import encryption_service

        raw_settings = self.settings or {}
        ecommerce_raw = raw_settings.get("ecommerce", {})

        # Descifrar Shopify si existe en settings
        if shopify := ecommerce_raw.get("shopify"):
            if enc := shopify.get("access_token_encrypted"):
                try:
                    shopify["access_token"] = encryption_service.decrypt(enc)
                except Exception:
                    shopify["access_token"] = None
                del shopify["access_token_encrypted"]

        # Descifrar WooCommerce si existe
        if woo := ecommerce_raw.get("woocommerce"):
            if enc := woo.get("consumer_key_encrypted"):
                try:
                    woo["consumer_key"] = encryption_service.decrypt(enc)
                except Exception:
                    woo["consumer_key"] = None
                del woo["consumer_key_encrypted"]
            if enc := woo.get("consumer_secret_encrypted"):
                try:
                    woo["consumer_secret"] = encryption_service.decrypt(enc)
                except Exception:
                    woo["consumer_secret"] = None
                del woo["consumer_secret_encrypted"]

        # Fallback a columnas legacy si no hay ecommerce en settings
        if not ecommerce_raw.get("shopify") and not ecommerce_raw.get("woocommerce"):
            if self.shopify_store_url and self._shopify_access_token_encrypted:
                ecommerce_raw["shopify"] = {
                    "store_url": self.shopify_store_url,
                    "access_token": self.shopify_access_token,  # Property existente
                    "api_version": self.shopify_api_version or "2024-01",
                }
                ecommerce_raw.setdefault("sync_on_validation", True)

        return TenantSettings(ecommerce=EcommerceSettings.model_validate(ecommerce_raw))

    def set_ecommerce_settings(self, ecommerce: EcommerceSettings) -> None:
        """
        Guarda configuración de e-commerce cifrando credenciales.
        """
        from app.core.encryption import encryption_service

        data = ecommerce.model_dump(exclude_none=True)

        # Cifrar Shopify
        if shopify := data.get("shopify"):
            if token := shopify.pop("access_token", None):
                shopify["access_token_encrypted"] = encryption_service.encrypt(token)

        # Cifrar WooCommerce
        if woo := data.get("woocommerce"):
            if key := woo.pop("consumer_key", None):
                woo["consumer_key_encrypted"] = encryption_service.encrypt(key)
            if secret := woo.pop("consumer_secret", None):
                woo["consumer_secret_encrypted"] = encryption_service.encrypt(secret)

        # Actualizar settings
        current = self.settings or {}
        current["ecommerce"] = data
        self.settings = current
```

---

### Fase 3: WooCommerce Client

#### 3.1 Crear `app/integrations/woocommerce_client.py`

```python
"""
WooCommerce REST API client.
"""

import base64
from typing import Any

import httpx


class WooCommerceClient:
    """Client for WooCommerce REST API v3."""

    def __init__(
        self,
        store_url: str,
        consumer_key: str,
        consumer_secret: str,
    ):
        """
        Initialize WooCommerce client.

        Args:
            store_url: WooCommerce store URL (e.g., https://mystore.com)
            consumer_key: REST API consumer key
            consumer_secret: REST API consumer secret
        """
        self.store_url = store_url.rstrip('/')
        self.base_url = f"{self.store_url}/wp-json/wc/v3"

        # HTTP Basic Auth
        credentials = f"{consumer_key}:{consumer_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
    ) -> dict[str, Any]:
        """Make HTTP request to WooCommerce API."""
        url = f"{self.base_url}{endpoint}"

        with httpx.Client(timeout=30.0) as client:
            response = client.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
            )
            response.raise_for_status()
            return response.json()

    def get_order(self, order_id: int) -> dict[str, Any]:
        """Get order by ID."""
        return self._request("GET", f"/orders/{order_id}")

    def mark_order_as_paid(self, order_id: int) -> dict[str, Any]:
        """
        Mark order as paid (set_paid=true).

        This will:
        - Set status to "processing"
        - Reduce stock items
        - Set date_paid timestamp

        Args:
            order_id: WooCommerce order ID

        Returns:
            Updated order data
        """
        return self._request("PUT", f"/orders/{order_id}", {"set_paid": True})

    def update_order_status(self, order_id: int, status: str) -> dict[str, Any]:
        """Update order status."""
        return self._request("PUT", f"/orders/{order_id}", {"status": status})
```

---

### Fase 4: Modelo Order

#### 4.1 Modificar `app/models/order.py`

```python
class Order(Base):
    # ... campos existentes ...

    # Shopify IDs (existentes)
    shopify_draft_order_id = Column(String, nullable=True, index=True)
    shopify_order_id = Column(String, nullable=True, index=True)

    # WooCommerce ID (nuevo)
    woocommerce_order_id = Column(
        Integer,
        nullable=True,
        index=True,
        comment="WooCommerce order ID"
    )

    @property
    def source_platform(self) -> str | None:
        """Detecta plataforma origen basado en qué ID existe."""
        if self.shopify_draft_order_id:
            return "shopify"
        if self.woocommerce_order_id:
            return "woocommerce"
        return None
```

#### 4.2 Modificar `app/schemas/order.py`

```python
class OrderCreate(OrderBase):
    """Schema para crear orden."""

    # Shopify (opcional)
    shopify_draft_order_id: str | None = Field(None, description="Shopify draft order ID")

    # WooCommerce (opcional)
    woocommerce_order_id: int | None = Field(None, description="WooCommerce order ID")

    @model_validator(mode='after')
    def validate_platform_id(self):
        """Validar que venga exactamente un ID de plataforma."""
        has_shopify = bool(self.shopify_draft_order_id)
        has_woo = bool(self.woocommerce_order_id)

        if not has_shopify and not has_woo:
            raise ValueError('Debe proporcionar shopify_draft_order_id o woocommerce_order_id')
        if has_shopify and has_woo:
            raise ValueError('No puede proporcionar ambos IDs de plataforma')
        return self
```

---

### Fase 5: Servicio Unificado de E-commerce

#### 5.1 Crear `app/services/ecommerce.py`

```python
"""
Unified e-commerce service for order validation.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.integrations.shopify_client import ShopifyClient
from app.integrations.woocommerce_client import WooCommerceClient
from app.models.order import Order
from app.repositories.order import order_repository


class EcommerceService:
    """Servicio unificado para operaciones de e-commerce."""

    def validate_order(
        self,
        db: Session,
        order: Order,
        payment_method: str | None = None,
        notes: str | None = None,
    ) -> Order:
        """
        Valida pago de una orden.

        Comportamiento según configuración del tenant:
        - Si has_ecommerce=false: solo actualiza fechas locales
        - Si sync_on_validation=false: solo actualiza fechas locales
        - Si sync_on_validation=true: sincroniza con e-commerce + actualiza local

        Args:
            db: Database session
            order: Orden a validar
            payment_method: Método de pago opcional
            notes: Notas opcionales

        Returns:
            Orden actualizada
        """
        tenant = order.tenant
        settings = tenant.get_settings()
        ecommerce = settings.ecommerce

        ecommerce_result = None

        # Sincronizar con e-commerce si corresponde
        if ecommerce.has_ecommerce and ecommerce.sync_on_validation:
            if ecommerce.platform == "shopify":
                ecommerce_result = self._sync_shopify(order, ecommerce.shopify)
            elif ecommerce.platform == "woocommerce":
                ecommerce_result = self._sync_woocommerce(order, ecommerce.woocommerce)

        # Actualizar orden localmente
        update_data = {
            "validado": True,
            "validated_at": datetime.utcnow(),
            "status": "Pagado",
        }

        if payment_method:
            update_data["payment_method"] = payment_method
        if notes:
            update_data["notes"] = notes

        # Datos específicos de Shopify (order_id del draft completado)
        if ecommerce_result and ecommerce.platform == "shopify":
            if "order_id" in ecommerce_result:
                update_data["shopify_order_id"] = ecommerce_result["order_id"]

        return order_repository.update(db, db_obj=order, obj_in=update_data)

    def _sync_shopify(self, order: Order, credentials) -> dict:
        """Completa draft order en Shopify."""
        client = ShopifyClient(
            store_url=credentials.store_url,
            access_token=credentials.access_token,
            api_version=credentials.api_version,
        )
        return client.complete_draft_order(order.shopify_draft_order_id)

    def _sync_woocommerce(self, order: Order, credentials) -> dict:
        """Marca orden como pagada en WooCommerce."""
        client = WooCommerceClient(
            store_url=credentials.store_url,
            consumer_key=credentials.consumer_key,
            consumer_secret=credentials.consumer_secret,
        )
        return client.mark_order_as_paid(order.woocommerce_order_id)


ecommerce_service = EcommerceService()
```

---

### Fase 6: Endpoint de Validación

#### 6.1 Modificar `app/api/v1/endpoints/orders.py`

```python
from app.services.ecommerce import ecommerce_service

@router.post("/{order_id}/validate")
async def validate_order(order_id: int, ...):
    # ... verificaciones existentes ...

    # Obtener configuración de e-commerce
    settings = order.tenant.get_settings()
    ecommerce = settings.ecommerce

    # Validar que el tenant tenga credenciales si se va a sincronizar
    if ecommerce.sync_on_validation and ecommerce.has_ecommerce:
        if ecommerce.platform == "shopify" and not order.shopify_draft_order_id:
            raise HTTPException(400, "Orden no tiene shopify_draft_order_id")
        if ecommerce.platform == "woocommerce" and not order.woocommerce_order_id:
            raise HTTPException(400, "Orden no tiene woocommerce_order_id")

    try:
        updated_order = ecommerce_service.validate_order(
            db=db,
            order=order,
            payment_method=validation_data.payment_method if validation_data else None,
            notes=validation_data.notes if validation_data else None,
        )
        return updated_order

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(401, "Credenciales de e-commerce inválidas")
        elif e.response.status_code == 404:
            raise HTTPException(404, "Orden no encontrada en e-commerce")
        raise HTTPException(502, f"Error de e-commerce: {str(e)}")
```

---

### Fase 7: Migración de Datos

#### 7.1 Crear migración Alembic

```python
"""Add woocommerce_order_id and migrate shopify to settings.

Revision ID: xxx
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    # 1. Agregar columna woocommerce_order_id a orders
    op.add_column(
        'orders',
        sa.Column('woocommerce_order_id', sa.Integer, nullable=True, index=True)
    )

    # 2. Migrar credenciales Shopify existentes a settings JSON
    # NOTA: Esto requiere ejecutar código Python para cifrar
    # Se hará en un script separado o manualmente

    # 3. Marcar columnas legacy como deprecadas (comentario)
    # Las columnas shopify_* se mantienen para compatibilidad


def downgrade():
    op.drop_column('orders', 'woocommerce_order_id')
```

#### 7.2 Script de migración de datos (separado)

```python
# scripts/migrate_shopify_to_settings.py
"""
Migra credenciales Shopify de columnas legacy a settings JSON.
Ejecutar una vez después de la migración Alembic.
"""

from app.core.database import SessionLocal
from app.models.tenant import Tenant
from app.schemas.tenant_settings import EcommerceSettings, ShopifyCredentials

def migrate():
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).filter(
            Tenant.shopify_store_url.isnot(None)
        ).all()

        for tenant in tenants:
            # Verificar si ya tiene settings.ecommerce
            current_settings = tenant.settings or {}
            if current_settings.get("ecommerce", {}).get("shopify"):
                print(f"Tenant {tenant.id} ya migrado, saltando...")
                continue

            # Crear nueva configuración
            shopify_creds = ShopifyCredentials(
                store_url=tenant.shopify_store_url,
                access_token=tenant.shopify_access_token,
                api_version=tenant.shopify_api_version or "2024-01",
            )

            ecommerce = EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )

            # Guardar (esto cifra automáticamente)
            tenant.set_ecommerce_settings(ecommerce)
            print(f"Migrado tenant {tenant.id}: {tenant.name}")

        db.commit()
        print(f"Migración completada: {len(tenants)} tenants procesados")

    finally:
        db.close()

if __name__ == "__main__":
    migrate()
```

---

## Resumen de Archivos

| # | Archivo | Acción | Descripción |
|---|---------|--------|-------------|
| 1 | `app/schemas/tenant_settings.py` | **Crear** | Schemas tipados para settings |
| 2 | `app/models/tenant.py` | Modificar | Métodos get/set_ecommerce_settings |
| 3 | `app/integrations/woocommerce_client.py` | **Crear** | Cliente HTTP WooCommerce |
| 4 | `app/models/order.py` | Modificar | Campo woocommerce_order_id |
| 5 | `app/schemas/order.py` | Modificar | Validación Shopify XOR WooCommerce |
| 6 | `app/services/ecommerce.py` | **Crear** | Servicio unificado validación |
| 7 | `app/api/v1/endpoints/orders.py` | Modificar | Usar ecommerce_service |
| 8 | `alembic/versions/xxx.py` | **Crear** | Migración DB |
| 9 | `scripts/migrate_shopify_to_settings.py` | **Crear** | Script migración datos |

**Total: 9 archivos (5 nuevos, 4 modificaciones)**

---

## Orden de Implementación

1. **Crear schemas** (`tenant_settings.py`)
2. **Modificar Tenant** (métodos get/set)
3. **Crear WooCommerceClient**
4. **Crear EcommerceService**
5. **Modificar Order model/schema**
6. **Modificar endpoint validate**
7. **Crear migración Alembic**
8. **Ejecutar migración de datos**
9. **Testing**

---

## Casos de Prueba

### Test 1: Tenant sin e-commerce
```python
settings = {"ecommerce": {"sync_on_validation": false}}
# Validar pago → Solo actualiza local
```

### Test 2: Tenant Shopify (sincroniza)
```python
settings = {
    "ecommerce": {
        "sync_on_validation": true,
        "shopify": {"store_url": "...", "access_token_encrypted": "..."}
    }
}
# Validar pago → Llama Shopify + actualiza local
```

### Test 3: Tenant WooCommerce (sincroniza)
```python
settings = {
    "ecommerce": {
        "sync_on_validation": true,
        "woocommerce": {"store_url": "...", "consumer_key_encrypted": "...", "consumer_secret_encrypted": "..."}
    }
}
# Validar pago → Llama WooCommerce + actualiza local
```

### Test 4: Tenant WooCommerce (NO sincroniza)
```python
settings = {
    "ecommerce": {
        "sync_on_validation": false,
        "woocommerce": {...}
    }
}
# Validar pago → Solo actualiza local (e-commerce se actualiza por otro medio)
```
