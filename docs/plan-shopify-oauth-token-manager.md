# Plan: Migración de Shopify API Key a OAuth2 con Token Manager

## Resumen Ejecutivo

**Objetivo:** Migrar el sistema de autenticación de Shopify de API Key estática a OAuth2 con gestión automática de tokens.

**Cambio principal:**
- **ANTES**: Frontend envía `access_token` → Backend guarda cifrado
- **AHORA**: Frontend envía `client_id` + `client_secret` → Backend los guarda cifrados y regenera `access_token` automáticamente

**Componentes nuevos:**
1. `ShopifyTokenManager` - Gestiona ciclo de vida de tokens OAuth2
2. Campos adicionales en `ShopifyCredentials` - `client_id`, `client_secret`, `expires_at`
3. Endpoint OAuth de Shopify - Para regenerar tokens cuando expiran

---

## Arquitectura Actual (Descubierta)

### 1. Storage Actual

**Ubicación:** `tenants.settings` (columna JSON en PostgreSQL)

```json
{
  "ecommerce": {
    "sync_on_validation": true,
    "shopify": {
      "store_url": "https://my-store.myshopify.com",
      "api_version": "2024-01",
      "access_token_encrypted": "gAAAAABf9K2_SxL..."
    }
  }
}
```

**Flujo de encriptación:**
- **Encrypt:** `encryption_service.encrypt(plaintext)` → Fernet AES-128-CBC
- **Decrypt:** `encryption_service.decrypt(ciphertext)` → plaintext
- **Key:** Derivado de `SECRET_KEY` con PBKDF2-SHA256

### 2. Uso Actual

**Inicialización:**
```python
# app/integrations/shopify_client.py
client = ShopifyClient(
    store_url=credentials.store_url,
    access_token=credentials.access_token,  # Ya desencriptado
    api_version=credentials.api_version
)
```

**Headers en requests:**
```python
{
    "X-Shopify-Access-Token": self.access_token
}
```

---

## Nueva Arquitectura (Propuesta)

### 1. Nuevo Storage

```json
{
  "ecommerce": {
    "sync_on_validation": true,
    "shopify": {
      "store_url": "https://my-store.myshopify.com",
      "api_version": "2025-10",

      // OAuth credentials (nuevos)
      "client_id_encrypted": "gAAAAABf9K2_...",
      "client_secret_encrypted": "gAAAAABf9K2_...",

      // Token gestionado (existente + nuevo campo)
      "access_token_encrypted": "gAAAAABf9K2_...",
      "access_token_expires_at": "2025-01-30T15:30:00Z"
    }
  }
}
```

### 2. Flujo de Request del Frontend

**Crear/Actualizar Tenant:**
```json
POST/PATCH /api/v1/tenants/{id}
{
  "ecommerce_platform": "shopify",
  "ecommerce_store_url": "https://my-store.myshopify.com",
  "shopify_client_id": "abc123",         // Nuevo
  "shopify_client_secret": "secret456",  // Nuevo
  "shopify_api_version": "2025-10"
}
```

**Notas:**
- Frontend NO envía `access_token` (será generado por el backend)
- `client_id` y `client_secret` se encriptan antes de guardar
- El backend genera el primer `access_token` inmediatamente tras recibir las credenciales

### 3. ShopifyTokenManager

**Archivo nuevo:** `app/integrations/shopify_token_manager.py`

**Responsabilidades:**
1. Validar si el token actual está expirado
2. Regenerar token usando OAuth2 si está expirado
3. Actualizar `access_token_encrypted` y `expires_at` en la BD
4. Devolver un token válido listo para usar
5. **CACHEAR tokens por tenant en la base de datos**

**Flujo interno:**
```
1. Obtener settings del tenant
2. Desencriptar client_id, client_secret, access_token
3. Verificar si access_token está expirado (comparar expires_at con datetime.utcnow())
4. Si NO está expirado:
   → Devolver access_token actual (CACHÉ HIT)
5. Si está expirado:
   → Llamar a Shopify OAuth2 endpoint
   → Obtener nuevo access_token + expires_in
   → Calcular expires_at = utcnow() + timedelta(seconds=expires_in)
   → Encriptar nuevo token
   → Actualizar tenant.settings con nuevo token y expires_at
   → Commit a la BD
   → Devolver nuevo access_token
```

### 4. OAuth2 de Shopify

**Endpoint:** `POST https://{store_url}/admin/oauth/access_token`

**Request:**
```json
{
  "client_id": "abc123",
  "client_secret": "secret456",
  "grant_type": "client_credentials"
}
```

**Response:**
```json
{
  "access_token": "shpat_xxx",
  "token_type": "Bearer",
  "expires_in": 86400,  // Segundos (típicamente 24 horas)
  "scope": "read_products,write_orders"
}
```

**Documentación oficial:**
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens

---

## Plan de Implementación

### Fase 1: Actualizar Schemas

**Archivos:**
- `apps/backend/app/schemas/tenant_settings.py`
- `apps/backend/app/schemas/tenant.py`

**Cambios:**
1. Agregar campos OAuth2 a `ShopifyCredentials`:
   - `client_id: str | None`
   - `client_secret: str | None`
   - `access_token_expires_at: datetime | None`

2. Agregar campos a `TenantCreate` y `TenantUpdate`:
   - `shopify_client_id: Optional[str]`
   - `shopify_client_secret: Optional[str]`
   - `shopify_api_version: Optional[str]`

3. Deprecar/eliminar `ecommerce_access_token`

---

### Fase 2: Actualizar Modelo Tenant

**Archivo:** `apps/backend/app/models/tenant.py`

**Cambios:**
1. `set_ecommerce_settings()` - Encriptar nuevos campos:
   - `client_id` → `client_id_encrypted`
   - `client_secret` → `client_secret_encrypted`
   - Guardar `access_token_expires_at` como ISO string

2. `get_settings()` - Desencriptar nuevos campos:
   - Desencriptar `client_id_encrypted` → `client_id`
   - Desencriptar `client_secret_encrypted` → `client_secret`
   - Parsear `access_token_expires_at` a datetime

---

### Fase 3: Implementar ShopifyTokenManager

**Archivo nuevo:** `apps/backend/app/integrations/shopify_token_manager.py`

**Clase:** `ShopifyTokenManager`

**Método principal:**
```python
async def get_valid_access_token(self, db: Session, tenant: Tenant) -> str:
    """
    Devuelve un access_token válido.

    Si el token está expirado, lo regenera automáticamente.
    Si el token es válido, lo devuelve del caché (BD).
    """
```

**Métodos privados:**
- `_is_token_valid()` - Verifica si el token aún no expiró
- `_refresh_token()` - Llama a Shopify OAuth2 endpoint
- `_update_token_in_settings()` - Actualiza tenant.settings con nuevo token

**Buffer de seguridad:** 5 minutos antes de expiración

---

### Fase 4: Actualizar TenantService

**Archivo:** `apps/backend/app/services/tenant.py`

**Cambios:**
1. `_build_ecommerce_settings()` - Construir settings con OAuth:
   - Usar `client_id` y `client_secret` del input
   - Dejar `access_token=None` (se generará después)

2. `create_tenant()` - Generar token inicial:
   - Después de crear tenant
   - Llamar a `shopify_token_manager.get_valid_access_token()`
   - Esto genera y guarda el primer token automáticamente

---

### Fase 5: Actualizar EcommerceService

**Archivo:** `apps/backend/app/services/ecommerce.py`

**Cambios:**
1. `_sync_shopify()` - Usar TokenManager:
   - Antes de crear `ShopifyClient`
   - Llamar a `shopify_token_manager.get_valid_access_token()`
   - Pasar el token obtenido al cliente

---

### Fase 6: Testing

#### Unit Tests

**Archivo nuevo:** `tests/unit/integrations/test_shopify_token_manager.py`

**Tests críticos:**
1. `test_token_valid_returns_cached_token_without_refresh()` - Verifica caché
2. `test_token_expired_triggers_refresh()` - Verifica renovación
3. `test_token_expires_soon_triggers_refresh()` - Verifica buffer de 5 min
4. `test_multiple_tenants_have_independent_tokens()` - Verifica multitenancy
5. `test_update_token_encrypts_and_persists()` - Verifica persistencia

**Total:** 14 tests unitarios

#### Integration Tests

**Archivo nuevo:** `tests/integration/test_shopify_oauth.py`

**Tests críticos:**
1. `test_create_tenant_with_oauth_generates_initial_token()` - Flujo completo
2. `test_order_validation_uses_cached_token()` - Verifica que usa caché
3. `test_order_validation_refreshes_expired_token()` - Verifica auto-refresh
4. `test_multiple_tenants_use_independent_cached_tokens()` - Multitenancy E2E

**Total:** 8 tests de integración

---

## Archivos a Modificar

### Nuevos Archivos
1. `apps/backend/app/integrations/shopify_token_manager.py`
2. `apps/backend/tests/unit/integrations/test_shopify_token_manager.py`
3. `apps/backend/tests/integration/test_shopify_oauth.py`

### Archivos a Modificar
1. `apps/backend/app/schemas/tenant_settings.py`
2. `apps/backend/app/schemas/tenant.py`
3. `apps/backend/app/models/tenant.py`
4. `apps/backend/app/services/tenant.py`
5. `apps/backend/app/services/ecommerce.py`

---

## Consideraciones de Seguridad

1. **Credenciales OAuth nunca se exponen:**
   - Se encriptan inmediatamente con Fernet
   - Responses NO incluyen estos valores
   - Solo viajan por HTTPS

2. **Tokens tienen vida limitada:**
   - Shopify tokens típicamente expiran en 24 horas
   - Se renuevan automáticamente antes de expirar
   - Buffer de 5 minutos para evitar race conditions

3. **Caché por tenant:**
   - Cada tenant tiene su propio token en la BD
   - No hay riesgo de mezclar tokens entre tenants
   - Los tokens se almacenan encriptados

4. **Backward compatibility:**
   - Tenants con `access_token` legacy siguen funcionando
   - Warning en logs para migrar a OAuth2

---

## Timeline Estimado

| Fase | Estimación | Descripción |
|------|-----------|-------------|
| Fase 1 | 1h | Actualizar schemas |
| Fase 2 | 1h | Actualizar modelo Tenant |
| Fase 3 | 3h | Implementar ShopifyTokenManager |
| Fase 4 | 1h | Actualizar TenantService |
| Fase 5 | 1h | Actualizar EcommerceService |
| Fase 6 | 2h | Tests unitarios e integración |
| Testing | 1h | Manual testing y validación |
| **TOTAL** | **~10h** | |

---

# HISTORIAS DE USUARIO

## US-001: Agregar Campos OAuth2 a Schemas de Shopify

**Descripción:**
Como desarrollador backend
Quiero agregar campos `client_id`, `client_secret` y `access_token_expires_at` a los schemas de Shopify
Para poder recibir y almacenar credenciales OAuth2 en lugar de API Keys estáticas

**Criterios de Aceptación:**
- [ ] `ShopifyCredentials` (tenant_settings.py) incluye campos nuevos:
  - `client_id: str | None`
  - `client_secret: str | None`
  - `access_token_expires_at: datetime | None`
- [ ] `TenantCreate` (tenant.py) incluye:
  - `shopify_client_id: Optional[str]`
  - `shopify_client_secret: Optional[str]`
  - `shopify_api_version: Optional[str]`
- [ ] `TenantUpdate` incluye los mismos campos opcionales
- [ ] Campo `ecommerce_access_token` está deprecado/eliminado del schema
- [ ] Todos los campos tienen descripciones claras en docstrings
- [ ] Los tipos son compatibles con Pydantic v2

---

## US-002: Implementar Encriptación de Credenciales OAuth2

**Descripción:**
Como administrador de seguridad
Quiero que las credenciales OAuth2 (`client_id`, `client_secret`) se encripten antes de guardarse en la base de datos
Para proteger información sensible de los tenants

**Criterios de Aceptación:**
- [ ] `Tenant.set_ecommerce_settings()` encripta:
  - `client_id` → `client_id_encrypted`
  - `client_secret` → `client_secret_encrypted`
  - `access_token` → `access_token_encrypted` (ya existente)
- [ ] `access_token_expires_at` se guarda como ISO string en JSON
- [ ] `Tenant.get_settings()` desencripta correctamente todos los campos
- [ ] Si un campo encriptado no existe, devuelve `None` sin fallar
- [ ] La encriptación usa el mismo `encryption_service` (Fernet) que el resto del sistema
- [ ] Los campos encriptados tienen sufijo `_encrypted` en el JSON de la BD

---

## US-003: Crear ShopifyTokenManager para Gestión Automática de Tokens

**Descripción:**
Como servicio backend
Quiero un gestor centralizado que valide y renueve automáticamente los tokens de Shopify
Para evitar que las operaciones fallen por tokens expirados y **cachear tokens por tenant de forma eficiente**

**Criterios de Aceptación:**
- [ ] Archivo nuevo `app/integrations/shopify_token_manager.py` creado
- [ ] Clase `ShopifyTokenManager` implementada con método público:
  - `async get_valid_access_token(db: Session, tenant: Tenant) -> str`
- [ ] **CACHÉ POR TENANT:** El método verifica si el token actual del tenant es válido antes de renovarlo
- [ ] **VALIDACIÓN DE EXPIRACIÓN:** Compara `access_token_expires_at` con `datetime.utcnow()` + buffer de 5 minutos
- [ ] Si el token es válido (no expirado), lo devuelve directamente **desde el caché de la BD**
- [ ] Si el token está expirado:
  - Llama a `POST {store_url}/admin/oauth/access_token`
  - Payload: `{"client_id": "...", "client_secret": "...", "grant_type": "client_credentials"}`
  - Actualiza `access_token_encrypted` y `access_token_expires_at` en `tenant.settings`
  - Hace commit a la BD
  - Devuelve el nuevo token
- [ ] Si faltan `client_id` o `client_secret`, lanza `ValueError` descriptivo
- [ ] Si la request a Shopify falla, lanza `ValueError` con detalles del error HTTP
- [ ] Maneja correctamente errores de red (`httpx.RequestError`)
- [ ] Usa `httpx.AsyncClient` con timeout de 30 segundos
- [ ] Singleton global `shopify_token_manager` exportado

---

## US-004: Generar Token Inicial al Crear Tenant con OAuth

**Descripción:**
Como usuario del sistema
Quiero que el sistema genere automáticamente el primer `access_token` cuando registro mis credenciales OAuth2
Para no tener que hacerlo manualmente y poder empezar a usar Shopify inmediatamente

**Criterios de Aceptación:**
- [ ] `TenantService._build_ecommerce_settings()` construye `ShopifyCredentials` con:
  - `client_id` y `client_secret` desde el input
  - `access_token=None` y `access_token_expires_at=None` (se generarán después)
- [ ] Al final de `TenantService.create_tenant()`:
  - Si `ecommerce_platform == "shopify"` y `shopify_client_id` está presente
  - Llama a `shopify_token_manager.get_valid_access_token(db, tenant)`
  - Esto genera y guarda el primer token automáticamente
- [ ] Si la generación del token inicial falla:
  - Se loguea el error (no falla la creación del tenant)
  - El tenant se crea exitosamente pero sin token
  - El token se generará en el primer uso
- [ ] Los logs incluyen mensaje `"Generated initial Shopify access token for tenant {tenant.id}"`

---

## US-005: Actualizar EcommerceService para Usar Tokens Gestionados

**Descripción:**
Como servicio de ecommerce
Quiero usar `ShopifyTokenManager` para obtener tokens válidos automáticamente
Para que las sincronizaciones con Shopify nunca fallen por tokens expirados

**Criterios de Aceptación:**
- [ ] `EcommerceService._sync_shopify()` importa y usa `shopify_token_manager`
- [ ] Antes de crear `ShopifyClient`, obtiene token válido:
  ```python
  access_token = await shopify_token_manager.get_valid_access_token(
      db=self.db,
      tenant=order.tenant
  )
  ```
- [ ] Pasa el token obtenido al constructor de `ShopifyClient`
- [ ] Si `get_valid_access_token()` falla, lanza `ValueError` descriptivo
- [ ] El servicio tiene acceso a `self.db` (sesión de base de datos)
- [ ] Los errores de token se distinguen claramente de errores de Shopify API

---

## US-006: Tests Unitarios de ShopifyTokenManager (Énfasis en Caché)

**Descripción:**
Como QA engineer
Quiero tests unitarios exhaustivos del `ShopifyTokenManager`
Para garantizar que **el cacheo de tokens por tenant funciona correctamente** y los tokens se renuevan solo cuando es necesario

**Criterios de Aceptación:**

### Tests de Validación de Token (Caché)
- [ ] **TEST CRÍTICO:** `test_token_valid_returns_cached_token_without_refresh()`
  - Token con `expires_at` en el futuro (>5 minutos)
  - No debe hacer request HTTP a Shopify
  - Debe devolver el token existente del tenant
  - Mock `httpx.AsyncClient` debe verificar que NO se llamó
- [ ] **TEST CRÍTICO:** `test_token_expired_triggers_refresh()`
  - Token con `expires_at` en el pasado
  - Debe hacer request a Shopify OAuth
  - Debe actualizar la BD con nuevo token
  - Debe devolver el nuevo token
- [ ] **TEST CRÍTICO:** `test_token_expires_soon_triggers_refresh()`
  - Token con `expires_at` dentro de los próximos 5 minutos
  - Debe renovar proactivamente (buffer de seguridad)
  - Verifica que el buffer `TOKEN_BUFFER_SECONDS = 300` funciona
- [ ] `test_missing_token_triggers_generation()`
  - Tenant sin `access_token` pero con OAuth credentials
  - Debe generar token inicial
- [ ] `test_missing_oauth_credentials_raises_error()`
  - Tenant sin `client_id` o `client_secret`
  - Debe lanzar `ValueError` claro

### Tests de Integración con Shopify OAuth
- [ ] `test_refresh_token_success()` (mock httpx)
  - Response: `{"access_token": "shpat_new", "expires_in": 86400}`
  - Verifica payload correcto: `grant_type=client_credentials`
  - Verifica headers y URL correctos
- [ ] `test_refresh_token_http_401_error()` (credenciales inválidas)
  - Mock response 401 de Shopify
  - Debe lanzar `ValueError` con status code
- [ ] `test_refresh_token_http_500_error()` (error de servidor)
  - Mock response 500
  - Debe lanzar `ValueError` descriptivo
- [ ] `test_refresh_token_network_error()` (sin conexión)
  - Mock `httpx.RequestError`
  - Debe lanzar `ValueError` con mensaje de red

### Tests de Persistencia (Caché en BD)
- [ ] **TEST CRÍTICO:** `test_update_token_encrypts_and_persists()`
  - Verifica que `access_token` se encripta antes de guardar
  - Verifica que `expires_at` se calcula correctamente (utcnow + expires_in)
  - Verifica que `tenant.settings` se actualiza y hace commit
- [ ] **TEST CRÍTICO:** `test_multiple_tenants_have_independent_tokens()`
  - Crea 2 tenants con diferentes credenciales OAuth
  - Obtiene token para tenant A
  - Obtiene token para tenant B
  - Verifica que cada uno tiene su propio token cacheado
  - Verifica que los tokens NO se mezclan entre tenants

### Archivo y Estructura
- [ ] Archivo: `tests/unit/integrations/test_shopify_token_manager.py`
- [ ] Usa `pytest-asyncio` para tests async
- [ ] Mocks: `httpx.AsyncClient`, `encryption_service`, `Session`
- [ ] Fixtures: `mock_tenant_with_shopify_oauth`, `mock_db`

---

## US-007: Tests de Integración de OAuth2 (Énfasis en Multitenancy)

**Descripción:**
Como QA engineer
Quiero tests de integración end-to-end del flujo OAuth2
Para verificar que **múltiples tenants pueden tener tokens cacheados simultáneamente** y el sistema maneja correctamente la multitenencia

**Criterios de Aceptación:**

### Tests de Flujo Completo con BD Real
- [ ] **TEST CRÍTICO:** `test_create_tenant_with_oauth_generates_initial_token()`
  - Crea tenant vía API con `shopify_client_id` y `shopify_client_secret`
  - Mock del request OAuth a Shopify (httpx)
  - Verifica que el tenant en BD tiene `access_token_encrypted` poblado
  - Verifica que `access_token_expires_at` está en el futuro
  - Lee el token desde la BD y verifica que está encriptado correctamente
- [ ] **TEST CRÍTICO:** `test_order_validation_uses_cached_token()`
  - Crea tenant con token válido (no expirado)
  - Valida una orden vía `/api/v1/orders/{id}/validate`
  - Mock de Shopify `draftOrderComplete` mutation
  - **Verifica que NO se hizo request a OAuth** (usa caché)
  - Verifica que la orden se completó exitosamente
- [ ] **TEST CRÍTICO:** `test_order_validation_refreshes_expired_token()`
  - Crea tenant con token expirado (`expires_at` en el pasado)
  - Valida una orden
  - **Verifica que se hizo request a OAuth para renovar**
  - Verifica que el nuevo token se guardó en la BD
  - Verifica que la orden se completó con el nuevo token
- [ ] **TEST SÚPER CRÍTICO:** `test_multiple_tenants_use_independent_cached_tokens()`
  - Crea 2 tenants (A y B) con diferentes credenciales OAuth
  - Genera token para tenant A (mock OAuth response A)
  - Genera token para tenant B (mock OAuth response B)
  - Valida orden de tenant A (debe usar token A cacheado)
  - Valida orden de tenant B (debe usar token B cacheado)
  - **Verifica que los tokens NO se cruzan entre tenants**
  - Verifica que cada tenant tiene su propio `access_token_encrypted` en la BD

### Tests de Errores
- [ ] `test_validation_fails_gracefully_when_oauth_unavailable()`
  - Tenant con token expirado
  - Mock OAuth que falla (network error)
  - Verifica que la validación falla con error claro
  - Verifica que NO se pierde el tenant (BD consistente)
- [ ] `test_validation_fails_when_oauth_credentials_invalid()`
  - Tenant con credenciales OAuth incorrectas
  - Mock OAuth que devuelve 401
  - Verifica error descriptivo al usuario

### Tests de Retrocompatibilidad (Opcional)
- [ ] `test_tenant_with_legacy_access_token_still_works()`
  - Tenant con `access_token` pero sin OAuth credentials
  - Validación debe funcionar (no auto-renueva)
  - Debe loguear warning sobre migrar a OAuth

### Archivo y Estructura
- [ ] Archivo: `tests/integration/test_shopify_oauth.py`
- [ ] Usa BD de prueba (no mock de Session)
- [ ] Usa `pytest-asyncio`
- [ ] Limpia datos entre tests (fixtures con `db.rollback()`)
- [ ] Mocks solo para requests HTTP externos (Shopify API)

---

## NOTAS IMPORTANTES SOBRE CACHÉ DE TOKENS

### ¿Dónde se cachea el token?
El token se **cachea en la base de datos** dentro de `tenants.settings`:
```json
{
  "ecommerce": {
    "shopify": {
      "access_token_encrypted": "gAAAAAB...",
      "access_token_expires_at": "2026-01-23T15:30:00Z"
    }
  }
}
```

### ¿Cómo funciona el caché?
1. **Lectura del caché:** `get_valid_access_token()` lee el token del tenant desde la BD
2. **Validación:** Compara `expires_at` con el tiempo actual
3. **Cache hit:** Si el token es válido, lo devuelve directamente (sin HTTP request)
4. **Cache miss:** Si expiró, hace request OAuth, actualiza la BD, y devuelve el nuevo token

### ¿Por qué es importante testear esto?
- **Multitenancy:** Cada tenant debe tener su propio caché independiente
- **Performance:** No queremos hacer requests OAuth innecesarios
- **Seguridad:** Los tokens no deben cruzarse entre tenants
- **Confiabilidad:** El sistema debe funcionar incluso con múltiples tenants usando Shopify simultáneamente

### Tests Prioritarios (CRÍTICOS)
Los siguientes tests son **SUPER IMPORTANTES** y deben implementarse con máxima atención:

1. `test_token_valid_returns_cached_token_without_refresh()` - Garantiza que el caché funciona
2. `test_multiple_tenants_have_independent_tokens()` - Garantiza aislamiento por tenant
3. `test_multiple_tenants_use_independent_cached_tokens()` - Garantiza multitenancy en integración
4. `test_order_validation_uses_cached_token()` - Garantiza que el flujo real usa caché
5. `test_update_token_encrypts_and_persists()` - Garantiza persistencia correcta

---

## Verificación

### Manual Testing

```bash
# 1. Crear tenant con OAuth credentials
curl -X POST http://localhost:8000/api/v1/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Store",
    "ecommerce_platform": "shopify",
    "ecommerce_store_url": "https://test-store.myshopify.com",
    "shopify_client_id": "abc123",
    "shopify_client_secret": "secret456"
  }'

# 2. Verificar que se generó el access_token inicial
# (revisar logs o BD directamente)

# 3. Validar una orden (debería usar el token generado)
curl -X POST http://localhost:8000/api/v1/orders/{id}/validate \
  -H "Authorization: Bearer $TOKEN"

# 4. Simular token expirado (modificar expires_at en BD)
# UPDATE tenants SET settings = jsonb_set(
#   settings,
#   '{ecommerce,shopify,access_token_expires_at}',
#   '"2020-01-01T00:00:00Z"'
# ) WHERE id = 1;

# 5. Validar orden nuevamente (debería auto-renovar el token)
curl -X POST http://localhost:8000/api/v1/orders/{id}/validate \
  -H "Authorization: Bearer $TOKEN"
```

### Automated Tests

```bash
cd apps/backend

# Run token manager tests
uv run pytest tests/unit/integrations/test_shopify_token_manager.py -v

# Run integration tests
uv run pytest tests/integration/test_shopify_oauth.py -v

# Run all tests
uv run pytest tests/ -v
```

---

## Próximos Pasos Después de Implementar

1. **Documentar en el README:**
   - Cómo obtener `client_id` y `client_secret` de Shopify
   - Flujo de autenticación OAuth2
   - Troubleshooting de tokens expirados

2. **Frontend:**
   - Actualizar formularios para pedir `client_id` y `client_secret`
   - Eliminar campo `access_token`
   - Mostrar indicador de "OAuth configurado" en settings

3. **Monitoring:**
   - Logs de renovación de tokens
   - Alertas si la renovación falla consistentemente
   - Métricas de uso de tokens

4. **Migración de producción:**
   - Ejecutar script de migración en tenants existentes
   - Notificar a usuarios para actualizar a OAuth2
   - Deprecated warning para access_token legacy
