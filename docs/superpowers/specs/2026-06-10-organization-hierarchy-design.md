# Organization Hierarchy — Design

**Status:** Draft
**Date:** 2026-06-10
**Owner:** Renzo Lenes
**Related:**
- Cliente piloto: **Grupo Yes** (organización con varias marcas y sucursales).
- Habilita futuro: branding visual por marca, regiones (4to nivel), facturación con RUC por sucursal. **Estos quedan fuera del scope de este PR**.
- Patrón sincronización cross-DB: replicar el existente entre `tenants` (backend) y `accounts` (messaging).

## Resumen

Pasar el modelo multitenant de 2 niveles (`Tenant → Channel/Inbox`) a 3 niveles (`Tenant → Brand → Branch → Channel/Inbox`), de forma **opcional por tenant** vía flag `tenants.hierarchy_enabled`. Permite que clientes con varias marcas y sucursales (caso ancla: Grupo Yes) aíslen datos por marca y por sucursal sin romper a los tenants existentes, que siguen operando idénticos al modelo plano actual.

Scope de este PR: **modelo de datos + permisos + UI básica** (paneles admin de marcas/sucursales, selector de contexto en sidebar, filtrado en vistas existentes). El branding visual por marca (logos/colores en la UI completa) queda explícitamente fuera.

## Motivación

Hoy el modelo plano funciona para clientes con una sola marca operacional y una sola "identidad comercial". Falla cuando:

1. **Múltiples marcas en una organización**: Grupo Yes tiene Yes Eventos, Yes Catering, Yes Floristería. Cada una tiene su propio número de WhatsApp principal, su propio equipo, sus propias campañas. Hoy todo conviviría en un solo tenant sin separación, con riesgo de que un agente de Catering vea conversaciones de Floristería.
2. **Múltiples sucursales por marca**: cada marca tiene 3-5 sucursales físicas con su propio número de WhatsApp local. Los agentes de la sucursal de Miraflores no deberían ver conversaciones de la sucursal de Barranco. Hoy no hay forma de agrupar canales por "ubicación operacional".
3. **Reporting**: el dueño de la marca quiere KPIs de su marca (no de toda la organización ni de una sucursal sola). El gerente de organización quiere comparar marcas. Hoy todo es a nivel tenant.
4. **Fiscal por sucursal**: algunos grupos empresariales operan con RUC distinto por filial. Hoy el RUC es único a nivel tenant.

Soluciones alternativas que descartamos:
- **Un tenant por marca** (Grupo Yes con 3 tenants separados): pierde la consolidación, requiere 3 logins distintos para el org-admin, duplica configuración, y no resuelve el reporting cruzado.
- **Tags en custom_attributes**: imposible enforzar permisos a nivel BD; cualquier query sin el filtro correcto expone datos cruzados.
- **Teams existentes en messaging**: ya existen pero no propagan al backend, no controlan acceso a órdenes/facturas, son intra-marca.

## Decisiones de diseño (consensuadas)

| Decisión | Elección | Razón |
|---|---|---|
| Niveles de jerarquía | 3 (Tenant → Brand → Branch) | Cubre 95% de casos. Regiones (4to nivel) se añadirá con `branches.parent_branch_id` o tabla intermedia cuando aparezca demanda real |
| Adopción | Opt-in por tenant (`hierarchy_enabled` boolean) | Backwards-compat total. Tenants existentes intactos. Solo Grupo Yes y futuros que lo pidan activan |
| Branch como entidad separada de Inbox | Sí | Branch tiene atributos físicos (dirección, lat/lng, horario tienda) y puede tener múltiples canales (WhatsApp + Instagram futuros). Inbox sigue siendo "config de mensajería" |
| Canal principal de marca | Inbox con flag `is_brand_hub=true`, `branch_id=NULL` | El agente humano reasigna manualmente a inbox de sucursal. Cero lógica de ruteo automático en este PR |
| Multi-marca por usuario | Solo ORG_ADMIN. Resto del staff = 1 brand (+ opcional 1 branch) | Sin tabla de memberships. FKs directas `users.brand_id` y `users.branch_id` |
| Roles nuevos | ORG_ADMIN, BRAND_ADMIN, BRANCH_AGENT explícitos | Más limpio que inferir scope desde ADMIN. `ADMIN` se mantiene como alias semántico de ORG_ADMIN para tenants sin jerarquía |
| Source of truth | Backend (ventia DB) | Source of truth en backend, espejo en messaging vía `ventia_brand_id`/`ventia_branch_id` (mismo patrón que `accounts.ventia_tenant_id`) |
| Denormalización conversations | Solo `brand_id` | Brand cambia rarísimo (estable); branch_id se deriva siempre vía `JOIN inboxes` para evitar drift en reasignaciones |
| Vista Org-Admin por defecto | Todo agregado, con filtros opcionales | Selector de marca/sucursal arriba; default = "todo" |
| Branding visual por marca | **Fuera de scope este PR** | Iteración siguiente. Schema deja `brands.logo_url`/`primary_color` listos pero la UI no los consume aún |
| Fiscal por sucursal | Campos opcionales en branch; hereda del tenant si vacíos | Algunos clientes lo necesitan, otros no. Branch tiene `efact_ruc`, `emisor_*` nullable; orden/factura resuelve la cadena branch → tenant en runtime |
| Migración tenants existentes | Sin auto-creación de brand/branch default. Activación manual vía endpoint | Forzar default sería decidir por el cliente. Tenants existentes ven el modelo idéntico hasta que un SUPERADMIN active explícitamente |
| Activación | Endpoint `POST /tenants/{id}/enable-hierarchy` (SUPERADMIN) | Crea brand "Default" + branch "Principal" + mueve inboxes/orders existentes al default. Idempotente |
| Dashboard comparativo entre marcas | **Fuera de scope este PR** | Solo filtrado por marca/sucursal en vistas existentes. El dashboard side-by-side puede llegar en iteración siguiente |

## Arquitectura

```
┌─────────────────────────── Backend (FastAPI, ventia DB) ───────────────────────────┐
│                                                                                    │
│   tenants ─── hierarchy_enabled (flag)                                             │
│      │                                                                             │
│      ├── brands (1:N)  ◄── source of truth                                         │
│      │     │                                                                       │
│      │     └── branches (1:N) ◄── source of truth                                  │
│      │                                                                             │
│      ├── users (brand_id, branch_id, role)                                         │
│      ├── orders (brand_id, branch_id) ◄── denormalizado para queries               │
│      └── invoices/invoice_series (branch_id opcional)                              │
│                                                                                    │
└────────────────────┬───────────────────────────────────────────────────────────────┘
                     │ webhooks (POST/PATCH/DELETE) — same pattern as Tenant↔Account
                     ▼
┌─────────────────────── Messaging (Rails, messaging DB) ────────────────────────────┐
│                                                                                    │
│   accounts (existe)                                                                │
│      ├── brands (espejo) ─── ventia_brand_id                                       │
│      │     └── branches (espejo) ─── ventia_branch_id                              │
│      │                                                                             │
│      ├── inboxes (brand_id, branch_id, is_brand_hub) ◄── FKs nullables             │
│      │     └── channels (whatsapp/instagram) sin cambios                           │
│      │                                                                             │
│      ├── conversations (brand_id denormalizado vía callback)                       │
│      └── inbox_members (sin cambios, sigue siendo asignación user→inbox)           │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘

Frontend (Next.js)
  └── TenantProvider lee hierarchy_enabled
      └── Si true: ScopeContext expone { tenant, brand, branch } a hijos
          └── Sidebar muestra selector de marca/sucursal
          └── Listados (orders, conversations, KPIs) propagan ?brand_id=&branch_id=
```

Estados válidos del inbox (enforced por CHECK constraint):
- **Legacy** (pre-jerarquía o tenant sin hierarchy): `brand_id=NULL, branch_id=NULL, is_brand_hub=false`
- **Brand hub**: `brand_id=X, branch_id=NULL, is_brand_hub=true`
- **Branch inbox**: `brand_id=X, branch_id=Y, is_brand_hub=false`

## Modelo de datos

### Backend (ventia)

**Nueva tabla `brands`** (`apps/backend/app/models/brand.py`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigserial PK | |
| `tenant_id` | FK tenants.id ON DELETE CASCADE, indexed | |
| `name` | varchar(120) NOT NULL | "Yes Eventos" |
| `slug` | varchar(80) NOT NULL | Unique per tenant |
| `logo_url` | varchar nullable | Schema-ready para iteración futura |
| `primary_color` | varchar(7) nullable | "#E91E63", para iteración futura |
| `is_active` | boolean default true | |
| `settings` | json nullable | Overrides por marca |
| `created_at`, `updated_at` | TimestampMixin | |

**Nueva tabla `branches`** (`apps/backend/app/models/branch.py`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigserial PK | |
| `tenant_id` | FK tenants.id CASCADE, indexed | Denormalizado para queries; consistencia validada en service layer |
| `brand_id` | FK brands.id CASCADE, indexed | |
| `name` | varchar(120) NOT NULL | "Miraflores" |
| `slug` | varchar(80) NOT NULL | Unique per brand |
| `code` | varchar(20) nullable | SKU-like interno |
| `address_line`, `city`, `province`, `country`, `postal_code` | varchar nullable | Físico |
| `latitude`, `longitude` | numeric(10,7) nullable | |
| `timezone` | varchar(50) nullable | Override de brand/tenant |
| `business_hours` | json nullable | `{mon: "10-22", ...}` ≠ inbox.working_hours |
| `contact_phone`, `contact_email` | varchar nullable | Públicos al cliente |
| `efact_ruc`, `emisor_nombre_comercial`, `emisor_ubigeo`, `emisor_departamento`, `emisor_provincia`, `emisor_distrito`, `emisor_direccion` | varchar nullable | Fiscal opcional; si null hereda del tenant |
| `is_active` | boolean default true | |
| `created_at`, `updated_at` | TimestampMixin | |

Constraints:
- `UNIQUE(tenant_id, slug)` en brands; `UNIQUE(brand_id, slug)` en branches
- Composite indexes: `(tenant_id, is_active)`, `(brand_id, is_active)`
- Invariante `branch.tenant_id == branch.brand.tenant_id` validado en service layer (PostgreSQL no soporta CHECK con subquery)

**Modificación `tenants`**: agregar `hierarchy_enabled` boolean default false.

**Modificación `users`**: agregar `brand_id` (FK SET NULL) y `branch_id` (FK SET NULL), nullable. Extender enum Role con `ORG_ADMIN`, `BRAND_ADMIN`, `BRANCH_AGENT`. CHECK constraint valida combinaciones role × scope.

**Modificación `orders`**: agregar `brand_id` y `branch_id` (FK SET NULL) nullable. Composite index `(tenant_id, brand_id, branch_id)`.

**Modificación `invoice_series`, `invoices`**: agregar `branch_id` nullable. La resolución del RUC al emitir factura sigue la cadena: `order.branch.efact_ruc ?? order.tenant.efact_ruc`.

### Messaging (Rails)

**Nuevas tablas `brands` y `branches`** (espejos, con `ventia_brand_id`/`ventia_branch_id` indexados único).

**Modificación `inboxes`**: agregar `brand_id`, `branch_id` (FK nullable), `is_brand_hub` boolean default false. CHECK constraint enforza los 3 estados válidos descritos arriba.

**Modificación `conversations`**: agregar `brand_id` denormalizado (FK nullable). Callback Rails `before_save :sync_brand_from_inbox` lo mantiene consistente.

## Endpoints

### Nuevos (backend FastAPI)

| Verbo + Path | Rol requerido | Comportamiento |
|---|---|---|
| `GET /brands` | ORG_ADMIN, BRAND_ADMIN | Lista brands del tenant, scope-filtered. BRAND_ADMIN solo ve la suya |
| `POST /brands` | ORG_ADMIN | Crea brand + sincroniza a messaging |
| `GET /brands/{id}` | ORG_ADMIN, BRAND_ADMIN | |
| `PATCH /brands/{id}` | ORG_ADMIN o BRAND_ADMIN de esa brand | |
| `DELETE /brands/{id}` | ORG_ADMIN | Soft delete (`is_active=false`) + sincroniza |
| `GET /brands/{brand_id}/branches` | Scope-filtered | |
| `POST /brands/{brand_id}/branches` | ORG_ADMIN o BRAND_ADMIN | |
| `GET /branches/{id}`, `PATCH`, `DELETE` | Scope-filtered | |
| `POST /tenants/{id}/enable-hierarchy` | SUPERADMIN | Activa flag + crea brand "Default" + branch "Principal" + migra inboxes/orders/users existentes al default. Idempotente |

### Existentes que cambian comportamiento (filtrado, no firma)

| Endpoint | Cambio |
|---|---|
| `GET /orders`, `GET /orders/export` | Filtra automáticamente por `user.brand_id`/`branch_id`. Acepta `?brand_id=X&branch_id=Y` opcional |
| `POST /orders` | Si `user.branch_id` set, lo usa por defecto; si no, requiere `branch_id` en body validado |
| `GET /users`, `POST /users`, `PATCH /users/{id}` | ORG_ADMIN ve todo el tenant; BRAND_ADMIN solo su brand |
| `GET /messaging/conversations`, `GET /messaging/inboxes` | Backend propaga headers `X-Brand-Id`, `X-Branch-Id`, `X-User-Role` a Rails |
| `GET /tenants/{id}` | Devuelve `hierarchy_enabled` en response |
| `GET /metrics/*` | KPIs scope-filtered. ORG_ADMIN puede filtrar opcionalmente |
| `POST /invoices` | Resuelve RUC vía branch → tenant. Valida `order.branch_id == user.branch_id` si BRANCH_AGENT |

## Permisos

Dos capas distintas:

**Capa 1 — Autorización de endpoint**: extender el dict `PERMISSIONS = {(METHOD, PATH): [Role, ...]}` en `apps/backend/app/core/permissions.py` añadiendo los nuevos roles a endpoints existentes y registrando los nuevos endpoints. `require_permission_dual` no cambia.

**Capa 2 — Filtrado de datos**: helper nuevo `scope_query_by_user(query, user, model_cls)` aplicado en cada repositorio. Lógica:

- SUPERADMIN: sin filtros
- ORG_ADMIN / ADMIN (sin brand_id): filter by `tenant_id`
- BRAND_ADMIN (con brand_id): filter by `tenant_id` + `brand_id`
- BRANCH_AGENT (con branch_id): filter by `tenant_id` + `brand_id` + `branch_id`
- Otros roles (LOGISTICA/VENTAS/VIEWER): se asignan opcionalmente a brand y/o branch; respeta el scope que tengan

Helper complementario `assert_scope_match(user, brand_id, branch_id)` para validar creates/updates.

En messaging Rails: `BaseController#set_current_scope` lee headers y expone `scoped_conversations`, `scoped_inboxes` que cada controller usa.

## UI

### Componentes nuevos

**`/dashboard/brands`** — Listado de marcas del tenant (solo se renderiza si `hierarchy_enabled`). Cards con logo placeholder, color stripe, nombre, contador de sucursales. Botón "Nueva marca" para ORG_ADMIN.

**`/dashboard/brands/[id]`** — Detalle de una marca: editar nombre/logo/color, listado de sucursales, accesos rápidos a KPIs/órdenes filtradas a esa marca.

**`/dashboard/brands/[id]/branches/[branchId]`** — Detalle de sucursal: form con campos físicos (dirección, geo) + fiscal opcionales + horario.

**`/dashboard/settings/hierarchy`** — Panel donde un SUPERADMIN ve estado actual del tenant y puede llamar `POST /tenants/{id}/enable-hierarchy`. ORG_ADMIN ve el panel en modo read-only.

### Selector de contexto (sidebar)

Componente `<ScopeSelector>` solo visible si `hierarchy_enabled=true`. Renderiza:

- ORG_ADMIN/ADMIN: dropdown "Todas las marcas" + "Yes Eventos" + "Yes Catering" + ... Al elegir marca, aparece sub-dropdown de sucursales. Selección persiste en URL query (`?brand_id=&branch_id=`) y en localStorage para volver con la última vista.
- BRAND_ADMIN: dropdown solo con sucursales de su marca (la marca está fija; solo cambia sucursal).
- BRANCH_AGENT: no se renderiza el selector (no tiene opciones).

Las páginas de listado (orders, conversations, KPIs) leen el query string y lo aplican como filtro.

### Cambios mínimos en vistas existentes

- `/dashboard/orders`: añade columnas opcionales "Marca" / "Sucursal" (visibles solo si `hierarchy_enabled` y user es ORG_ADMIN/BRAND_ADMIN).
- `/dashboard/conversations`: la lista filtra por `brand_id`/`branch_id` desde el contexto.
- `/dashboard/users`: form de crear/editar user añade dropdowns "Brand" y "Branch" (solo si hierarchy_enabled).
- `/dashboard` (home/KPIs): los widgets aceptan brand/branch del contexto.

### Tipos frontend

`apps/frontend/lib/types/brand.ts`, `branch.ts`. `Tenant` añade `hierarchy_enabled: boolean`. `User` añade `brand_id`, `branch_id`. `Inbox` añade `brand_id`, `branch_id`, `is_brand_hub`.

## Migración

Plan en fases (sin breaking change):

**Fase 1 — Schema** (Alembic backend × 7 + Rails × 4 migraciones). Todo nullable. Cero impacto runtime.

**Fase 2 — Código backend**: modelos, repositorios, services, endpoints, schemas. Helper `scope_query_by_user` aplicado.

**Fase 3 — Código messaging**: modelos Brand/Branch, callback en Conversation, controllers receptores de sync (POST/PATCH/DELETE de brands/branches), scoping en BaseController.

**Fase 4 — Sincronización cross-DB**: `BrandService.create_brand()` y `BranchService` hacen POST a messaging tras INSERT en backend. Idempotente por `ventia_*_id`.

**Fase 5 — UI**: páginas admin, selector de contexto, integración en listados existentes.

**Fase 6 — Activación piloto**: SUPERADMIN llama `POST /tenants/{grupo_yes_id}/enable-hierarchy` → script crea brand "Default" + branch "Principal" + mueve recursos. Para Grupo Yes específicamente, **no usan el default**: arrancan creando sus 3 marcas reales y sus N sucursales manualmente vía UI.

**Tenants existentes (no Grupo Yes)** quedan intactos hasta que un SUPERADMIN active jerarquía para ellos vía el mismo endpoint. Tenants nuevos arrancan con `hierarchy_enabled=false` (cambio de default es decisión posterior).

## Validaciones y edge cases

| Escenario | Comportamiento |
|---|---|
| Tenant con `hierarchy_enabled=false` | Endpoints nuevos `/brands`, `/branches` devuelven 404. Scope filters ignoran `brand_id`/`branch_id` (siempre NULL). UI esconde paneles |
| Crear branch en otra marca de otro tenant | Service layer valida `branch.tenant_id == branch.brand.tenant_id`; rechaza con 400 |
| Crear order sin brand_id (tenant con hierarchy) | Si user tiene `branch_id` o `brand_id`, se usa por default. Si user es ORG_ADMIN sin scope, el frontend obliga a elegir brand antes de crear |
| Reasignar conversación a inbox de otra marca | Callback Rails actualiza `conversation.brand_id`. UI muestra confirmación porque cambia "marca dueña" del cliente |
| Reasignar conversación a inbox de otra sucursal (misma marca) | `brand_id` no cambia; `branch_id` se deriva vía JOIN, siempre fresco |
| Deshabilitar (`is_active=false`) brand con sucursales activas | Service layer rechaza con mensaje claro. ORG_ADMIN debe desactivar sucursales primero (o usa endpoint "archive cascade") |
| Eliminar tenant | CASCADE elimina brands → branches → users.brand_id queda NULL (SET NULL) |
| Tenant tiene RUC en branch pero branch.efact_ruc=NULL | Resolución sube a tenant.efact_ruc; si tampoco, error claro al emitir factura |
| User es ORG_ADMIN intenta crear user con brand_id de otro tenant | `assert_scope_match` rechaza |
| `enable-hierarchy` llamado 2× | Idempotente: skip si brand Default ya existe; mantiene los IDs |
| Inbox legacy (brand_id=NULL) en tenant con hierarchy_enabled=true | Se acepta. La conversación cuelga del inbox legacy, no aparece filtrada por marca. UI ofrece "asignar este inbox a una marca/sucursal" |

## Testing

### Backend (pytest)

| Archivo | Cubre |
|---|---|
| `tests/unit/models/test_brand.py`, `test_branch.py` (nuevos) | Modelos, constraints, invariante tenant cross-check |
| `tests/unit/core/test_permissions.py` (extender) | `scope_query_by_user` con cada combinación role × scope. `assert_scope_match` rechaza correctamente |
| `tests/integration/api/test_brands.py`, `test_branches.py` (nuevos) | CRUD endpoints con auth de cada rol. Verificar filtrado, 403 cross-tenant, sincronización a messaging mockeada |
| `tests/integration/scripts/test_enable_hierarchy.py` (nuevo) | Idempotencia, creación de default brand/branch, migración de recursos existentes |
| `tests/unit/services/test_messaging_service.py` (extender) | Headers `X-Brand-Id`/`X-Branch-Id`/`X-User-Role` propagados correctamente |
| `tests/integration/api/test_orders.py` (extender) | List filtra por scope. Crear order sin brand_id falla si tenant tiene hierarchy. Invoice resuelve RUC vía branch → tenant |

### Messaging Rails (RSpec o Minitest)

| Archivo | Cubre |
|---|---|
| `spec/models/inbox_spec.rb` (extender) | CHECK constraint (los 3 estados válidos), validaciones de brand_id/branch_id |
| `spec/models/conversation_spec.rb` (extender) | Callback `sync_brand_from_inbox` setea brand_id correcto en create y en update_inbox_id |
| `spec/models/brand_spec.rb`, `branch_spec.rb` (nuevos) | Espejos creados/actualizados/borrados vía webhooks |
| `spec/requests/api/v1/brands/*_spec.rb` (nuevos) | Endpoints receptores de sync |
| `spec/requests/api/v1/conversations/index_spec.rb` (extender) | Scope con headers de brand/branch filtra correcto |

### Frontend — component (Vitest)

| Archivo | Cubre |
|---|---|
| `lib/utils/scope.test.ts` (nuevo) | Helper para construir query params `?brand_id=&branch_id=` desde contexto |
| `components/dashboard/scope-selector.test.tsx` (nuevo) | Render según rol, navegación brand → branch, persistencia en localStorage |
| `components/dashboard/brands/brand-form.test.tsx` (nuevo) | Validación, submit, error states |
| Componentes de listado existentes (extender) | Filtros aplicados desde contexto |

### Frontend — E2E (Playwright)

Nuevo `e2e/specs/hierarchy.spec.ts`:
- Login como SUPERADMIN → activar jerarquía en tenant test → verificar UI revelada
- Login como ORG_ADMIN → crear brand → crear branch → ver lista
- Login como BRAND_ADMIN → confirmar que solo ve su marca, no puede crear otra
- Login como BRANCH_AGENT → confirmar que conversations solo muestra inbox asignado

Snapshot/restore en fixtures para no contaminar datos.

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| Branding visual por marca (logo/color aplicados a toda la UI cuando entras como BRAND_ADMIN) | Schema deja `logo_url`/`primary_color` listos pero la UI no los consume aún. Iteración siguiente |
| Dashboard comparativo entre marcas (KPIs side-by-side) | Filtrado individual es suficiente para v1. Componentes comparativos llegan después |
| Regiones (4to nivel sobre marcas) | Demanda especulativa. Cuando aparezca, se añade `branches.parent_branch_id` o tabla intermedia |
| Multi-marca real para roles no-ORG_ADMIN | Confirmado con producto: hoy solo ORG_ADMIN. Si futuro necesita BRAND_ADMIN de 2 marcas, se agregará tabla `user_brand_memberships` |
| Inbox compartido entre 2 marcas | `inboxes.brand_id` singular hoy. Cuando ocurra, tabla `inbox_brands` many-to-many |
| Bot/agent_bot por marca | Hoy a nivel account. Agregar `agent_bots.brand_id` trivial cuando se necesite |
| Importación masiva de marcas/sucursales desde CSV | Out of scope; creación manual vía UI es suficiente para piloto |
| Auto-activación de jerarquía para tenants nuevos por default | Decisión posterior tras evaluar piloto de Grupo Yes |
| Reasignación automática de conversaciones entre sucursales (routing rules) | Agente reasigna manualmente. Reglas declarativas llegan después si validan necesidad |
| Reporting cruzado (ej. "agente X atiende clientes de la sucursal Y pero pertenece a Z") | Hoy hard-no por permisos. Cuando se necesite cross-brand visibility limitada, se modela |
| Migración automática masiva de tenants existentes a hierarchy | Opt-in por SUPERADMIN tenant-by-tenant. Cero migración silenciosa |
| Internacionalización de `business_hours`/timezone selector | Se reutiliza el patrón existente del proyecto. Sin cambios extra |
