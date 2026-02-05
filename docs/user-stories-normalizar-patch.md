# Historias de Usuario - Normalizar Updates a PATCH

> Estandarizar todos los endpoints de actualización parcial al método HTTP PATCH, tanto en backend como frontend.
> Corregir bugs en el sistema de permisos (`require_permission_dual`) y eliminar el uso de PUT para operaciones que son semánticament PATCH.

**Fecha**: 2026-02-04
**Versión**: 1.0

---

## Contexto

El proyecto tiene tres categorías de problemas con PATCH/PUT:

1. **Bug crítico (broken en producción):** `invoice_series.py` pasa `"PUT"` a `require_permission_dual` pero
   `permissions.py` solo tiene la entrada `("PATCH", "/invoice-series/*")`. El endpoint retorna 403 para todos los roles, siempre.
2. **Bug latente:** `invoices.ts` usa `apiPut` para llamar a una ruta Next.js que solo exporta un handler `PATCH` → 405 si se invoca.
3. **Inconsistencia semántica:** `orders.py` y `users.py` usan `@router.put` con schemas donde todos los campos son opcionales (semántica PATCH).
   El frontend envía `Partial<T>`. Es un update parcial implementado con el verbo equivocado.

### Cómo funciona `require_permission_dual`

```
@router.patch("/{serie_id}")                                    ← método HTTP real
    current_user = Depends(require_permission_dual("PUT", ...)) ← método que se busca en PERMISSIONS

# dentro de require_permission_dual:
    if not can_access(current_user.role, method, actual_path):  ← usa el "method" que le pasó el endpoint
        raise 403
```

El `method` que le pasa cada endpoint debe coincidir exactamente con la clave en la tabla `PERMISSIONS`.
Si hay mismatch → 403 siempre, independientemente del rol.

### Estado actual vs objetivo

| Recurso       | Decorator backend | Arg permission | Entrada permissions.py     | Frontend método |
|---------------|-------------------|----------------|----------------------------|-----------------|
| Orders        | `@router.put`     | `"PUT"`        | `("PUT", "/orders/*")`     | PUT             |
| Users         | `@router.put`     | `"PUT"`        | `("PUT", "/users/*")`      | PUT→backend     |
| Tenants       | `@router.patch`   | `"PUT"` ← bug  | `("PUT", "/tenants/*")`    | PATCH           |
| Inv. Series   | `@router.patch`   | `"PUT"` ← BUG  | `("PATCH", "/inv-series/")` | PATCH           |
| API Keys      | `@router.patch`   | `"PATCH"` ✓   | `("PATCH", "/api-keys/*")` | PATCH ✓         |

Todo debe quedarse como API Keys: decorator PATCH, permission `"PATCH"`, tabla PATCH, frontend PATCH.

### Reglas de negocio que no cambian

- Los schemas de update (`OrderUpdate`, `UserUpdate`, `TenantUpdate`, `InvoiceSerieUpdate`) todos tienen campos opcionales. No se modifica ningún schema.
- Los roles permitidos por cada endpoint no cambian. Solo cambia la clave del método en la tabla de permisos.
- La lógica de negocio dentro de los servicios no se toca.
- Las operaciones DELETE se mantienen exactamente como están.

---

## Épica: Normalizar Updates a PATCH

---

### US-NP-001: Backend — Actualizar tabla PERMISSIONS centralizada

**Como** desarrollador del sistema
**Quiero** que la tabla `PERMISSIONS` use `PATCH` para todos los endpoints de update parcial
**Para** que el sistema de permisos refleje los métodos HTTP reales que los endpoints exponen

#### Criterios de Aceptación
- [ ] La entrada `("PUT", "/orders/*")` se cambia a `("PATCH", "/orders/*")` con roles `[SUPERADMIN, ADMIN, VENTAS]`
- [ ] La entrada `("PUT", "/users/*")` se cambia a `("PATCH", "/users/*")` con roles `[SUPERADMIN, ADMIN]`
- [ ] La entrada `("PUT", "/tenants/*")` se cambia a `("PATCH", "/tenants/*")` con rol `[SUPERADMIN]`
- [ ] Las entradas existentes de `("PATCH", "/invoice-series/*")` y `("PATCH", "/api-keys/*")` no se tocan
- [ ] No se agrega ni elimina ningún otro método ni path

#### Tareas Técnicas
Archivo: `apps/backend/app/core/permissions.py`

```python
# ANTES (líneas 25, 34, 41):
("PUT", "/orders/*"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
("PUT", "/users/*"): [Role.SUPERADMIN, Role.ADMIN],
("PUT", "/tenants/*"): [Role.SUPERADMIN],

# DESPUÉS:
("PATCH", "/orders/*"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
("PATCH", "/users/*"): [Role.SUPERADMIN, Role.ADMIN],
("PATCH", "/tenants/*"): [Role.SUPERADMIN],
```

#### Definición de Completado
- ✅ Solo las tres entradas PUT indicadas cambian a PATCH
- ✅ Los roles asociados no cambian
- ✅ `uv run ruff check .` sin errores

---

### US-NP-002: Backend — Fix bug crítico en endpoint invoice series

**Como** usuario con rol ADMIN
**Quiero** poder editar la descripción y estado de una serie de facturación
**Para** que la funcionalidad que ya existe en el UI realmente funcione (actualmente retorna 403 siempre)

#### Criterios de Aceptación
- [ ] El endpoint `PATCH /api/v1/invoice-series/{serie_id}` responde 200 cuando un ADMIN actualiza su propia serie
- [ ] El endpoint responde 200 cuando un SUPERADMIN actualiza cualquier serie
- [ ] El decorator `@router.patch` no se modifica (ya es correcto)
- [ ] El argumento de `require_permission_dual` es `"PATCH"` (actualmente es `"PUT"`, que causa el 403)

#### Tareas Técnicas
Archivo: `apps/backend/app/api/v1/endpoints/invoice_series.py`, línea 347

```python
# ANTES:
current_user: User = Depends(require_permission_dual("PUT", "/invoice-series/*")),

# DESPUÉS:
current_user: User = Depends(require_permission_dual("PATCH", "/invoice-series/*")),
```

Un solo string cambia. El decorator `@router.patch` y todo lo demás ya está correcto.

#### Definición de Completado
- ✅ El string en `require_permission_dual` es `"PATCH"`
- ✅ Coincide con la entrada existente `("PATCH", "/invoice-series/*")` en `permissions.py`
- ✅ Verificación manual: `curl -X PATCH` retorna 401 (no token) en lugar de 403

---

### US-NP-003: Backend — Fix mismatch en endpoint tenants

**Como** SUPERADMIN
**Quiero** que el permiso del endpoint de update de tenants use el método correcto
**Para** que el código sea consistente y no se rompa si alguien refactoriza `permissions.py`

#### Criterios de Aceptación
- [ ] El argumento de `require_permission_dual` en el endpoint PATCH de tenants es `"PATCH"`
- [ ] El decorator `@router.patch` no se modifica (ya es correcto)
- [ ] El endpoint sigue funcionando para SUPERADMIN (actualmente funciona por casualidad porque `("PUT", "/tenants/*")` existe)
- [ ] Después del cambio, depende de la entrada `("PATCH", "/tenants/*")` que se crea en US-NP-001

#### Tareas Técnicas
Archivo: `apps/backend/app/api/v1/endpoints/tenants.py`, línea 210

```python
# ANTES:
current_user: User = Depends(require_permission_dual("PUT", "/tenants/*")),

# DESPUÉS:
current_user: User = Depends(require_permission_dual("PATCH", "/tenants/*")),
```

**Dependencia:** US-NP-001 debe ejecutarse al mismo tiempo (la entrada `("PATCH", "/tenants/*")` en permissions.py es necesaria).

#### Definición de Completado
- ✅ El string en `require_permission_dual` es `"PATCH"`
- ✅ SUPERADMIN puede seguir actualizando tenants
- ✅ El endpoint no depende ya de una entrada `PUT` en permissions.py

---

### US-NP-004: Backend — Migrar endpoint orders de PUT a PATCH

**Como** usuario con rol VENTAS o ADMIN
**Quiero** que la actualización de orders use PATCH
**Para** que el método HTTP refleje la operación real (update parcial) y sea consistente con el resto del sistema

#### Criterios de Aceptación
- [ ] El decorator del endpoint de update es `@router.patch("/{order_id}", ...)`
- [ ] El argumento de `require_permission_dual` es `"PATCH"`
- [ ] El endpoint responde 200 a una request PATCH con datos parciales
- [ ] El endpoint retorna 405 a una request PUT (el verbo PUT ya no existe en este path)
- [ ] Los roles permitidos no cambian: SUPERADMIN, ADMIN, VENTAS

#### Tareas Técnicas
Archivo: `apps/backend/app/api/v1/endpoints/orders.py`, línea 281

```python
# ANTES:
@router.put("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(require_permission_dual("PUT", "/orders/*")),
    ...

# DESPUÉS:
@router.patch("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/orders/*")),
    ...
```

**Dependencia:** US-NP-001 debe ejecutarse al mismo tiempo (la entrada `("PATCH", "/orders/*")` en permissions.py es necesaria).

#### Definición de Completado
- ✅ Decorator es `@router.patch`
- ✅ Permission arg es `"PATCH"`
- ✅ `OrderUpdate` schema no se modifica
- ✅ Toda la lógica del endpoint (tenant check, service call) no se modifica

---

### US-NP-005: Backend — Migrar endpoint users de PUT a PATCH

**Como** usuario con rol ADMIN o SUPERADMIN
**Quiero** que la actualización de users use PATCH
**Para** que sea consistente con el estándar del proyecto y el método refleje la operación

#### Criterios de Aceptación
- [ ] El decorator del endpoint de update es `@router.patch("/{user_id}", ...)`
- [ ] El argumento de `require_permission_dual` es `"PATCH"`
- [ ] El endpoint responde 200 a una request PATCH con datos parciales
- [ ] El endpoint retorna 405 a una request PUT
- [ ] Los roles permitidos no cambian: SUPERADMIN, ADMIN
- [ ] La lógica de sync con Auth0 (block/unblock) no se modifica

#### Tareas Técnicas
Archivo: `apps/backend/app/api/v1/endpoints/users.py`, línea 138

```python
# ANTES:
@router.put("/{user_id}", response_model=UserUpdateResponse, tags=["users"])
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_permission_dual("PUT", "/users/*")),
    ...

# DESPUÉS:
@router.patch("/{user_id}", response_model=UserUpdateResponse, tags=["users"])
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/users/*")),
    ...
```

**Dependencia:** US-NP-001 debe ejecutarse al mismo tiempo.

#### Definición de Completado
- ✅ Decorator es `@router.patch`
- ✅ Permission arg es `"PATCH"`
- ✅ `UserUpdate` schema no se modifica
- ✅ Response `UserUpdateResponse` (con campo `warning`) no se modifica
- ✅ Lógica Auth0 sync no se modifica

---

### US-NP-006: Frontend — Normalizar capa api-client a PATCH

**Como** desarrollador frontend
**Quiero** que las funciones del api-client usen `apiPatch` para updates parciales
**Para** que las llamadas desde los componentes Cliente coincidan con los métodos que los endpoints Next.js exponen

#### Criterios de Aceptación
- [ ] `orders.ts`: `updateOrder` usa `apiPatch` en lugar de `apiPut`
- [ ] `invoices.ts`: `updateInvoiceSerie` usa `apiPatch` en lugar de `apiPut` (bug latente corregido)
- [ ] `superadmin.ts`: `updateUser` usa `apiPatch` en lugar de `apiPut`
- [ ] Los imports se actualizan: donde se removió `apiPut` se agrega `apiPatch`; donde `apiPut` ya no se usa se elimina del import
- [ ] Los comentarios JSDoc se actualizan de `PUT` a `PATCH` en las funciones afectadas
- [ ] `apiPut` en `client.ts` no se elimina (es una utilidad general)

#### Tareas Técnicas

**`apps/frontend/lib/api-client/orders.ts`:**
- Línea 10: `import { apiGet, apiPost, apiPut }` → `import { apiGet, apiPost, apiPatch }`
- Línea 55: comentario `PUT /api/orders/:id` → `PATCH /api/orders/:id`
- Línea 60: `return apiPut<Order>(...)` → `return apiPatch<Order>(...)`

**`apps/frontend/lib/api-client/invoices.ts`:**
- Línea 10: `import { apiGet, apiPost, apiPut, apiDelete, apiDownload }` → `import { apiGet, apiPost, apiPatch, apiDelete, apiDownload }`
- Línea 101: comentario `PUT /api/invoice-series/:id` → `PATCH /api/invoice-series/:id`
- Línea 107: `return apiPut<InvoiceSerie>(...)` → `return apiPatch<InvoiceSerie>(...)`

**`apps/frontend/lib/api-client/superadmin.ts`:**
- Línea 10: `import { apiGet, apiPost, apiPut, apiPatch }` → `import { apiGet, apiPost, apiPatch }` (remover `apiPut`)
- Línea 92: comentario `PUT /api/superadmin/tenants/:id` → `PATCH /api/superadmin/tenants/:id`
- Línea 143: comentario `PUT /api/superadmin/users/:id` → `PATCH /api/superadmin/users/:id`
- Línea 148: `return apiPut(...)` → `return apiPatch(...)`

#### Definición de Completado
- ✅ Ninguna función del api-client usa `apiPut` para updates
- ✅ `pnpm build` compila sin errores (detecta imports huérfanos)
- ✅ Comentarios JSDoc coinciden con el método real

---

### US-NP-007: Frontend — Normalizar servicio order-service y API routes de orders

**Como** desarrollador frontend
**Quiero** que el servicio `order-service.ts` y la ruta API de orders usen PATCH
**Para** que la cadena completa desde el componente hasta el backend use un solo método

#### Criterios de Aceptación
- [ ] `order-service.ts`: la función `updateOrder` envía `method: 'PATCH'` al backend
- [ ] `app/api/orders/[id]/route.ts`: el handler se renombra de `PUT` a `PATCH`
- [ ] El comentario del archivo se actualiza de `PUT /api/orders/:id` a `PATCH /api/orders/:id`
- [ ] La lógica interna del handler (parseo de id, llamada a `updateOrder` del servicio) no se modifica

#### Tareas Técnicas

**`apps/frontend/lib/services/order-service.ts`**, línea 138:
```typescript
// ANTES:
method: 'PUT',

// DESPUÉS:
method: 'PATCH',
```

**`apps/frontend/app/api/orders/[id]/route.ts`:**
- Líneas 3-5: comentario `PUT /api/orders/:id` → `PATCH /api/orders/:id`
- Línea 42: `export async function PUT(` → `export async function PATCH(`

#### Definición de Completado
- ✅ `order-service.ts` envía PATCH
- ✅ La ruta Next.js exporta `PATCH` (no `PUT`)
- ✅ `pnpm build` sin errores

---

### US-NP-008: Frontend — Normalizar API route y componentes de users

**Como** desarrollador frontend
**Quiero** que la ruta API de users y los componentes que la usan envíen PATCH al backend
**Para** que la cadena completa sea consistente y el handler PUT huérfano desaparezca

#### Criterios de Aceptación
- [ ] `app/api/superadmin/users/[id]/route.ts`: el handler `PUT` (líneas 12-42) se elimina completamente
- [ ] El handler `PATCH` existente (línea 115) cambia la llamada al backend de `method: 'PUT'` a `method: 'PATCH'`
- [ ] El comentario obsoleto dentro del PATCH handler (`// PUT to /users/:id...`) se elimina
- [ ] `toggle-user-status-dialog.tsx`: el caso de activación cambia de `method: "PUT"` a `method: "PATCH"`
- [ ] El comentario `// Activar (PUT)` se actualiza a `// Activar (PATCH)`
- [ ] El componente `edit-user-dialog.tsx` no se modifica (ya envía PATCH al handler correcto)

#### Tareas Técnicas

**`apps/frontend/app/api/superadmin/users/[id]/route.ts`:**

Eliminar todo el bloque del handler PUT (líneas 7-42, incluyendo el comentario JSDoc):
```typescript
// ELIMINAR TODO ESTO:
/**
 * PUT /api/superadmin/users/[id]
 * Activate user (is_active: true)
 * Requires SUPER_ADMIN role
 */
export async function PUT(req: Request, ...) {
  ...
}
```

En el handler PATCH (línea 115), dos cambios:
```typescript
// ELIMINAR este comentario (línea 127):
// PUT to /users/:id to update user information (backend uses PUT, not PATCH)

// CAMBIAR (línea 129):
method: 'PUT',  →  method: 'PATCH',
```

**`apps/frontend/components/superadmin/toggle-user-status-dialog.tsx`**, líneas 31-33:
```typescript
// ANTES:
// Activar (PUT)
response = await fetch(`/api/superadmin/users/${user.id}`, {
  method: "PUT",

// DESPUÉS:
// Activar (PATCH)
response = await fetch(`/api/superadmin/users/${user.id}`, {
  method: "PATCH",
```

#### Definición de Completado
- ✅ No existe handler `PUT` exportado en la ruta de users
- ✅ El handler `PATCH` llama al backend con `method: 'PATCH'`
- ✅ `toggle-user-status-dialog` envía PATCH para activar
- ✅ `pnpm build` sin errores

---

### US-NP-009: Frontend — Fix colateral en ruta invoice-series (URL base)

**Como** desarrollador frontend
**Quiero** que la ruta API de invoice-series use la URL base correcta incluyendo `/api/v1`
**Para** que las llamadas al backend funcionen correctamente sin depender de que la env var esté seteada

#### Criterios de Aceptación
- [ ] El fallback de `API_BASE_URL` en `app/api/invoice-series/[id]/route.ts` incluye `/api/v1`
- [ ] Es consistente con otros archivos de rutas API (ej: `superadmin/tenants/[id]/route.ts` usa `http://localhost:8000/api/v1`)

#### Tareas Técnicas
Archivo: `apps/frontend/app/api/invoice-series/[id]/route.ts`, línea 4

```typescript
// ANTES:
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// DESPUÉS:
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
```

Este bug no tiene relación directa con PATCH/PUT pero está en el mismo archivo y causaría que el PATCH
de invoice-series falle en development si la env var no tiene `/api/v1`.

#### Definición de Completado
- ✅ El fallback incluye `/api/v1`
- ✅ Coincide con el patrón de las otras rutas API

---

## Orden de Implementación

Las historias se implementan en este orden exacto porque hay dependencias entre capas:

**Fase 1: Backend — fixes que no cambian permisos (safe, no side effects)**
1. US-NP-002 — Fix invoice_series (el string `"PATCH"` ya existe en permissions.py)

**Fase 2: Backend — cambios acoplados (permissions + endpoints juntos)**
2. US-NP-001 — permissions.py (prerequisito para los siguientes)
3. US-NP-003 — tenants.py (necesita la nueva entrada PATCH en permissions)
4. US-NP-004 — orders.py (necesita la nueva entrada PATCH en permissions)
5. US-NP-005 — users.py (necesita la nueva entrada PATCH en permissions)

> US-NP-001 a US-NP-005 deben ir en un mismo commit. Si permissions.py se deploya antes que los endpoints,
> orders y users se rompen temporalmente (buscan PUT que ya no existe). Si los endpoints se deployan antes,
> buscan PATCH que aún no existe.

**Fase 3: Frontend — normalización (puede ir en mismo o siguiente commit)**
6. US-NP-006 — api-client layer
7. US-NP-007 — order-service + route orders
8. US-NP-008 — route users + componentes
9. US-NP-009 — fix URL base invoice-series

---

## Verificación End-to-End

```bash
# Backend
cd apps/backend
uv run ruff check .           # linting
uv run pytest                 # suite completa (no hay tests de estos endpoints específicamente)

# Frontend
cd apps/frontend
pnpm build                    # compilación TypeScript — detecta imports huérfanos y type errors
```

**Verificación manual (en Docker, con datos de seed):**

1. **Invoice Series (bug crítico corregido):**
   - Login como ADMIN → Dashboard → Invoices → Series
   - Hacer clic en editar una serie → cambiar descripción → guardar
   - **Antes:** fallaba silenciosamente (403 del backend)
   - **Después:** se guarda correctamente

2. **Tenant update:**
   - Login como SUPERADMIN → SuperAdmin → Tenants → editar tenant
   - Cambiar nombre → guardar → se persiste

3. **User activate/deactivate:**
   - SUPERADMIN → SuperAdmin → Users → click toggle status de un usuario
   - Activar → funciona con PATCH
   - El handler PUT ya no existe en la ruta

4. **Verificar que PUT retorna 405 en los endpoints migrados:**
   ```bash
   # Desde shell del backend o con curl apuntando al servicio:
   curl -X PUT  http://localhost:8000/api/v1/orders/1   → 405 Method Not Allowed
   curl -X PUT  http://localhost:8000/api/v1/users/1    → 405 Method Not Allowed
   curl -X PATCH http://localhost:8000/api/v1/orders/1  → 401 (no token, pero confirma que PATCH existe)
   curl -X PATCH http://localhost:8000/api/v1/users/1   → 401
   ```

---

## Archivos Modificados

### Backend (5 archivos)
| Archivo | Líneas afectadas | Cambio |
|---|---|---|
| `apps/backend/app/core/permissions.py` | 25, 34, 41 | 3 entradas PUT → PATCH |
| `apps/backend/app/api/v1/endpoints/invoice_series.py` | 347 | String en `require_permission_dual` |
| `apps/backend/app/api/v1/endpoints/tenants.py` | 210 | String en `require_permission_dual` |
| `apps/backend/app/api/v1/endpoints/orders.py` | 281, 285 | Decorator + string en `require_permission_dual` |
| `apps/backend/app/api/v1/endpoints/users.py` | 138, 142 | Decorator + string en `require_permission_dual` |

### Frontend (8 archivos)
| Archivo | Líneas afectadas | Cambio |
|---|---|---|
| `apps/frontend/lib/api-client/orders.ts` | 10, 55, 60 | Import + comentario + llamada |
| `apps/frontend/lib/api-client/invoices.ts` | 10, 101, 107 | Import + comentario + llamada |
| `apps/frontend/lib/api-client/superadmin.ts` | 10, 92, 143, 148 | Import + comentarios + llamada |
| `apps/frontend/lib/services/order-service.ts` | 138 | `method: 'PUT'` → `'PATCH'` |
| `apps/frontend/app/api/orders/[id]/route.ts` | 3-5, 42 | Comentario + renombrar handler |
| `apps/frontend/app/api/superadmin/users/[id]/route.ts` | 7-42, 127, 129 | Eliminar handler PUT + fix PATCH |
| `apps/frontend/components/superadmin/toggle-user-status-dialog.tsx` | 31, 33 | Comentario + method |
| `apps/frontend/app/api/invoice-series/[id]/route.ts` | 4 | Fix URL base (`/api/v1`) |
