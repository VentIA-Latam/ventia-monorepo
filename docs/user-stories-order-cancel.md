# Historias de Usuario - Cancelación de Pedidos (Order Cancel)

> Sistema para cancelar pedidos desde el frontend con sincronización automática hacia Shopify (draft y completados) y WooCommerce.

**Fecha**: 2026-02-04
**Versión**: 1.0

---

## Contexto

Actualmente no existe mecanismo para cancelar pedidos desde VentIA. Se necesitan dos flujos distintos según el estado del pedido en Shopify:

- **Draft order** (no validado): Shopify lo elimina completamente con `draftOrderDelete`. Solo necesita el ID.
- **Orden completada** (ya validada, tiene `shopify_order_id`): Se cancela con `orderCancel`, que acepta motivo, método de reembolso, reposición de inventario, notificación al cliente y nota del personal.
- **WooCommerce**: Se actualiza el estado a `cancelled` con la API REST que ya existe (`update_order_status`).

En los tres casos, el status local en VentIA se cambia a `"Cancelado"`.

### Reglas de negocio

| Caso | Condición | API externa | Campos del diálogo |
|---|---|---|---|
| Draft Shopify | `!validado` + `shopify_draft_order_id` | `draftOrderDelete(id)` | Motivo + Nota |
| Completado Shopify | `validado` + `shopify_order_id` | `orderCancel(id, input)` | Todos los campos |
| WooCommerce | `woocommerce_order_id` | `update_order_status(id, "cancelled")` | Motivo + Nota |

- No se puede cancelar un pedido que ya tiene status `"Cancelado"` (guard → 400).
- El diálogo de cancelación muestra los campos de reembolso/reposición/notificación **solo** cuando el pedido es un Shopify completado (tiene sentido reembolsar solo si ya se cobró).

### Enum de motivos (Shopify `OrderCancelReason`)

| Valor | Descripción |
|---|---|
| `CUSTOMER` | El cliente cambió o canceló el pedido |
| `DECLINED` | Pago rechazado |
| `FRAUD` | Pedido fraudulento |
| `INVENTORY` | Artículos no disponibles |
| `STAFF` | Error del personal |
| `OTHER` | Otro |

---

## Épica: Cancelación de Pedidos

---

### US-OC-001: Backend - Schema de Cancelación

**Como** desarrollador del sistema
**Quiero** definir el schema Pydantic `OrderCancel` con los campos necesarios
**Para** validar el request de cancelación en la API

#### Criterios de Aceptación
- [x] Existe clase `OrderCancel(BaseModel)` en `apps/backend/app/schemas/order.py`
- [x] Campo `reason: str` obligatorio (valores válidos: `CUSTOMER`, `DECLINED`, `FRAUD`, `INVENTORY`, `STAFF`, `OTHER`)
- [x] Campo `restock: bool` con default `True`
- [x] Campo `notify_customer: bool` con default `True`
- [x] Campo `refund_method: str | None` con default `"original"` (valores: `"original"`, `"store_credit"`, `"later"`)
- [x] Campo `staff_note: str | None` con default `None`
- [x] Schema se exporta correctamente desde el módulo

#### Tareas Técnicas
Agregar en `apps/backend/app/schemas/order.py` después de `OrderValidate`:

```python
class OrderCancel(BaseModel):
    """Schema para cancelar un pedido."""
    reason: str = Field(..., description="Motivo de cancelación (CUSTOMER | DECLINED | FRAUD | INVENTORY | STAFF | OTHER)")
    restock: bool = Field(default=True, description="Reponer inventario (solo pedidos Shopify completados)")
    notify_customer: bool = Field(default=True, description="Notificar al cliente (solo pedidos Shopify completados)")
    refund_method: str | None = Field(default="original", description="Método de reembolso: original | store_credit | later (solo pedidos Shopify completados)")
    staff_note: str | None = Field(default=None, description="Nota interna del personal")
```

#### Definición de Completado
- ✅ Schema existe y se importa sin errores
- ✅ Validación funciona con datos válidos e inválidos
- ✅ `uv run python -m py_compile app/schemas/order.py` sin errores

---

### US-OC-002: Backend - Mutaciones GraphQL en ShopifyClient

**Como** desarrollador del sistema
**Quiero** agregar los métodos `delete_draft_order()` y `cancel_order()` al cliente de Shopify
**Para** ejecutar las mutaciones necesarias desde el backend

#### Criterios de Aceptación
- [x] Método `delete_draft_order(draft_order_id)` existe en `ShopifyClient`
- [x] Ejecuta la mutación `draftOrderDelete` con variable `$id`
- [x] Retorna el `deletedDraftOrderId` si es exitoso
- [x] Lanza `ValueError` si hay `userErrors`
- [x] Método `cancel_order(order_id, reason, restock, notify_customer, refund_method, staff_note)` existe
- [x] Ejecuta la mutación `orderCancel` con input `OrderCancelInput`
- [x] `reason` se pasa como enum `OrderCancelReason` (valores: `CUSTOMER`, `DECLINED`, `FRAUD`, `INVENTORY`, `STAFF`, `OTHER`)
- [x] Mapeo de `refund_method`: `"original"` → `ORIGINAL_PAYMENT_METHOD`, `"store_credit"` → `STORE_CREDIT`, `"later"` → `MANUAL`
- [x] Lanza `ValueError` si hay `userErrors`
- [x] Ambos métodos reutan `_execute_query()` existente

#### Tareas Técnicas
Agregar en `apps/backend/app/integrations/shopify_client.py` después de `complete_draft_order()`:

**`delete_draft_order`:**
```python
async def delete_draft_order(self, draft_order_id: str) -> str:
    mutation = """
    mutation draftOrderDelete($id: ID!) {
        draftOrderDelete(id: $id) {
            deletedDraftOrderId
            userErrors { field message }
        }
    }
    """
    data = await self._execute_query(mutation, {"id": draft_order_id})
    result = data.get("data", {}).get("draftOrderDelete", {})
    # validar userErrors, retornar deletedDraftOrderId
```

**`cancel_order`:**
```python
async def cancel_order(
    self, order_id: str, reason: str, restock: bool,
    notify_customer: bool, refund_method: str | None, staff_note: str | None
) -> dict[str, Any]:
    mutation = """
    mutation orderCancel($id: ID!, $cancelInput: OrderCancelInput!) {
        orderCancel(id: $id, cancelInput: $cancelInput) {
            order { id status }
            userErrors { field message }
        }
    }
    """
    refund_policy_map = {
        "original": "ORIGINAL_PAYMENT_METHOD",
        "store_credit": "STORE_CREDIT",
        "later": "MANUAL",
    }
    cancel_input = {
        "reason": reason,  # CUSTOMER | DECLINED | FRAUD | INVENTORY | STAFF | OTHER
        "restock": restock,
        "notifyCustomer": notify_customer,
        "refundPolicy": refund_policy_map.get(refund_method, "MANUAL"),
    }
    if staff_note:
        cancel_input["staffNote"] = staff_note

    data = await self._execute_query(mutation, {"id": order_id, "cancelInput": cancel_input})
    # validar userErrors, retornar resultado
```

#### Definición de Completado
- ✅ Ambos métodos implementados
- ✅ `_execute_query` reutilizado (no hay llamadas HTTP directas)
- ✅ Mapeo de refund_method correcto
- ✅ Tests unitarios cubren éxito y userErrors

---

### US-OC-003: Backend - Servicio EcommerceService.cancel_order()

**Como** desarrollador del sistema
**Quiero** agregar la lógica de cancelación al servicio unificado de ecommerce
**Para** tener un punto de entrada único que enruta según la plataforma y estado

#### Criterios de Aceptación
- [x] Método `cancel_order(db, order, cancel_data)` existe en `EcommerceService`
- [x] Guard: lanza `ValueError` si `order.status == "Cancelado"`
- [x] Enruta correctamente según plataforma y estado:
  - Shopify draft (`!validado` + `shopify_draft_order_id`) → `_cancel_shopify_draft()`
  - Shopify completado (`validado` + `shopify_order_id`) → `_cancel_shopify_order()`
  - WooCommerce (`woocommerce_order_id`) → `_cancel_woocommerce()`
- [x] Obtiene token via `shopify_token_manager` para métodos Shopify
- [x] Actualiza status local a `"Cancelado"`
- [x] Si existe `staff_note`, la guarda en campo `notes` (se agrega al notes existente si hay)
- [x] Retorna el order actualizado
- [x] Maneja errores de cada plataforma (re-raise para que el endpoint los capture)

#### Tareas Técnicas
Agregar en `apps/backend/app/services/ecommerce.py`:

```python
async def cancel_order(self, db: Session, order: Order, cancel_data: "OrderCancel") -> Order:
    # 1. Guard
    if order.status == "Cancelado":
        raise ValueError(f"Order {order.id} is already cancelled")

    # 2. Get tenant + settings
    tenant = order.tenant
    settings = tenant.get_settings()

    # 3. Enruta según plataforma y estado
    if order.source_platform == "shopify":
        if not order.validado:
            await self._cancel_shopify_draft(db, order, settings.ecommerce.shopify)
        else:
            await self._cancel_shopify_order(db, order, settings.ecommerce.shopify, cancel_data)
    elif order.source_platform == "woocommerce":
        await self._cancel_woocommerce(order, settings.ecommerce.woocommerce)

    # 4. Update local
    update_data = {"status": "Cancelado"}
    if cancel_data.staff_note:
        existing_notes = order.notes or ""
        update_data["notes"] = f"{existing_notes}\n[Cancelación] {cancel_data.staff_note}".strip()

    return order_repository.update(db, db_obj=order, obj_in=update_data)
```

Helpers privados:
- `_cancel_shopify_draft`: obtiene token, llama `client.delete_draft_order(order.shopify_draft_order_id)`
- `_cancel_shopify_order`: obtiene token, llama `client.cancel_order(order.shopify_order_id, ...)` pasando todos los campos de `cancel_data`
- `_cancel_woocommerce`: instancia `WooCommerceClient`, llama `update_order_status(order.woocommerce_order_id, "cancelled")`

#### Definición de Completado
- ✅ Guard funciona (no se puede cancelar dos veces)
- ✅ Cada plataforma/estado enruta correctamente
- ✅ Staff note se persiste en notes
- ✅ Token refresh funciona para Shopify
- ✅ Tests unitarios cubren los tres caminos

---

### US-OC-004: Backend - Endpoint POST /orders/{id}/cancel

**Como** usuario con rol ADMIN o VENTAS
**Quiero** poder cancelar un pedido llamando al endpoint
**Para** sincronizar la cancelación con la plataforma de ecommerce

#### Criterios de Aceptación
- [x] Endpoint `POST /orders/{order_id}/cancel` existe en `orders.py`
- [x] Autenticación: `require_permission_dual("POST", "/orders/*/cancel")`
- [x] Retorna 404 si la orden no existe
- [x] Retorna 403 si el pedido no pertenece al tenant del usuario (excepto SUPERADMIN)
- [x] Retorna 400 si el pedido ya está cancelado
- [x] Retorna 400 si hay error de coherencia (ej: platform mismatch)
- [x] Retorna 401 si credenciales de WooCommerce inválidas
- [x] Retorna 502 si error genérico de la API externa
- [x] Retorna 200 con `OrderResponse` actualizado en éxito

#### Tareas Técnicas
Agregar en `apps/backend/app/api/v1/endpoints/orders.py` después del endpoint `/validate`:

```python
@router.post("/{order_id}/cancel", response_model=OrderResponse, tags=["orders"])
async def cancel_order(
    order_id: int,
    cancel_data: OrderCancel,
    current_user: User = Depends(require_permission_dual("POST", "/orders/*/cancel")),
    db: Session = Depends(get_database),
) -> OrderResponse:
    # 1. Fetch order → 404
    # 2. Tenant check → 403 (non-SUPERADMIN)
    # 3. Guard: status == "Cancelado" → 400
    # 4. ecommerce_service.cancel_order(db, order, cancel_data)
    # 5. Exception handling (mirror validate endpoint)
```

Importar `OrderCancel` en la sección de imports del archivo.

#### Definición de Completado
- ✅ Endpoint accesible y documentado en Swagger
- ✅ Todos los HTTP status codes retornados correctamente
- ✅ Tests del endpoint cubren éxito y todos los errores

---

### US-OC-005: Backend - Permisos

**Como** administrador del sistema
**Quiero** controlar quién puede cancelar pedidos mediante roles
**Para** mantener la seguridad y control de acceso

#### Criterios de Aceptación
- [x] Existe entrada `("POST", "/orders/*/cancel")` en `PERMISSIONS`
- [x] Roles permitidos: `SUPERADMIN`, `ADMIN`, `VENTAS`
- [x] Roles NO permitidos: `LOGISTICA`, `VIEWER`

#### Tareas Técnicas
Agregar en `apps/backend/app/core/permissions.py` después de la línea de validate:

```python
("POST", "/orders/*/cancel"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
```

#### Definición de Completado
- ✅ Permiso registrado
- ✅ LOGISTICA y VIEWER reciben 403 al intentar cancelar
- ✅ Test de permisos pasa

---

### US-OC-006: Frontend - Servicio y API Route

**Como** desarrollador frontend
**Quiero** tener la función `cancelOrder()` y la ruta API proxy configuradas
**Para** poder llamar al backend de forma segura desde el cliente

#### Criterios de Aceptación
- [x] Interface `OrderCancelRequest` definida en `order-service.ts`
- [x] Función `cancelOrder(accessToken, orderId, data)` implementada en service
- [x] Ruta `POST /api/orders/[id]/cancel` existe en Next.js
- [x] La ruta obtiene token via `getAccessToken()` y delega a `cancelOrder()`
- [x] Errores del backend se propagan correctamente
- [x] Capa `api-client` implementada según `API_ARCHITECTURE.md` (ver nota)

#### Tareas Técnicas

> **Nota:** La implementación original no contemplaba la arquitectura híbrida definida en `API_ARCHITECTURE.md`. Se agregó la capa `api-client` obligatoria para que los Client Components no llamen al backend ni expongan tokens. El flujo real es:
> ```
> Client Component → api-client/orders.ts → /api/orders/[id]/cancel (route) → services/order-service.ts → Backend
> ```

**En `apps/frontend/lib/services/order-service.ts`** (capa service, usada por la API Route):

```typescript
export interface OrderCancelRequest {
  reason: string;
  restock?: boolean;
  notify_customer?: boolean;
  refund_method?: string | null;
  staff_note?: string | null;
}

export async function cancelOrder(
  accessToken: string,
  orderId: number,
  data: OrderCancelRequest
): Promise<Order> { /* llama a POST /api/v1/orders/:id/cancel */ }
```

**En `apps/frontend/lib/api-client/orders.ts`** (capa client, usada por Client Components):

```typescript
export interface CancelOrderRequest {
  reason: string;
  restock?: boolean;
  notify_customer?: boolean;
  refund_method?: string | null;
  staff_note?: string | null;
}

export async function cancelOrder(orderId: number, data: CancelOrderRequest): Promise<Order> {
  return apiPost<Order>(`/api/orders/${orderId}/cancel`, data);
}
```

> Exportado automáticamente desde `@/lib/api-client` vía `index.ts` (`export * from './orders'`).

**Nuevo archivo `apps/frontend/app/api/orders/[id]/cancel/route.ts`** (proxy seguro):

- Export `POST` handler (patrón de `validate/route.ts`)
- `getAccessToken()` → si null → 401
- Parsear `id` de params, body del request
- Llamar `cancelOrder(token, orderId, body)` del service
- Retornar JSON / capturar errores

#### Definición de Completado
- ✅ Interface y función compilan sin errores
- ✅ Ruta API accesible desde el cliente
- ✅ Build de frontend sin errores: `pnpm build`

---

### US-OC-007: Frontend - Diálogo de Cancelación

**Como** usuario del sistema
**Quiero** ver un diálogo con las opciones de cancelación al hacer clic en "Cancelar Pedido"
**Para** poder proporcionar el motivo y opciones antes de confirmar

#### Criterios de Aceptación
- [x] Componente `CancelOrderDialog` existe en `components/dashboard/orders/`
- [x] Se abre al hacer clic en el elemento `trigger` que se pase como prop
- [x] Muestra dropdown de motivos (6 opciones en español, valores del enum de Shopify)
- [x] Para pedidos Shopify completados (`validado && shopify_order_id`): muestra Select de método de reembolso, checkbox de reposición de inventario, checkbox de notificación al cliente
- [x] Para drafts y WooCommerce: esos campos **no** se muestran
- [x] Tiene textarea para nota del personal (opcional)
- [x] Botones en footer: "Mantener pedido" (cierra diálogo) y "Cancelar pedido" (rojo, confirma)
- [x] Muestra estado de carga ("Cancelando...") durante la llamada
- [x] Muestra error si la llamada falla
- [x] Al confirmar exitosamente, llama al callback `onCancelled`

#### Tareas Técnicas

> **Nota:** `RadioGroup` no existe en `components/ui/` ni está disponible como paquete. El método de reembolso se implementó con `Select` (mismo patrón que el motivo). Además, por `API_ARCHITECTURE.md`, el submit usa `cancelOrder` de `@/lib/api-client` en lugar de `fetch` directo.

Archivo creado: `apps/frontend/components/dashboard/orders/cancel-order-dialog.tsx`

- Props: `{ order, trigger, onCancelled }`
- `trigger` se pasa a `DialogTrigger` con `asChild` para que cualquier elemento funcione como disparador
- Estado interno: `open`, `reason`, `refundMethod`, `restock`, `notifyCustomer`, `staffNote`, `isLoading`, `error`
- `isCompletedShopify = order.validado && order.shopify_order_id !== null` controla la visibilidad de los campos de reembolso/reposición/notificación
- Estado se resetea al abrir el diálogo (`handleOpenChange`)
- Submit: llama a `cancelOrder(order.id, data)` de `@/lib/api-client`, en éxito cierra diálogo y ejecuta `onCancelled()`

#### Definición de Completado
- ✅ Diálogo se abre y cierra correctamente
- ✅ Campos condicionales se muestran/ocultan según el tipo de pedido
- ✅ Validación del motivo (obligatorio)
- ✅ Estado de carga funciona
- ✅ Error se muestra si la llamada falla
- ✅ Callback `onCancelled` se ejecuta tras éxito

---

### US-OC-008: Frontend - Botón "Cancelar Pedido" en Order Detail

**Como** usuario del sistema
**Quiero** ver el botón "Cancelar Pedido" en el detalle de la orden
**Para** poder iniciar la cancelación desde la vista de detalle

#### Criterios de Aceptación
- [x] El botón "Cancelar Pedido" (rojo, destructive) aparece en el header de la orden
- [x] El botón **no** aparece cuando `order.status === 'Cancelado'`
- [x] Al hacer clic, abre el `CancelOrderDialog`
- [x] El botón X/"Cancelar" actual (que solo navega de vuelta a la lista) se reemplaza por este botón — el ArrowLeft del header ya cumple la función de "volver"
- [x] Tras cancelación exitosa, la página se actualiza y muestra el badge "Cancelado"

#### Tareas Técnicas
Modificar `apps/frontend/components/dashboard/orders/order-detail.tsx`:

1. Importar `CancelOrderDialog` y el icono `Ban` de lucide-react.
2. Reemplazar el botón destructivo actual (líneas 181–184, que hace `router.push('/dashboard/orders')`) por:

```tsx
{order.status !== 'Cancelado' && (
  <CancelOrderDialog
    order={order}
    onCancelled={() => router.refresh()}
    trigger={
      <Button variant="destructive" className="gap-2 text-xs sm:text-sm" size="sm">
        <Ban className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Cancelar Pedido</span>
      </Button>
    }
  />
)}
```

#### Definición de Completado
- ✅ Botón aparece solo cuando el pedido no está cancelado
- ✅ Clic abre el diálogo
- ✅ Tras cancelación exitosa, page se refresh y muestra "Cancelado"
- ✅ Build de frontend sin errores

---

### US-OC-009: Tests Backend

**Como** desarrollador del sistema
**Quiero** tener tests que cubran los flujos de cancelación
**Para** garantizar que no hay regresiones

#### Criterios de Aceptación
- [ ] Test: cancelar draft order Shopify → status "Cancelado", mock de `delete_draft_order` llamado con el `shopify_draft_order_id`
- [ ] Test: cancelar orden completada Shopify → status "Cancelado", mock de `cancel_order` llamado con todos los parámetros (incluyendo reason con valores del enum correcto)
- [ ] Test: cancelar orden WooCommerce → status "Cancelado", mock de `update_order_status` llamado con `"cancelled"`
- [ ] Test: cancelar pedido ya cancelado → 400
- [ ] Test: cancelar pedido no encontrado → 404
- [ ] Test: cancelar pedido de otro tenant → 403
- [ ] Todos los tests pasan: `uv run pytest`

#### Tareas Técnicas
Crear `apps/backend/tests/api/test_order_cancel.py` siguiendo los patrones de fixtures y mocks existentes en el proyecto (ver otros archivos en `tests/api/`).

#### Definición de Completado
- ✅ Todos los tests pasan
- ✅ Suite completa pasa: `uv run pytest` sin fallos
- ✅ `uv run ruff check .` sin errores

---

## Orden de Implementación

**Fase 1: Backend - Base (US-OC-001, US-OC-005)**
1. US-OC-001: Schema `OrderCancel`
2. US-OC-005: Permiso en `permissions.py`

**Fase 2: Backend - Integración (US-OC-002, US-OC-003, US-OC-004)**
3. US-OC-002: Métodos GraphQL en `ShopifyClient`
4. US-OC-003: `EcommerceService.cancel_order()`
5. US-OC-004: Endpoint `POST /cancel`

**Fase 3: Frontend (US-OC-006, US-OC-007, US-OC-008)**
6. US-OC-006: Servicio + ruta API
7. US-OC-007: Diálogo de cancelación
8. US-OC-008: Botón en order detail

**Fase 4: Tests (US-OC-009)**
9. US-OC-009: Tests backend

---

## Verificación End-to-End

```bash
# Backend
cd apps/backend
uv run pytest tests/api/test_order_cancel.py -v
uv run pytest                  # suite completa
uv run ruff check .

# Frontend
cd apps/frontend
pnpm build                     # compilación sin errores
```

**Manual:**
1. Abrir un draft order pendiente → clic "Cancelar Pedido" → seleccionar motivo → confirmar → badge "Cancelado", botón desaparece.
2. Abrir una orden validada de Shopify → diálogo muestra campos de reembolso/reposición/notificación → confirmar → "Cancelado".
3. Abrir una orden de WooCommerce → diálogo solo con motivo + nota → confirmar → "Cancelado".
4. Intentar cancelar una orden ya cancelada → botón no aparece.

---

## Archivos Modificados

### Backend
- `apps/backend/app/schemas/order.py` — agregar `OrderCancel`
- `apps/backend/app/integrations/shopify_client.py` — agregar `delete_draft_order()` y `cancel_order()`
- `apps/backend/app/services/ecommerce.py` — agregar `cancel_order()` y helpers
- `apps/backend/app/api/v1/endpoints/orders.py` — agregar endpoint `/cancel`
- `apps/backend/app/core/permissions.py` — agregar permiso

### Frontend
- `apps/frontend/lib/services/order-service.ts` — agregar `OrderCancelRequest` + `cancelOrder()` (capa service)
- `apps/frontend/lib/api-client/orders.ts` — agregar `CancelOrderRequest` + `cancelOrder()` (capa client, según `API_ARCHITECTURE.md`)
- `apps/frontend/app/api/orders/[id]/cancel/route.ts` — **nuevo archivo** (API Route proxy)
- `apps/frontend/components/dashboard/orders/cancel-order-dialog.tsx` — **nuevo archivo** (pendiente US-OC-007)
- `apps/frontend/components/dashboard/orders/order-detail.tsx` — reemplazar botón (pendiente US-OC-008)

### Tests
- `apps/backend/tests/api/test_order_cancel.py` — **nuevo archivo**

---

## referencias

- [Shopify orderCancel mutation](https://shopify.dev/docs/api/admin-graphql/2025-01/mutations/ordercancelled)
- [Shopify draftOrderDelete mutation](https://shopify.dev/docs/api/admin-graphql/2025-01/mutations/draftorderdelete)
- [WooCommerce Orders API](https://woocommerce.github.io/woocommerce-rest-api-docs/#orders)
