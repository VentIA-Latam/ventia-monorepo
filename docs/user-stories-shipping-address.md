# Historias de Usuario - Dirección de Envío (Shipping Address)

> Sistema para capturar, almacenar y mostrar direcciones de envío desde webhooks de Shopify y WooCommerce.

**Fecha**: 2026-02-03
**Versión**: 1.0
**Estimación Total**: ~3 horas

---

## Contexto

Los webhooks de Shopify y WooCommerce incluyen información de dirección de envío, pero actualmente no tenemos dónde almacenar esta información en la base de datos. Este feature agrega soporte para:

- **Shopify**: Usa `shipping_address` como campo principal, `billing_address` como fallback
- **WooCommerce**: Usa `shipping` como campo principal, `billing` como fallback

**Formato simplificado**: En vez de guardar todos los campos (address1, address2, city, state, zip, country, etc.), solo guardamos una concatenación de `address1` + `city` en un campo TEXT:

```
Ejemplo: "Av Tudela y Varela 389 dpto 701 Miraflores, Lima"
```

---

## Épica: Dirección de Envío

### US-SA-001: Backend - Modelo y Migración

**Como** desarrollador del sistema
**Quiero** agregar el campo `shipping_address` al modelo Order
**Para** almacenar la dirección de envío en formato simple

#### Criterios de Aceptación
- [ ] Existe columna `shipping_address` tipo TEXT en tabla `orders`
- [ ] Campo es nullable (órdenes antiguas no tienen dirección)
- [ ] Tiene comment descriptivo: "Shipping address: address1, city"
- [ ] Migración de Alembic creada con nombre `add_shipping_address_to_orders`
- [ ] Migración incluye función `downgrade()` para revertir

#### Tareas Técnicas
1. Modificar `apps/backend/app/models/order.py`:
   ```python
   from sqlalchemy import Text

   class Order(Base):
       __tablename__ = "orders"

       # ... campos existentes ...

       # Dirección de envío (formato: "address1, city")
       shipping_address = Column(
           Text,
           nullable=True,
           comment="Shipping address: address1, city"
       )
   ```

2. Crear migración:
   ```bash
   cd apps/backend
   uv run alembic revision --autogenerate -m "add_shipping_address_to_orders"
   ```

3. Revisar archivo generado en `alembic/versions/`

4. Aplicar migración:
   ```bash
   uv run alembic upgrade head
   ```

5. Verificar en PostgreSQL:
   ```sql
   \d orders
   -- Debe mostrar: shipping_address | text | nullable
   ```

#### Definición de Completado
- ✅ Migración aplicada sin errores
- ✅ Columna visible en PostgreSQL
- ✅ Downgrade funciona correctamente
- ✅ Órdenes existentes tienen `shipping_address = NULL`

---

### US-SA-002: Backend - Schemas Pydantic

**Como** desarrollador del sistema
**Quiero** actualizar los schemas para incluir `shipping_address`
**Para** validar y documentar el campo en la API

#### Criterios de Aceptación
- [ ] `OrderBase` incluye `shipping_address: str | None`
- [ ] `OrderCreate` hereda el campo de `OrderBase`
- [ ] `OrderUpdate` incluye el campo como opcional
- [ ] `OrderResponse` retorna el campo
- [ ] Field tiene descripción clara y max_length=500

#### Tareas Técnicas
Modificar `apps/backend/app/schemas/order.py`:

```python
from pydantic import BaseModel, Field

class OrderBase(BaseModel):
    # ... campos existentes ...

    shipping_address: str | None = Field(
        None,
        description="Shipping address: address1, city",
        max_length=500
    )

class OrderCreate(OrderBase):
    pass  # Hereda shipping_address

class OrderUpdate(BaseModel):
    # ... campos existentes ...
    shipping_address: str | None = None

class OrderResponse(OrderBase):
    # ... campos existentes ...
    # shipping_address incluido via OrderBase

    class Config:
        from_attributes = True
```

#### Definición de Completado
- ✅ Schemas validan correctamente
- ✅ Documentación visible en Swagger/OpenAPI
- ✅ No hay errores de compilación: `uv run python -m py_compile app/schemas/order.py`

---

### US-SA-003: Backend - Helper Function

**Como** desarrollador del sistema
**Quiero** una función helper para formatear direcciones
**Para** normalizar el formato entre Shopify y WooCommerce

#### Criterios de Aceptación
- [ ] Función `_format_shipping_address()` existe en `webhook_service.py`
- [ ] Maneja formato de Shopify (`address1`, `city`)
- [ ] Maneja formato de WooCommerce (`address_1`, `city`)
- [ ] Retorna `None` si no hay datos
- [ ] Retorna string concatenado: `"{address1}, {city}"`
- [ ] Maneja casos edge (solo address1, solo city, ninguno)

#### Tareas Técnicas
Agregar en `apps/backend/app/services/webhook_service.py` (después de `_map_woo_status()`):

```python
def _format_shipping_address(
    address_data: dict[str, Any] | None,
    platform: str
) -> str | None:
    """
    Format shipping address as "address1, city" string.

    Args:
        address_data: Raw address dict from webhook
        platform: "shopify" or "woocommerce"

    Returns:
        Formatted address string or None if no data

    Examples:
        >>> _format_shipping_address({"address1": "Av Tudela 389", "city": "Lima"}, "shopify")
        "Av Tudela 389, Lima"
    """
    if not address_data:
        return None

    # Shopify usa "address1"
    if platform == "shopify":
        address1 = address_data.get("address1")
        city = address_data.get("city")

    # WooCommerce usa "address_1" (con underscore)
    elif platform == "woocommerce":
        address1 = address_data.get("address_1")
        city = address_data.get("city")
    else:
        return None

    # Concatenar si ambos existen
    if address1 and city:
        return f"{address1}, {city}"
    elif address1:
        return address1
    elif city:
        return city
    else:
        return None
```

#### Definición de Completado
- ✅ Función implementada
- ✅ Maneja ambos formatos (Shopify + WooCommerce)
- ✅ Tests unitarios cubren casos edge

---

### US-SA-004: Backend - Webhooks Shopify

**Como** sistema
**Quiero** extraer y guardar dirección de envío en webhooks de Shopify
**Para** tener la dirección disponible cuando se crea o actualiza un draft order

#### Criterios de Aceptación
- [ ] `process_shopify_draft_order_create()` extrae `shipping_address` o `billing_address`
- [ ] Usa `_format_shipping_address()` para formatear
- [ ] Guarda `shipping_address` en la orden creada
- [ ] `process_shopify_draft_order_update()` actualiza dirección si cambió
- [ ] Marca `needs_update=True` si dirección cambió

#### Tareas Técnicas

**En `process_shopify_draft_order_create()` (línea ~80-260):**

Agregar después de extraer line_items, antes de crear orden:

```python
# Extraer dirección de envío (shipping_address principal, billing_address fallback)
shipping_address_raw = payload.get("shipping_address") or payload.get("billing_address")
shipping_address = _format_shipping_address(shipping_address_raw, "shopify")

# Crear orden
order_create = OrderCreate(
    tenant_id=tenant.id,
    shopify_draft_order_id=shopify_draft_order_id,
    customer_email=customer_email,
    customer_name=customer_name,
    total_price=total_price,
    currency=currency,
    line_items=line_items,
    status="Pendiente",
    validado=False,
    shipping_address=shipping_address,  # NUEVO
)
```

**En `process_shopify_draft_order_update()` (línea ~400-600):**

Agregar extracción y comparación:

```python
# Extraer dirección actualizada
shipping_address_raw = payload.get("shipping_address") or payload.get("billing_address")
shipping_address = _format_shipping_address(shipping_address_raw, "shopify")

# Verificar si cambió
if shipping_address and order.shipping_address != shipping_address:
    needs_update = True

# En el bloque de actualización:
if needs_update:
    if shipping_address:
        order.shipping_address = shipping_address
    # ... resto de actualizaciones ...
```

#### Definición de Completado
- ✅ Draft order create guarda dirección
- ✅ Draft order update actualiza dirección si cambia
- ✅ Usa shipping_address como principal, billing_address como fallback
- ✅ Tests manuales con webhook real pasan

---

### US-SA-005: Backend - Webhooks WooCommerce

**Como** sistema
**Quiero** extraer y guardar dirección de envío en webhooks de WooCommerce
**Para** tener la dirección disponible cuando se crea o actualiza una orden

#### Criterios de Aceptación
- [ ] `process_woocommerce_order_created()` extrae `shipping` o `billing`
- [ ] Usa `_format_shipping_address()` con platform="woocommerce"
- [ ] Guarda `shipping_address` en la orden creada
- [ ] `process_woocommerce_order_updated()` actualiza dirección (cuando se implemente)

#### Tareas Técnicas

**En `process_woocommerce_order_created()` (línea ~940-1100):**

Agregar después de extraer line_items, antes de crear orden:

```python
# Extraer dirección de envío (shipping principal, billing fallback)
shipping_address_raw = payload.get("shipping") or payload.get("billing")
shipping_address = _format_shipping_address(shipping_address_raw, "woocommerce")

# Crear orden
order_create = OrderCreate(
    tenant_id=tenant.id,
    woocommerce_order_id=woocommerce_order_id,
    customer_email=customer_email,
    customer_name=customer_name,
    total_price=total_price,
    currency=currency,
    line_items=line_items,
    status=status,
    validado=validado,
    payment_method=payment_method,
    shipping_address=shipping_address,  # NUEVO
)
```

**Para `process_woocommerce_order_updated()` (futuro):**

Mismo patrón que Shopify update:
- Extraer dirección
- Comparar con actual
- Actualizar si cambió

#### Definición de Completado
- ✅ Order created guarda dirección
- ✅ Usa shipping como principal, billing como fallback
- ✅ Mapeo correcto: `address_1` → address1 para WooCommerce
- ✅ Tests manuales con webhook real pasan

---

### US-SA-006: Frontend - Tipos TypeScript

**Como** desarrollador frontend
**Quiero** que el tipo `Order` incluya `shipping_address`
**Para** tener validación de tipos en el frontend

#### Criterios de Aceptación
- [ ] Interface `Order` incluye `shipping_address: string | null`
- [ ] Tipo se sincroniza automáticamente desde backend
- [ ] No hay errores de TypeScript en build

#### Tareas Técnicas

Verificar en `apps/frontend/lib/services/order-service.ts`:

```typescript
export interface Order {
  id: number;
  tenant_id: number;
  shopify_draft_order_id: string | null;
  shopify_order_id: string | null;
  woocommerce_order_id: number | null;
  customer_email: string;
  customer_name: string | null;
  total_price: number;
  currency: string;
  line_items: LineItem[];
  status: string;
  validado: boolean;
  validated_at: string | null;
  payment_method: string | null;
  shipping_address: string | null;  // AGREGAR ESTE CAMPO
  created_at: string;
  updated_at: string;
}
```

#### Definición de Completado
- ✅ Campo agregado a interface
- ✅ Build de frontend sin errores: `pnpm build`
- ✅ No hay warnings de TypeScript

---

### US-SA-007: Frontend - UI Display

**Como** usuario del sistema
**Quiero** ver la dirección de envío en el detalle de la orden
**Para** saber dónde debe enviarse el pedido

#### Criterios de Aceptación
- [ ] Sección "DIRECCIÓN DE ENVÍO" muestra dirección si existe
- [ ] Muestra "Información no disponible" si `shipping_address` es null
- [ ] Formato visual consistente con resto del diseño
- [ ] Maneja órdenes antiguas sin dirección (null)

#### Tareas Técnicas

Modificar `apps/frontend/components/dashboard/orders/order-detail.tsx` (línea ~220-228):

**ANTES:**
```typescript
{/* Dirección de envío - Placeholder para futuros campos */}
<div>
  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
    DIRECCIÓN DE ENVÍO
  </p>
  <div className="text-xs sm:text-sm text-muted-foreground">
    <p>Información no disponible</p>
  </div>
</div>
```

**DESPUÉS:**
```typescript
{/* Dirección de envío */}
<div>
  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
    DIRECCIÓN DE ENVÍO
  </p>
  {order.shipping_address ? (
    <p className="text-xs sm:text-sm">
      {order.shipping_address}
    </p>
  ) : (
    <p className="text-xs sm:text-sm text-muted-foreground">
      Información no disponible
    </p>
  )}
</div>
```

#### Definición de Completado
- ✅ Dirección se muestra correctamente cuando existe
- ✅ Placeholder se muestra cuando es null
- ✅ Diseño consistente con resto de la página
- ✅ Prueba con orden que tiene dirección y orden sin dirección

---

## Orden de Implementación

**Fase 1: Base de Datos y Schemas (30 min)**
1. US-SA-001: Modelo y Migración
2. US-SA-002: Schemas Pydantic

**Fase 2: Backend Logic (1 hora)**
3. US-SA-003: Helper Function
4. US-SA-004: Webhooks Shopify
5. US-SA-005: Webhooks WooCommerce

**Fase 3: Frontend (30 min)**
6. US-SA-006: Tipos TypeScript
7. US-SA-007: UI Display

**Fase 4: Testing (1 hora)**
- Tests manuales con webhooks reales
- Verificación en base de datos
- Verificación en UI

---

## Verificación End-to-End

### 1. Migración de Base de Datos

```bash
cd apps/backend

# Crear migración
uv run alembic revision --autogenerate -m "add_shipping_address_to_orders"

# Revisar archivo generado
cat alembic/versions/*_add_shipping_address*.py

# Aplicar
uv run alembic upgrade head

# Verificar en PostgreSQL
docker exec -it ventia-postgres psql -U ventia_user -d ventia_db
\d orders
# Debe mostrar: shipping_address | text
```

### 2. Test Backend - Shopify Draft Order

```bash
# 1. Crear draft order en Shopify con shipping_address
# 2. Webhook draft_orders/create debe procesarse
# 3. Verificar en DB:

SELECT id, customer_name, shipping_address
FROM orders
WHERE shopify_draft_order_id = 'gid://shopify/DraftOrder/XXX';

# Esperado: "Av Tudela y Varela 389 dpto 701 Miraflores, Lima"
```

### 3. Test Backend - WooCommerce Order

```bash
# 1. Sincronizar orden de WooCommerce con shipping
# 2. Verificar en DB:

SELECT id, customer_name, shipping_address
FROM orders
WHERE woocommerce_order_id = XXX;

# Esperado: dirección formateada correctamente
```

### 4. Test Frontend

```
1. Ir a /dashboard/orders
2. Click en una orden que tenga dirección
3. Verificar sección "DIRECCIÓN DE ENVÍO"

Esperado:
✅ Muestra dirección formateada
✅ Órdenes antiguas muestran "Información no disponible"
```

---

## Casos Edge

### 1. Sin dirección en webhook
```python
shipping_address = None
# Frontend muestra "Información no disponible" ✅
```

### 2. Solo address1, sin city
```python
shipping_address = "Av Tudela 389"
# Frontend muestra solo eso ✅
```

### 3. Solo city, sin address1
```python
shipping_address = "Lima"
# Frontend muestra solo eso ✅
```

### 4. Actualización de dirección
```python
# Draft order update con nueva dirección
# needs_update = True si cambió
# Se actualiza en DB ✅
```

### 5. WooCommerce sin shipping, solo billing
```python
shipping_address_raw = payload.get("shipping") or payload.get("billing")
# Usa billing como fallback ✅
```

---

## Archivos Modificados

### Backend
- `apps/backend/app/models/order.py` - agregar campo
- `apps/backend/app/schemas/order.py` - actualizar schemas
- `apps/backend/app/services/webhook_service.py` - helper + handlers
- `apps/backend/alembic/versions/XXXXX_add_shipping_address.py` - nueva migración

### Frontend
- `apps/frontend/lib/services/order-service.ts` - tipo Order
- `apps/frontend/components/dashboard/orders/order-detail.tsx` - UI display

---

## Resumen

**Líneas de código nuevas**: ~50
**Archivos modificados**: 5
**Archivos nuevos**: 1 (migración)
**Complejidad**: Baja

**Beneficios**:
- ✅ Dirección de envío visible en detalle de orden
- ✅ Soporte Shopify + WooCommerce
- ✅ Formato simple y directo
- ✅ Retrocompatible (nullable)
- ✅ Fácil de extender en el futuro

---

## Glosario

- **shipping_address**: Dirección de envío en formato "address1, city"
- **billing_address**: Dirección de facturación (usado como fallback)
- **address1**: Línea principal de dirección (calle, número, depto)
- **city**: Ciudad de envío
- **Nullable**: Campo opcional que puede ser NULL en la base de datos
- **Idempotencia**: No crear duplicados si webhook se procesa dos veces
- **Fallback**: Valor alternativo usado si el principal no existe

---

## Referencias

- [Plan Técnico](../C:\Users\Renzo\.claude\plans\tranquil-inventing-pelican.md)
- [Shopify Draft Orders API](https://shopify.dev/docs/api/admin-rest/latest/resources/draftorder)
- [WooCommerce Orders API](https://woocommerce.github.io/woocommerce-rest-api-docs/#orders)
