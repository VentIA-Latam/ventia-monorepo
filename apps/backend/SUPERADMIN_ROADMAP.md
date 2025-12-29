# Sistema SuperAdmin de Ventia + API Keys para n8n

## 🏗️ Arquitectura: Tenant Especial "Ventia"

**Decisión:** Crear un tenant especial con `id=1`, `slug="ventia"`, `name="VentIA Platform"` y campo `is_platform=True`. Los SuperAdmins pertenecen a este tenant y tienen rol `SUPER_ADMIN` que les permite acceder a datos de todos los tenants.

**Ventajas:**
- ✅ Mantiene consistencia con el modelo actual (todos los usuarios tienen tenant_id)
- ✅ Bajo riesgo de implementación (2-3 días por historia)
- ✅ Escalable para futuras necesidades de Ventia
- ✅ Auditoría clara de acciones de SuperAdmin

---

## 📋 Historias de Usuario

### ✅ Historia 1: Rol SUPER_ADMIN y Tenant Plataforma
**Estado:** 🔴 No iniciado

**Título:** Crear rol SUPER_ADMIN y tenant especial de Ventia en el sistema

**Descripción:**
Como desarrollador backend, quiero agregar el rol SUPER_ADMIN y un tenant especial para VentIA Platform, para permitir que administradores de Ventia gestionen todos los clientes desde un nivel superior.

**Criterios de Aceptación:**

- [ ] **CA1.1** - Agregar rol SUPER_ADMIN al enum Role en `app/core/permissions.py`
- [ ] **CA1.2** - Agregar campo `is_platform` (Boolean) al modelo Tenant en `app/models/tenant.py`
- [ ] **CA1.3** - Crear migración Alembic para is_platform
- [ ] **CA1.4** - Crear tenant Ventia (id=1, slug="ventia", is_platform=True) en `scripts/seed.py`
- [ ] **CA1.5** - Crear usuario SuperAdmin en seed.py con tenant_id=1 y role="superadmin"
- [ ] **CA1.6** - Actualizar matriz de permisos para incluir SUPER_ADMIN en todos los endpoints

**Archivos afectados:**
- `app/core/permissions.py`
- `app/models/tenant.py`
- `scripts/seed.py`
- `alembic/versions/XXX_add_is_platform_to_tenants.py`

---

### ✅ Historia 2: Endpoints de Gestión de Tenants
**Estado:** 🔴 No iniciado

**Título:** Crear endpoints CRUD para gestionar todos los tenants del sistema

**Descripción:**
Como SuperAdmin de Ventia, quiero endpoints REST para ver, crear y gestionar todos los tenants (clientes), para administrar centralmente a Nassau, La Dore y futuros clientes.

**Criterios de Aceptación:**

- [ ] **CA2.1** - Endpoint `GET /api/v1/tenants` - Listar todos los tenants
- [ ] **CA2.2** - Endpoint `GET /api/v1/tenants/{tenant_id}` - Obtener detalle de un tenant
- [ ] **CA2.3** - Endpoint `POST /api/v1/tenants` - Crear nuevo tenant
- [ ] **CA2.4** - Endpoint `PATCH /api/v1/tenants/{tenant_id}` - Actualizar tenant
- [ ] **CA2.5** - Endpoint `DELETE /api/v1/tenants/{tenant_id}` - Desactivar tenant (soft delete)
- [ ] **CA2.6** - Crear router en `endpoints/tenants.py` y registrar en api.py
- [ ] **CA2.7** - Crear schemas Pydantic: TenantResponse, TenantCreate, TenantUpdate, TenantListResponse
- [ ] **CA2.8** - Crear TenantService con métodos CRUD
- [ ] **CA2.9** - Verificar endpoints en Swagger UI `/docs`

**Archivos afectados:**
- `app/api/v1/endpoints/tenants.py` (nuevo)
- `app/api/v1/api.py`
- `app/schemas/tenant.py` (nuevo)
- `app/services/tenant.py` (nuevo)
- `app/repositories/tenant.py` (si es necesario)

---

### ✅ Historia 3: Gestión Global de Usuarios (SuperAdmin)
**Estado:** 🔴 No iniciado

**Título:** Endpoints para que SuperAdmin gestione usuarios de todos los tenants

**Descripción:**
Como SuperAdmin de Ventia, quiero ver y gestionar usuarios de todos los clientes desde un solo lugar, para dar soporte, crear cuentas y administrar permisos sin depender de cada tenant.

**Criterios de Aceptación:**

- [ ] **CA3.1** - Endpoint `GET /api/v1/superadmin/users` - Listar usuarios de todos los tenants
- [ ] **CA3.2** - Endpoint `POST /api/v1/superadmin/users` - Crear usuario en cualquier tenant
- [ ] **CA3.3** - Endpoint `PATCH /api/v1/superadmin/users/{user_id}` - Actualizar cualquier usuario
- [ ] **CA3.4** - Endpoint `DELETE /api/v1/superadmin/users/{user_id}` - Desactivar usuario
- [ ] **CA3.5** - Modificar `GET /api/v1/users` existente para bypass de SuperAdmin
- [ ] **CA3.6** - Crear schemas con info de tenant: UserWithTenantResponse
- [ ] **CA3.7** - Validar que no se puede desactivar al último SUPER_ADMIN

**Archivos afectados:**
- `app/api/v1/endpoints/users.py` (modificar)
- `app/schemas/user.py` (agregar UserWithTenantResponse)
- `app/services/user.py` (agregar métodos global)

---

### ✅ Historia 4: Bypass de Tenant Filtering para SuperAdmin
**Estado:** 🔴 No iniciado

**Título:** Modificar endpoints de órdenes para que SuperAdmin vea datos de todos los tenants

**Descripción:**
Como SuperAdmin de Ventia, quiero acceder a órdenes de todos los clientes sin restricción de tenant, para dar soporte, generar reportes globales y monitorear la plataforma.

**Criterios de Aceptación:**

- [ ] **CA4.1** - Modificar `GET /api/v1/orders` para SuperAdmin bypass (líneas 111-142)
- [ ] **CA4.2** - Modificar `GET /api/v1/orders/{order_id}` para SuperAdmin bypass
- [ ] **CA4.3** - Mantener restricciones de escritura (PUT, DELETE, POST validate) por tenant
- [ ] **CA4.4** - Crear método `get_all_orders()` en OrderService
- [ ] **CA4.5** - Agregar campo `tenant: Optional[TenantResponse]` en OrderResponse
- [ ] **CA4.6** - Agregar logging cuando SuperAdmin accede a orden de otro tenant

**Archivos afectados:**
- `app/api/v1/endpoints/orders.py`
- `app/services/order.py`
- `app/schemas/order.py`

---

### ✅ Historia 5: Sistema de API Keys para n8n
**Estado:** 🔴 No iniciado

**Título:** Implementar API Keys para autenticación de n8n por cada tenant cliente

**Descripción:**
Como cliente de Ventia (Nassau, La Dore, etc.), quiero generar API Keys para autenticar mis integraciones n8n, para automatizar operaciones sin exponer credenciales de Auth0.

**Criterios de Aceptación:**

- [ ] **CA5.1** - Crear modelo APIKey en `app/models/api_key.py`
- [ ] **CA5.2** - Crear migración Alembic para tabla api_keys
- [ ] **CA5.3** - Endpoint `POST /api/v1/api-keys` - Crear nueva API key
- [ ] **CA5.4** - Endpoint `GET /api/v1/api-keys` - Listar API keys del tenant
- [ ] **CA5.5** - Endpoint `PATCH /api/v1/api-keys/{key_id}` - Actualizar API key
- [ ] **CA5.6** - Endpoint `DELETE /api/v1/api-keys/{key_id}` - Revocar API key
- [ ] **CA5.7** - Crear dependencia `get_current_user_or_api_key()` en deps.py
- [ ] **CA5.8** - Aplicar autenticación dual a endpoints de órdenes
- [ ] **CA5.9** - Crear schemas: APIKeyCreate, APIKeyCreateResponse, APIKeyResponse, APIKeyUpdate
- [ ] **CA5.10** - Crear APIKeyService con lógica de generación y validación
- [ ] **CA5.11** - Hashear keys con bcrypt antes de guardar
- [ ] **CA5.12** - Implementar actualización asíncrona de last_used_at

**Archivos afectados:**
- `app/models/api_key.py` (nuevo)
- `app/api/v1/endpoints/api_keys.py` (nuevo)
- `app/api/deps.py` (modificar)
- `app/schemas/api_key.py` (nuevo)
- `app/services/api_key.py` (nuevo)
- `app/api/v1/endpoints/orders.py` (modificar)
- `alembic/versions/XXX_add_api_keys_table.py`

---

### ✅ Historia 6: Frontend - Panel SuperAdmin Base
**Estado:** 🔴 No iniciado

**Título:** Crear dashboard separado para SuperAdmin con login independiente

**Descripción:**
Como SuperAdmin de Ventia, quiero un panel /superadmin con autenticación separada del dashboard de clientes, para gestionar tenants y usuarios sin mezclar con la interfaz de clientes.

**Criterios de Aceptación:**

- [ ] **CA6.1** - Crear ruta `/superadmin` con layout.tsx propio
- [ ] **CA6.2** - Crear componente SuperAdminSidebar
- [ ] **CA6.3** - Crear página `/superadmin/login` con Auth0
- [ ] **CA6.4** - Crear página `/superadmin/dashboard` (home del panel)
- [ ] **CA6.5** - Implementar middleware de protección para rutas /superadmin
- [ ] **CA6.6** - Modificar hook useAuth para exponer rol del usuario
- [ ] **CA6.7** - Endpoint backend `GET /api/v1/me` (retorna user con role y tenant)
- [ ] **CA6.8** - Agregar opción "Consola SuperAdmin" en dropdown de dashboard normal

**Archivos afectados (Backend):**
- `app/api/v1/endpoints/auth.py` (nuevo)
- `app/schemas/user.py` (UserMeResponse)

**Archivos afectados (Frontend):**
- `apps/frontend/app/superadmin/layout.tsx` (nuevo)
- `apps/frontend/app/superadmin/login/page.tsx` (nuevo)
- `apps/frontend/app/superadmin/dashboard/page.tsx` (nuevo)
- `apps/frontend/components/superadmin/super-admin-sidebar.tsx` (nuevo)
- `apps/frontend/hooks/use-auth.tsx` (modificar)
- `apps/frontend/middleware.ts` (nuevo)
- `apps/frontend/app/dashboard/layout.tsx` (modificar)

---

### ✅ Historia 7: Frontend - UI de Gestión de Tenants
**Estado:** 🔴 No iniciado

**Título:** Interfaz para que SuperAdmin vea, cree y edite tenants

**Descripción:**
Como SuperAdmin de Ventia, quiero una interfaz visual para gestionar tenants (Nassau, La Dore, etc.), para administrar clientes sin usar Postman o terminal.

**Criterios de Aceptación:**

- [ ] **CA7.1** - Página `/superadmin/tenants` con tabla de tenants
- [ ] **CA7.2** - Client Component TenantsClientView con filtros y búsqueda
- [ ] **CA7.3** - Botón "Crear Tenant" con modal de formulario
- [ ] **CA7.4** - Modal de edición de tenant
- [ ] **CA7.5** - Acción desactivar tenant con confirmación (AlertDialog)
- [ ] **CA7.6** - Página de detalle `/superadmin/tenants/[id]`
- [ ] **CA7.7** - Servicio tenant-service.ts con funciones fetch
- [ ] **CA7.8** - Componente TenantForm reutilizable

**Archivos afectados:**
- `apps/frontend/app/superadmin/tenants/page.tsx` (nuevo)
- `apps/frontend/app/superadmin/tenants/[id]/page.tsx` (nuevo)
- `apps/frontend/components/superadmin/tenants-table.tsx` (nuevo)
- `apps/frontend/components/superadmin/tenant-form-dialog.tsx` (nuevo)
- `apps/frontend/lib/services/tenant-service.ts` (nuevo)

---

### ✅ Historia 8: Frontend - UI de Gestión de Usuarios Global
**Estado:** 🔴 No iniciado

**Título:** Interfaz para que SuperAdmin gestione usuarios de todos los tenants

**Descripción:**
Como SuperAdmin de Ventia, quiero ver y gestionar usuarios de todos los clientes desde una interfaz, para crear cuentas, cambiar roles y dar soporte sin depender de cada tenant.

**Criterios de Aceptación:**

- [ ] **CA8.1** - Página `/superadmin/users` con tabla global de usuarios
- [ ] **CA8.2** - Filtros: Tenant (multi-select), Rol, Estado, Búsqueda
- [ ] **CA8.3** - Paginación server-side con searchParams
- [ ] **CA8.4** - Botón "Crear Usuario" con formulario
- [ ] **CA8.5** - Modal de edición de usuario
- [ ] **CA8.6** - Acción desactivar usuario con confirmación
- [ ] **CA8.7** - Página de detalle `/superadmin/users/[id]`
- [ ] **CA8.8** - Badges con colores para roles y estados

**Archivos afectados:**
- `apps/frontend/app/superadmin/users/page.tsx` (nuevo)
- `apps/frontend/app/superadmin/users/[id]/page.tsx` (nuevo)
- `apps/frontend/components/superadmin/users-table.tsx` (nuevo)
- `apps/frontend/components/superadmin/user-form-dialog.tsx` (nuevo)
- `apps/frontend/lib/services/user-service.ts` (extender existente)

---

### ✅ Historia 9: Frontend - UI de Gestión de API Keys
**Estado:** 🔴 No iniciado

**Título:** Interfaz para gestionar API Keys tanto desde panel SuperAdmin como dashboard de tenant

**Descripción:**
Como administrador (SuperAdmin o Tenant Admin), quiero una interfaz para crear, listar y revocar API Keys, para gestionar integraciones de n8n sin usar herramientas de línea de comandos.

**Criterios de Aceptación:**

- [ ] **CA9.1** - Página `/dashboard/settings/api-keys` para Tenant Admin
- [ ] **CA9.2** - Página `/superadmin/api-keys` para SuperAdmin con filtro de tenant
- [ ] **CA9.3** - Modal de creación de API Key
- [ ] **CA9.4** - Modal de éxito mostrando la key COMPLETA una sola vez
- [ ] **CA9.5** - Botón "Copiar al portapapeles" para la key
- [ ] **CA9.6** - Checkbox "He guardado la clave" antes de cerrar modal
- [ ] **CA9.7** - Acción revocar API Key con confirmación
- [ ] **CA9.8** - Columna "Último uso" con formato relativo
- [ ] **CA9.9** - Sección colapsable "¿Cómo usar en n8n?" con ejemplos
- [ ] **CA9.10** - Guards de ruta para verificar role ADMIN

**Archivos afectados:**
- `apps/frontend/app/dashboard/settings/api-keys/page.tsx` (nuevo)
- `apps/frontend/app/superadmin/api-keys/page.tsx` (nuevo)
- `apps/frontend/components/superadmin/api-keys-table.tsx` (nuevo)
- `apps/frontend/components/dashboard/api-key-create-dialog.tsx` (nuevo)
- `apps/frontend/lib/services/api-key-service.ts` (nuevo)
- `apps/frontend/components/dashboard/app-sidebar.tsx` (agregar link a settings)

---

### ✅ Historia 10: Servicio de Encriptación para Credenciales
**Estado:** 🔴 No iniciado

**Título:** Crear utilidad de encriptación/desencriptación para credenciales sensibles

**Descripción:**
Como ingeniero de seguridad, quiero tener un servicio reutilizable de encriptación simétrica, para proteger credenciales sensibles como tokens de Shopify en la base de datos.

**Criterios de Aceptación:**

- [ ] **CA10.1** - Crear módulo `app/core/encryption.py` con funciones encrypt() y decrypt() usando Fernet
- [ ] **CA10.2** - Derivar clave de encriptación desde SECRET_KEY usando PBKDF2
- [ ] **CA10.3** - Crear excepciones custom: EncryptionError y DecryptionError
- [ ] **CA10.4** - Implementar tests unitarios en `tests/core/test_encryption.py`
- [ ] **CA10.5** - Documentar en README sobre encriptación de credenciales

**Archivos afectados:**
- `apps/backend/app/core/encryption.py` (nuevo)
- `apps/backend/tests/core/test_encryption.py` (nuevo)
- `apps/backend/README.md` (documentación)

---

### ✅ Historia 11: Encriptar Shopify Access Tokens en Tenant
**Estado:** 🔴 No iniciado

**Título:** Implementar encriptación transparente de tokens de Shopify en modelo Tenant

**Descripción:**
Como arquitecto de seguridad, quiero que los tokens de Shopify se encripten automáticamente al guardar en base de datos, para cumplir con mejores prácticas de seguridad y proteger credenciales de clientes.

**Criterios de Aceptación:**

- [ ] **CA11.1** - Renombrar campo shopify_access_token a _shopify_access_token_encrypted
- [ ] **CA11.2** - Implementar @property getter/setter para encriptación transparente
- [ ] **CA11.3** - Modificar seed.py para NO incluir tokens de Shopify (dejar NULL por seguridad)
- [ ] **CA11.4** - Crear .env.shopify.example y script configure_shopify_tokens.py (en .gitignore)
- [ ] **CA11.5** - Actualizar TenantService para manejar encriptación automática
- [ ] **CA11.6** - Crear tests de encriptación en `tests/models/test_tenant.py`
- [ ] **CA11.7** - Verificar integración con ShopifyService (transparencia)

**Archivos afectados:**
- `apps/backend/app/models/tenant.py` (modificar)
- `apps/backend/app/services/tenant.py` (modificar)
- `apps/backend/scripts/seed.py` (modificar - QUITAR tokens)
- `apps/backend/alembic/versions/XXX_rename_token_field.py` (migración)
- `apps/backend/.env.shopify.example` (nuevo)
- `apps/backend/.gitignore` (agregar .env.shopify.local)
- `apps/backend/tests/models/test_tenant.py` (tests)

---

### ✅ Historia 12: Integrar Shopify Service con Validación de Órdenes
**Estado:** 🔴 No iniciado

**Título:** Completar integración de Shopify para crear órdenes oficiales al validar pagos

**Descripción:**
Como gerente de logística, quiero que al validar el pago de una orden se complete automáticamente el draft order en Shopify, para sincronizar el estado entre nuestro sistema y Shopify sin intervención manual.

**Criterios de Aceptación:**

- [ ] **CA12.1** - Descomentar llamada a shopify_service.validate_and_complete_order() (líneas 317-323)
- [ ] **CA12.2** - Implementar manejo de errores de Shopify API (401, 404, 422, 429, timeouts)
- [ ] **CA12.3** - Actualizar orden local con shopify_order_id después de completar en Shopify
- [ ] **CA12.4** - Agregar logging estructurado para auditoría de operaciones Shopify
- [ ] **CA12.5** - Implementar idempotencia (verificar shopify_order_id existente, retornar 409)
- [ ] **CA12.6** - Manejar caso de tenant sin credenciales (retornar 424 Failed Dependency)
- [ ] **CA12.7** - Crear tests de integración con Shopify mock en `tests/api/test_orders_shopify.py`
- [ ] **CA12.8** - Documentar flujo completo en docstring del endpoint

**Archivos afectados:**
- `apps/backend/app/api/v1/endpoints/orders.py` (modificar líneas 236-337)
- `apps/backend/app/services/shopify.py` (verificar)
- `apps/backend/app/integrations/shopify_client.py` (verificar errores)
- `apps/backend/tests/api/test_orders_shopify.py` (nuevo)
- `apps/backend/app/schemas/order.py` (agregar shopify_order_id)

---

## 📅 Orden de Implementación Sugerido

### Sprint 1 - Backend Core (5-7 días)
1. ✅ Historia 1: Rol SUPER_ADMIN y tenant Ventia
2. ✅ Historia 2: Endpoints de tenants
3. ✅ Historia 3: Gestión global de usuarios

### Sprint 2 - Backend Auth (3-4 días)
4. ✅ Historia 4: Bypass de tenant filtering
5. ✅ Historia 5: Sistema de API Keys

### Sprint 3 - Frontend SuperAdmin (5-6 días)
6. ✅ Historia 6: Panel SuperAdmin base
7. ✅ Historia 7: UI de tenants
8. ✅ Historia 8: UI de usuarios

### Sprint 4 - Frontend API Keys (2-3 días)
9. ✅ Historia 9: UI de API Keys

### Sprint 5 - Shopify Integration (6-9 días)
10. ✅ Historia 10: Servicio de Encriptación
11. ✅ Historia 11: Encriptar Tokens de Shopify
12. ✅ Historia 12: Integrar Shopify Service

**Total estimado: 21-29 días de desarrollo**

---

## 🔐 Consideraciones de Seguridad

### API Keys
- ❌ NUNCA loggear keys completas, solo prefixes
- ✅ Hashear con bcrypt antes de guardar en BD
- ✅ Mostrar key completa SOLO en el momento de creación
- ✅ Validar expiración en cada request
- ✅ Rate limiting por API key

### SuperAdmin
- ✅ Auditar TODAS las acciones en logs
- ✅ No permitir desactivar al último SUPER_ADMIN
- ✅ Loggear cuando SuperAdmin accede a datos de otro tenant
- ✅ Mantener restricciones de escritura incluso para SuperAdmin

### Tenant Isolation
- ✅ Validar tenant_id en TODAS las operaciones de escritura
- ✅ Bypass solo para operaciones de lectura de SuperAdmin
- ✅ Verificar tenant en frontend Y backend

### General
- ✅ HTTPS obligatorio en producción
- ✅ Rate limiting global y por usuario/API key
- ✅ Rotación periódica de API keys
- ✅ Tokens JWT con expiración corta

### Shopify Integration
- ✅ Encriptar shopify_access_token con Fernet (AES-128 + HMAC)
- ❌ NUNCA subir tokens de Shopify a GitHub (seed.py sin tokens)
- ✅ Usar .env.shopify.local en .gitignore para tokens locales
- ✅ No loggear access tokens completos de Shopify
- ✅ Manejar errores de Shopify API sin exponer credenciales
- ✅ Implementar timeouts para evitar bloqueos en llamadas a Shopify
- ✅ Validar que tenant tiene credenciales antes de llamar a Shopify

---

## 📝 Notas de Implementación

### Testing
Cada historia debe incluir:
- Tests unitarios de modelos y servicios
- Tests de integración de endpoints
- Tests de autorización (verificar que solo SuperAdmin puede acceder)
- Tests de edge cases (último SuperAdmin, tenant inactivo, etc.)

### Documentación
- Swagger/OpenAPI debe estar actualizado con todos los endpoints
- Incluir ejemplos de request/response
- Documentar esquema de autenticación con API Key
- README de uso para integraciones n8n

### Migraciones
Orden de migraciones:
1. `XXX_add_is_platform_to_tenants.py`
2. `XXX_add_api_keys_table.py`
3. `XXX_rename_token_field.py` (renombrar shopify_access_token → _shopify_access_token_encrypted)
4. Correr seed.py para crear tenant Ventia y SuperAdmin (SIN tokens de Shopify)
5. Configurar tokens de Shopify manualmente o via script configure_shopify_tokens.py

---

## 🎯 Estado Global del Proyecto

**Progreso:** 0/12 historias completadas (0%)

**Última actualización:** 2025-01-15

**Responsable:** Equipo Backend/Frontend Ventia

---

## 📚 Referencias

- Plan completo: `C:\Users\Renzo\.claude\plans\gentle-coalescing-moonbeam.md`
- Documentación Auth0: https://auth0.com/docs
- Alembic Migrations: https://alembic.sqlalchemy.org/
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
