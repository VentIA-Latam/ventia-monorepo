# PLAN DE ACCIÓN - REVISIÓN SPRINT 3

---

## HISTORIAS A ACTUALIZAR EN CLICKUP

### HU-001: Unificar dependencia de autenticación y autorización (ACTUALIZAR)

**Título:** Como desarrollador, necesito una dependencia unificada que soporte JWT y API keys con validación centralizada de permisos

**Descripción:**

Actualmente existen 3 formas diferentes de validar permisos en los endpoints, lo que genera inconsistencias y duplicación de lógica:

| Dependencia | Soporta JWT | Soporta API Key | Valida Permisos |
|-------------|-------------|-----------------|-----------------|
| `get_current_user` | ✅ | ❌ | ❌ |
| `get_current_user_or_api_key` | ✅ | ✅ | ❌ |
| `require_permission` | ✅ | ❌ | ✅ |
| `require_role` | ✅ | ❌ | ✅ (solo rol) |

Se necesita una única dependencia `require_permission_dual` que:
- Soporte autenticación con JWT (Auth0) y API keys
- Valide roles contra la tabla centralizada PERMISSIONS
- Elimine la necesidad de validaciones manuales en cada endpoint

**Implementación técnica:**

```python
def require_permission_dual(method: str, path: str):
    """
    Dependencia unificada que:
    1. Autentica via JWT o API key (usando get_current_user_or_api_key)
    2. Obtiene el rol del usuario o API key
    3. Valida el rol contra tabla PERMISSIONS para method+path
    4. Retorna 403 si no tiene permiso
    5. Retorna current_user si tiene permiso
    """
    async def dependency(
        current_user: User = Depends(get_current_user_or_api_key),
        db: Session = Depends(get_database)
    ) -> User:
        if not has_permission(current_user.role, method, path):
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user
    return dependency
```

**Archivo a modificar:** `apps/backend/app/api/deps.py`

**Criterios de Aceptación:**
- [ ] Crear función `require_permission_dual(method, path)` en deps.py
- [ ] La función debe usar `get_current_user_or_api_key` internamente
- [ ] La función debe validar el rol contra tabla PERMISSIONS
- [ ] Debe retornar 403 si el rol no tiene permiso
- [ ] Debe retornar el `current_user` si tiene permiso
- [ ] Incluir pruebas unitarias para JWT y API key

**Tags:** backend

---

### HU-003: Migrar endpoints de facturas a dependencia unificada (ACTUALIZAR)

**Título:** Como desarrollador, necesito migrar los endpoints de facturas a usar require_permission_dual

**Descripción:**

Los endpoints de facturas actualmente usan `require_role` que no soporta API keys. Migrar a la dependencia unificada.

**NOTA DE ARQUITECTURA:**
Los paths actuales tienen inconsistencia semántica (el prefijo es `/invoices` pero reciben `order_id`). Esto se corregirá en HU-009.

**Endpoints a migrar:**

| Endpoint | Dependencia Actual | Dependencia Nueva |
|----------|-------------------|-------------------|
| `POST /invoices/{order_id}/invoice` | `require_role` | `require_permission_dual("POST", "/invoices")` |
| `GET /invoices/{order_id}/invoices` | `get_current_user` | `require_permission_dual("GET", "/invoices")` |
| `GET /invoices/` | `get_current_user` | `require_permission_dual("GET", "/invoices")` |
| `GET /invoices/{id}/pdf` | `get_current_user` | `require_permission_dual("GET", "/invoices/*")` |
| `GET /invoices/{id}/xml` | `get_current_user` | `require_permission_dual("GET", "/invoices/*")` |

**Archivo a modificar:** `apps/backend/app/api/v1/endpoints/invoices.py`

**Criterios de Aceptación:**
- [ ] Migrar todos los endpoints listados a `require_permission_dual`
- [ ] Verificar que funcione con JWT y API key
- [ ] Permisos: crear (SUPER_ADMIN, ADMIN, VENTAS), consultar (todos)

**Dependencia:** HU-001

**Tags:** backend

---

## HISTORIAS NUEVAS A CREAR EN CLICKUP

### HU-007: Completar CRUD de Invoice Series

**Título:** Como usuario del dashboard, necesito gestionar series de facturación completas

**Descripción:**

El frontend consume endpoints que no existen en el backend, causando errores 404.

**Estado actual:**

| Endpoint | Backend | Frontend |
|----------|---------|----------|
| `POST /invoice-series` | ✅ Existe | ✅ Funciona |
| `GET /invoice-series` | ✅ Existe | ✅ Funciona |
| `GET /invoice-series/{id}` | ❌ NO EXISTE | ❌ Error 404 |
| `PATCH /invoice-series/{id}` | ❌ NO EXISTE | ❌ Error 404 |
| `DELETE /invoice-series/{id}` | ❌ NO EXISTE | ❌ Error 404 |

#### TAREAS BACKEND

**Archivo:** `apps/backend/app/api/v1/endpoints/invoice_series.py`

**1. Crear GET /invoice-series/{id}**
```python
@router.get("/{serie_id}", response_model=InvoiceSerieResponse)
async def get_invoice_serie(serie_id: int, ...):
    """
    Obtener serie por ID.
    - SUPER_ADMIN: cualquier tenant
    - Otros: solo su tenant
    """
```

**2. Crear PATCH /invoice-series/{id}**
```python
@router.patch("/{serie_id}", response_model=InvoiceSerieResponse)
async def update_invoice_serie(serie_id: int, serie_update: InvoiceSerieUpdate, ...):
    """
    Actualizar serie.
    Campos actualizables: description, is_active
    Campos inmutables: serie, invoice_type, last_correlativo
    """
```

**3. Crear DELETE /invoice-series/{id}**
```python
@router.delete("/{serie_id}", status_code=204)
async def delete_invoice_serie(serie_id: int, ...):
    """
    Soft delete (is_active=False).
    No permite eliminar series con facturas emitidas.
    """
```

**4. Crear schema InvoiceSerieUpdate**

**Archivo:** `apps/backend/app/schemas/invoice.py`
```python
class InvoiceSerieUpdate(BaseModel):
    description: str | None = None
    is_active: bool | None = None
```

#### TAREAS FRONTEND (Verificación)

**Archivo:** `apps/frontend/lib/services/invoice-service.ts`

Verificar que las funciones existentes apunten a los endpoints correctos:
- `getInvoiceSerie(id)` → `GET /invoice-series/{id}`
- `updateInvoiceSerie(id, data)` → `PATCH /invoice-series/{id}`
- `deleteInvoiceSerie(id)` → `DELETE /invoice-series/{id}`

**Criterios de Aceptación:**
- [ ] Backend: GET /invoice-series/{id} implementado
- [ ] Backend: PATCH /invoice-series/{id} implementado
- [ ] Backend: DELETE /invoice-series/{id} implementado
- [ ] Backend: Schema InvoiceSerieUpdate creado
- [ ] Backend: Validación de permisos por tenant
- [ ] Backend: Tests unitarios
- [ ] Frontend: Verificar integración funciona sin errores 404

**Prioridad:** CRÍTICA

**Tags:** backend, frontend

---

### HU-008: Implementar endpoint de status de facturas eFact

**Título:** Como usuario del dashboard, necesito consultar el estado de mis facturas electrónicas en SUNAT

**Descripción:**

El endpoint `GET /invoices/{id}/status` está comentado en el backend (líneas 247-351). Las facturas quedan en estado "processing" indefinidamente.

**Estados válidos de efact_status:**
- `pending` - Factura creada, no enviada
- `processing` - Enviada a eFact, esperando respuesta
- `success` - Aceptada por SUNAT
- `error` - Rechazada por SUNAT

**Flujo correcto según documentación eFact:**

```
1. send_document() → retorna ticket (UUID)
2. Con el ticket, intentar descargar PDF
3. Si PDF disponible → status = "success"
4. Si error → status = "error" + guardar mensaje
```

#### TAREAS BACKEND

**Archivo:** `apps/backend/app/api/v1/endpoints/invoices.py`

**1. Descomentar y modificar endpoint status (líneas 247-351)**

```python
@router.get("/{invoice_id}/status", response_model=InvoiceResponse)
async def check_invoice_status(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> InvoiceResponse:
    """
    Verificar estado de factura en eFact.
    """
    # 1. Obtener factura
    invoice = invoice_repository.get(db, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    # 2. Validar acceso por tenant
    if current_user.role != Role.SUPER_ADMIN:
        if invoice.tenant_id != current_user.tenant_id:
            raise HTTPException(403, "Access denied")

    # 3. Validar que tenga ticket
    if not invoice.efact_ticket:
        raise HTTPException(400, "Invoice has no eFact ticket")

    # 4. Si ya está procesada, retornar sin consultar eFact
    if invoice.efact_status in ["success", "error"]:
        return InvoiceResponse.from_orm(invoice)

    # 5. Intentar descargar PDF (verifica estado en eFact)
    efact_client = EFactClient()
    try:
        pdf_bytes = efact_client.download_pdf(invoice.efact_ticket)

        # PDF disponible = success
        invoice.efact_status = "success"
        invoice.efact_processed_at = datetime.utcnow()

    except Exception as e:
        # Error al descargar = error
        invoice.efact_status = "error"
        invoice.efact_error = str(e)
        invoice.efact_processed_at = datetime.utcnow()

    # 6. Guardar y retornar
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return InvoiceResponse.from_orm(invoice)
```

#### TAREAS FRONTEND

**Archivo:** `apps/frontend/lib/services/invoice-service.ts`

Verificar que existe función para llamar al endpoint:
```typescript
export async function checkInvoiceStatus(invoiceId: number): Promise<Invoice> {
  const response = await fetch(`${API_URL}/invoices/${invoiceId}/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}
```

**Archivo:** `apps/frontend/components/dashboard/invoices/` (componentes de UI)

Verificar que la UI muestre correctamente los estados:
- `pending` → "Pendiente" (gris)
- `processing` → "Procesando" (amarillo/loading)
- `success` → "Aceptada" (verde)
- `error` → "Rechazada" (rojo) + mostrar `efact_error`

**Criterios de Aceptación:**
- [ ] Backend: Endpoint GET /invoices/{id}/status funcional
- [ ] Backend: Implementa flujo correcto (ticket → PDF → status)
- [ ] Backend: Status "success" si PDF disponible
- [ ] Backend: Status "error" si falla + guardar mensaje en efact_error
- [ ] Backend: No consulta eFact si ya está en "success" o "error"
- [ ] Backend: Tests unitarios con mocks de eFact
- [ ] Frontend: Verificar función checkInvoiceStatus existe
- [ ] Frontend: UI muestra estados correctamente con colores

**Prioridad:** CRÍTICA

**Tags:** backend, frontend, efact, sunat

---

### HU-009: Refactorizar paths de endpoints de invoices

**Título:** Como equipo de desarrollo, necesito refactorizar los paths de invoices para seguir convenciones REST

**Descripción:**

Los endpoints actuales usan prefijo `/invoices` pero operan sobre órdenes, causando confusión.

**Cambios propuestos:**

| Endpoint Actual | Endpoint Nuevo |
|-----------------|----------------|
| `POST /invoices/{order_id}/invoice` | `POST /orders/{order_id}/invoices` |
| `GET /invoices/{order_id}/invoices` | `GET /orders/{order_id}/invoices` |

Los demás endpoints de `/invoices` se mantienen igual porque operan sobre facturas.

**Estrategia de migración:**

```
FASE 1 - Backend:
├── Crear nuevos endpoints en orders.py
├── Mantener endpoints antiguos con header "Deprecation: true"
└── Log warning cuando se usen endpoints antiguos

FASE 2 - Frontend:
├── Actualizar invoice-service.ts
└── Cambiar URLs a nuevos endpoints

FASE 3 - Cleanup:
└── Eliminar endpoints deprecated del backend
```

#### TAREAS BACKEND

**Archivo:** `apps/backend/app/api/v1/endpoints/orders.py`

Agregar nuevos endpoints:
```python
@router.post("/{order_id}/invoices", response_model=InvoiceResponse)
async def create_invoice_for_order(order_id: int, invoice_data: InvoiceCreate, ...):
    # Misma lógica que POST /invoices/{order_id}/invoice
    pass

@router.get("/{order_id}/invoices", response_model=list[InvoiceResponse])
async def get_invoices_for_order(order_id: int, ...):
    # Misma lógica que GET /invoices/{order_id}/invoices
    pass
```

**Archivo:** `apps/backend/app/api/v1/endpoints/invoices.py`

Marcar endpoints antiguos como deprecated:
```python
@router.post("/{order_id}/invoice", deprecated=True)
async def create_invoice_for_order_deprecated(...):
    logger.warning("Deprecated endpoint used: POST /invoices/{order_id}/invoice")
    # ... lógica existente
```

#### TAREAS FRONTEND

**Archivo:** `apps/frontend/lib/services/invoice-service.ts`

Actualizar URLs:
```typescript
// ANTES
const response = await fetch(`${API_URL}/invoices/${orderId}/invoice`, ...);

// DESPUÉS
const response = await fetch(`${API_URL}/orders/${orderId}/invoices`, ...);
```

**Archivos de componentes que usan invoice-service:**
- `apps/frontend/app/dashboard/invoices/new/page.tsx`
- `apps/frontend/app/dashboard/orders/[id]/page.tsx`
- `apps/frontend/components/dashboard/invoices/`

Verificar que usen las funciones actualizadas del service.

**Criterios de Aceptación:**
- [ ] Backend: Nuevos endpoints bajo /orders/{id}/invoices creados
- [ ] Backend: Endpoints antiguos marcados deprecated con warning
- [ ] Frontend: invoice-service.ts actualizado con nuevas URLs
- [ ] Frontend: Componentes verificados que funcionan
- [ ] Tests actualizados
- [ ] Documentación actualizada

**Prioridad:** Media (próximo sprint)

**Dependencias:** HU-003 completada

**Tags:** backend, frontend, refactoring

---

## RESUMEN DE EJECUCIÓN

| Orden | Historia | Acción | Archivos Afectados |
|-------|----------|--------|-------------------|
| 1 | HU-001 | ACTUALIZAR | Backend: deps.py |
| 2 | HU-003 | ACTUALIZAR | Backend: invoices.py |
| 3 | HU-007 | CREAR | Backend: invoice_series.py, invoice.py (schema). Frontend: verificar invoice-service.ts |
| 4 | HU-008 | CREAR | Backend: invoices.py. Frontend: invoice-service.ts, componentes UI |
| 5 | HU-009 | CREAR | Backend: orders.py, invoices.py. Frontend: invoice-service.ts, componentes |

---

*Fecha: 2025-01-15*
