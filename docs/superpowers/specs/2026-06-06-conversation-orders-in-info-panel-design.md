# Pedidos vinculados en el panel "Información"

**Fecha:** 2026-06-06
**Rama:** `feat/conversation-orders-list`
**Estado:** Diseño aprobado

## Resumen

Mostrar, dentro del panel "Información" de la vista de conversaciones, la lista de
pedidos (órdenes) vinculados a esa conversación. El vínculo ya existe en la base de
datos vía la columna `orders.messaging_conversation_id`, que se setea automáticamente
cuando un webhook de Shopify/WooCommerce crea una orden y el backend la matchea contra
una conversación existente por número de teléfono (E.164).

Esta funcionalidad solo expone ese vínculo en la UI; no cambia cómo se crean ni se
vinculan las órdenes.

## Objetivo

El vendedor, al abrir una conversación, ve en el panel "Información" qué pedidos se
han generado a partir de ese chat, con su estado de pago, monto y fecha.

## Decisiones de producto

- **Qué se muestra:** todos los pedidos vinculados a la conversación, validados o no
  (pendiente, pagado, rechazado).
- **Interacción:** lista de solo lectura. No navega al detalle de la orden.
- **Datos por pedido:** ID / N° de orden, monto + moneda, estado de pago (badge), fecha
  de creación.
- **Estado vacío:** mostrar el texto "Sin pedidos vinculados" (la sección siempre está
  presente).
- **Ubicación:** sección nueva en el panel, después de "Etiquetas" y antes de
  "Metadata".

## Arquitectura

Las órdenes viven en el backend FastAPI; las conversaciones en el servicio Rails de
messaging. El `conversation.id` que recibe el panel **es** el valor que las órdenes
guardan en `messaging_conversation_id`. Por tanto, el panel consulta el backend de
órdenes (no el de messaging) filtrando por ese id.

Enfoque elegido (Opción A): **extender el endpoint de listado de órdenes existente**
con un filtro opcional `messaging_conversation_id`, en lugar de crear un endpoint
dedicado. Reutiliza paginación, serialización y permisos, y sigue el patrón de los
demás filtros encadenados en el repositorio.

### Backend

**`app/repositories/order.py`**
Agregar el parámetro opcional `messaging_conversation_id: int | None = None` a
`get_all()` (y al camino por tenant), encadenando un filtro:

```python
if messaging_conversation_id is not None:
    query = query.filter(Order.messaging_conversation_id == messaging_conversation_id)
```

**`app/services/order.py`**
Propagar el nuevo parámetro desde el service hacia el repositorio (siguiendo la firma
actual del listado).

**`app/api/v1/endpoints/orders.py`**
`GET /orders` recibe un nuevo query param opcional
`messaging_conversation_id: int | None = None` y lo pasa al service. Mantiene el patrón
SUPERADMIN (sin filtro de tenant) vs. resto (filtrado por `tenant_id`). Sin cambios en
permisos: reutiliza el permiso de lectura de órdenes vigente.

### Frontend

**`lib/api-client/orders.ts`**
Extender `FetchOrdersParams` con `messaging_conversation_id?: number`. El proxy
`app/api/orders/route.ts` ya reenvía todos los query params, por lo que no requiere
cambios.

**Hook `useConversationOrders(conversationId, tenantId)`**
Hook nuevo que hace el fetch con `getOrders({ messaging_conversation_id })` y expone
`{ orders, loading, error }`. Se ejecuta cuando cambia `conversationId`.

**`components/conversations/contact-info-panel.tsx`**
Nueva sección "Pedidos" entre "Etiquetas" y "Metadata":

- Encabezado: "Pedidos (N)".
- Por pedido, una tarjeta de solo lectura:
  - ID / N° de orden (shopify order id si existe; si no, id interno).
  - Badge de estado de pago: Pagado (verde) / Pendiente (ámbar) / Rechazado (rojo),
    reutilizando los estilos de badge usados en la tabla de órdenes.
  - Monto + moneda y fecha formateada.
- Estado vacío: texto "Sin pedidos vinculados".
- Loading: skeleton breve.
- Error: línea discreta "No se pudieron cargar los pedidos".

## Flujo de datos

1. El usuario abre una conversación → `conversation.id` (= `messaging_conversation_id`).
2. El panel monta → `useConversationOrders(conversation.id)` →
   `getOrders({ messaging_conversation_id })`.
3. Proxy `/api/orders` → backend `GET /orders?messaging_conversation_id=...` (ya
   filtrado por tenant del usuario autenticado).
4. Se renderizan las tarjetas (o el estado vacío).

## Manejo de errores

- Backend: el filtro es opcional; si no se envía, el comportamiento del endpoint no
  cambia. Un valor sin coincidencias devuelve lista vacía.
- Frontend: error de red → mensaje discreto en la sección, sin romper el resto del
  panel.

## Testing

- **Backend**
  - Repositorio: filtra correctamente por `messaging_conversation_id` y respeta el
    aislamiento por tenant.
  - Endpoint: el query param se aplica; sin coincidencias devuelve `[]`; sin el param,
    el comportamiento previo se mantiene.
- **Frontend**
  - Verificación manual del panel en tres estados: con pedidos, vacío, y error/loading.

## Fuera de alcance

- Navegación al detalle de la orden desde el panel.
- Crear o vincular órdenes manualmente desde la conversación.
- Paginación dentro del panel (se asume un número bajo de pedidos por conversación).
