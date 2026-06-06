# Plan de implementación: Pedidos vinculados en el panel "Información"

**Spec:** `2026-06-06-conversation-orders-in-info-panel-design.md`
**Rama:** `feat/conversation-orders-list`

Orden recomendado: backend primero (con su test), luego frontend. Cada fase es
verificable de forma aislada.

---

## Fase 1 — Backend: filtro `messaging_conversation_id`

### 1.1 `app/repositories/order.py`
- En `get_all(...)`, agregar el parámetro keyword `messaging_conversation_id: int | None = None`
  y, junto a los demás filtros encadenados:
  ```python
  if messaging_conversation_id is not None:
      query = query.filter(Order.messaging_conversation_id == messaging_conversation_id)
  ```
- Hacer lo mismo en `count_all(...)` (mismo parámetro y mismo filtro), para mantener
  `total` consistente con `items`.

### 1.2 `app/services/order.py`
- `get_orders_by_tenant(...)` y `get_all_orders(...)`: agregar
  `messaging_conversation_id: int | None = None` a la firma e incluirlo en el dict
  `filter_kwargs` (que ya se pasa tanto a `get_all` como a `count_all`).

### 1.3 `app/api/v1/endpoints/orders.py`
- `list_orders(...)`: agregar el query param
  `messaging_conversation_id: int | None = None` y pasarlo a ambas ramas
  (`get_all_orders` para SUPERADMIN y `get_orders_by_tenant` para el resto).
- Sin cambios de permisos. El aislamiento por tenant lo sigue garantizando la rama
  no-SUPERADMIN.

### 1.4 Test backend
Archivo: `apps/backend/tests/repositories/test_order_repository.py` (o el que agrupe
tests de `OrderRepository`; si no existe, crearlo siguiendo el patrón de
`tests/repositories/`).
- `get_all` con `messaging_conversation_id` devuelve solo las órdenes de esa
  conversación.
- El filtro respeta el aislamiento por tenant (una orden con el mismo
  `messaging_conversation_id` pero otro `tenant_id` no se devuelve cuando se pasa
  `tenant_id`).
- Sin el parámetro, el comportamiento previo no cambia (no regresión).

**Verificación:** `cd apps/backend && uv run pytest tests/repositories/ -k conversation`
y `uv run ruff check .`

---

## Fase 2 — Frontend: capa de datos

### 2.1 `lib/api-client/orders.ts`
- Extender `FetchOrdersParams` con `messaging_conversation_id?: number`.
- Agregar una función dedicada que devuelva la forma **snake_case** real del backend
  (la de `lib/services/order-service.ts`), evitando el tipo camelCase de
  `lib/types/order.ts`:
  ```ts
  import type { OrderListResponse as RawOrderListResponse } from '@/lib/services/order-service';

  export async function getConversationOrders(
    conversationId: number,
  ): Promise<RawOrderListResponse> {
    return apiGet<RawOrderListResponse>('/api/orders', {
      messaging_conversation_id: conversationId,
      limit: 50,
    });
  }
  ```
- El proxy `app/api/orders/route.ts` ya reenvía todos los query params: sin cambios.

### 2.2 Hook `hooks/use-conversation-orders.ts` (nuevo)
- Firma: `useConversationOrders(conversationId: number | undefined)`.
- Estado: `{ orders, loading, error }`, tipado con el `Order` snake_case de
  `order-service.ts`.
- `useEffect` que dispara `getConversationOrders(conversationId)` cuando cambia
  `conversationId`; ignora resultados obsoletos (flag `cancelled` en cleanup).
- En error, setea `error` y deja `orders = []`.

---

## Fase 3 — Frontend: UI en el panel

### 3.1 `components/conversations/contact-info-panel.tsx`
- Importar el hook y un nuevo subcomponente de presentación.
- Insertar la sección **entre "Etiquetas" y "Metadata"** (después del bloque de
  `LabelManager`, antes del bloque "Detalles"), con su `<Separator />` siguiendo el
  patrón existente.
- Estructura de la sección:
  ```
  Pedidos (N)            <- encabezado, mismo estilo uppercase muted que las demás
    [tarjeta por pedido]
    ...
  ```
- Estados:
  - **loading:** skeleton breve (1–2 filas) reutilizando el patrón de skeleton del
    proyecto.
  - **error:** línea discreta "No se pudieron cargar los pedidos".
  - **vacío:** texto "Sin pedidos vinculados" (muted, mismo tamaño que metadata).

### 3.2 Subcomponente `OrderMiniCard` (en el mismo archivo o `order-mini-card.tsx`)
Tarjeta de solo lectura (sin `onClick`, sin navegación). Por pedido muestra:
- **ID:** `shopify_order_id ?? (woocommerce_order_id != null ? '#'+woocommerce_order_id : '#'+id)`.
- **Badge de estado de pago:** derivado de `status` (con respaldo en `validado`),
  mapeado a Pagado / Pendiente / Rechazado. Reutilizar los estilos de badge de estado
  de pago ya usados en la tabla de órdenes (`app/dashboard/orders/orders-client.tsx`)
  para mantener consistencia de color (verde/ámbar/rojo).
- **Monto + moneda:** formatear `total_price` con `currency` (ej. `S/ 250.00`),
  reutilizando el helper de formato de moneda existente si lo hay (`lib/utils`).
- **Fecha:** `created_at` con `toLocaleDateString("es-PE", ...)`, igual formato que el
  bloque "Creada" de metadata.

**Verificación frontend:** `cd apps/frontend && pnpm lint` y revisión manual del panel
en tres escenarios:
1. Conversación con órdenes vinculadas → se listan las tarjetas con badge correcto.
2. Conversación sin órdenes → "Sin pedidos vinculados".
3. Forzar error de red → línea de error, el resto del panel sigue funcionando.

---

## Resumen de archivos tocados

**Backend**
- `app/repositories/order.py` (get_all, count_all)
- `app/services/order.py` (get_orders_by_tenant, get_all_orders)
- `app/api/v1/endpoints/orders.py` (list_orders)
- `tests/repositories/test_order_repository.py` (nuevo o ampliado)

**Frontend**
- `lib/api-client/orders.ts` (param + getConversationOrders)
- `hooks/use-conversation-orders.ts` (nuevo)
- `components/conversations/contact-info-panel.tsx` (sección Pedidos)
- `components/conversations/order-mini-card.tsx` (nuevo, opcional)

## Riesgos / notas
- Doble tipo `Order` en el frontend: el plan usa explícitamente la forma snake_case del
  backend para el panel y no toca `lib/types/order.ts`.
- Permisos: el panel de conversaciones lo usan roles que ya tienen lectura de órdenes
  (ADMIN/VENTAS/SUPERADMIN). Si algún rol que ve chats no tuviera permiso de listar
  órdenes, el fetch devolvería 403 y caería en el estado de error (degradación
  aceptable). Confirmar roles antes de cerrar.
