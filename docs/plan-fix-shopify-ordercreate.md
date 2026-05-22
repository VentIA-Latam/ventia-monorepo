# Fix: Shopify orderCreate + mejoras Order

## Estado: IMPLEMENTADO

## Cambios realizados

### 1. Modelo Order — nueva columna `customer_phone`
- **Archivo:** `apps/backend/app/models/order.py`
- Columna `String(20)`, nullable, formato E.164

### 2. Schemas — `customer_phone` en OrderBase, OrderUpdate
- **Archivo:** `apps/backend/app/schemas/order.py`
- Validación regex E.164: `^\+?[1-9]\d{1,14}$`

### 3. Migración Alembic
- **Archivo:** `apps/backend/alembic/versions/20260421_1200-add_customer_phone_to_orders.py`
- `ADD COLUMN customer_phone` — sin downtime

### 4. shopify_client.py — fix `create_paid_order`
- **Archivo:** `apps/backend/app/integrations/shopify_client.py`
- Items con SKU `DELIVERY` van a `shippingLines` (no lineItems)
- `firstName`/`lastName` derivados de `customer_name` en shippingAddress
- `phone` enviado en 3 lugares: `order.phone`, `shippingAddress.phone`, `customer.phone`

### 5. ecommerce.py — pasar phone + fix cancel
- **Archivo:** `apps/backend/app/services/ecommerce.py`
- `_create_shopify_order` pasa `customer_phone` al client
- `cancel_order` verifica `order.source_platform == platform` antes de sync (fix órdenes nativas)

### 6. order.py service — recalcular en update
- **Archivo:** `apps/backend/app/services/order.py`
- `update_order` ahora recalcula `subtotal` y `total_price` cuando se envían `line_items`

### 7. webhook_service.py — parsear phone
- **Archivo:** `apps/backend/app/services/webhook_service.py`
- `process_shopify_draft_order_create`: extrae `customer.phone` y lo guarda
- `process_shopify_order_updated`: extrae phone, check idempotencia, asigna

## Deploy

```bash
# 1. Build y push imagen
docker build -t equipoventia/ventia-backend:latest -f docker/backend.Dockerfile .
docker push equipoventia/ventia-backend:latest

# 2. En el servidor
docker pull equipoventia/ventia-backend:latest
cd /path/to/docker/prod
docker compose up -d backend

# 3. Aplicar migración
docker exec ventia-prod-backend uv run alembic upgrade head
```

## Verificación post-deploy

1. POST /orders con `customer_phone`, `shipping_address`, item DELIVERY → verificar en Shopify
2. POST /orders/{id}/cancel en orden nativa → no debe intentar sync con Shopify
3. PATCH /orders/{id} con line_items → total_price debe recalcularse
