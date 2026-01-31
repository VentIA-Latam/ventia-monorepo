# Sprint 4: Integración WooCommerce

## Objetivo
Integrar WooCommerce como segunda plataforma de e-commerce, unificando la configuración en el campo `settings` JSON del tenant.

---

## US-001: Crear schemas tipados para settings de tenant

**Etiquetas:** `backend`

### Descripción
Como desarrollador backend, necesito schemas Pydantic tipados para la configuración de e-commerce en el campo `settings` JSON del tenant, para garantizar validación y autocompletado en el código.

### Criterios de Aceptación
- [ ] Crear archivo `app/schemas/tenant_settings.py`
- [ ] Implementar `ShopifyCredentials` con campos: `store_url`, `access_token`, `api_version`
- [ ] Implementar `WooCommerceCredentials` con campos: `store_url`, `consumer_key`, `consumer_secret`
- [ ] Implementar `EcommerceSettings` con:
  - Campo `sync_on_validation: bool` (default `True`)
  - Campos opcionales `shopify` y `woocommerce`
  - Validador que asegure solo una plataforma configurada a la vez
  - Property `platform` que retorne `"shopify"`, `"woocommerce"` o `None`
  - Property `has_ecommerce` que retorne `True` si hay plataforma configurada
- [ ] Implementar `TenantSettings` como wrapper con campo `ecommerce`
- [ ] Todos los schemas deben tener docstrings descriptivos

---

## US-002: Implementar métodos get/set de ecommerce settings en Tenant

**Etiquetas:** `backend`

### Descripción
Como desarrollador backend, necesito métodos en el modelo Tenant para leer y escribir la configuración de e-commerce con cifrado/descifrado automático de credenciales sensibles.

### Criterios de Aceptación
- [ ] Implementar método `get_settings()` en modelo Tenant que:
  - Lea el campo `settings` JSON
  - Descifre `access_token_encrypted` de Shopify si existe
  - Descifre `consumer_key_encrypted` y `consumer_secret_encrypted` de WooCommerce si existen
  - Soporte fallback a columnas legacy (`shopify_store_url`, `_shopify_access_token_encrypted`) si no hay config en settings
  - Retorne objeto `TenantSettings` tipado
- [ ] Implementar método `set_ecommerce_settings(ecommerce: EcommerceSettings)` que:
  - Reciba objeto `EcommerceSettings` con credenciales en texto plano
  - Cifre las credenciales sensibles antes de guardar
  - Almacene en `settings["ecommerce"]` con sufijo `_encrypted` en campos sensibles
- [ ] Las credenciales nunca deben quedar en texto plano en la base de datos
- [ ] Manejar errores de descifrado gracefully (retornar `None` si falla)

---

## US-003: Crear cliente HTTP para WooCommerce REST API

**Etiquetas:** `backend`

### Descripción
Como sistema, necesito un cliente HTTP para comunicarme con la API REST de WooCommerce para gestionar órdenes.

### Criterios de Aceptación
- [ ] Crear archivo `app/integrations/woocommerce_client.py`
- [ ] Implementar clase `WooCommerceClient` con:
  - Constructor que reciba `store_url`, `consumer_key`, `consumer_secret`
  - Autenticación HTTP Basic Auth con credenciales codificadas en base64
  - Base URL: `{store_url}/wp-json/wc/v3`
  - Timeout de 30 segundos
- [ ] Implementar método `_request(method, endpoint, data)` para peticiones HTTP genéricas
- [ ] Implementar método `get_order(order_id: int)` para obtener una orden
- [ ] Implementar método `mark_order_as_paid(order_id: int)` que:
  - Envíe PUT a `/orders/{id}` con `{"set_paid": true}`
  - Retorne la orden actualizada con `date_paid` y `status: "processing"`
- [ ] Implementar método `update_order_status(order_id: int, status: str)`
- [ ] Propagar errores HTTP correctamente (`raise_for_status()`)

---

## US-004: Agregar soporte para órdenes WooCommerce en modelo Order

**Etiquetas:** `backend`

### Descripción
Como sistema, necesito almacenar el ID de órdenes provenientes de WooCommerce para poder sincronizar el estado de pago.

### Criterios de Aceptación
- [ ] Agregar campo `woocommerce_order_id: Integer` (nullable, indexed) al modelo Order
- [ ] Agregar `UniqueConstraint("tenant_id", "woocommerce_order_id", name="uq_tenant_woo_order")` al modelo
- [ ] Implementar property `source_platform` que retorne:
  - `"shopify"` si `shopify_draft_order_id` existe
  - `"woocommerce"` si `woocommerce_order_id` existe
  - `None` si ninguno existe
- [ ] Crear migración Alembic que incluya: campo + constraint
- [ ] Agregar método `get_by_woocommerce_order_id(db, tenant_id, woocommerce_order_id)` al repositorio
- [ ] Actualizar `create_order()` en servicio para verificar duplicados WooCommerce usando el nuevo método
- [ ] Actualizar `OrderCreate` schema para aceptar `woocommerce_order_id: int | None`
- [ ] Agregar validador en `OrderCreate` que asegure:
  - Al menos uno de `shopify_draft_order_id` o `woocommerce_order_id` debe estar presente
  - No pueden estar ambos presentes simultáneamente
- [ ] Actualizar `OrderResponse` para incluir `woocommerce_order_id`

---

## US-005: Crear servicio unificado de e-commerce para validación de órdenes

**Etiquetas:** `backend`

### Descripción
Como sistema, necesito un servicio unificado que maneje la validación de pago de órdenes independientemente de la plataforma de e-commerce configurada.

### Criterios de Aceptación
- [ ] Crear archivo `app/services/ecommerce.py`
- [ ] Implementar clase `EcommerceService` con método `validate_order()` que:
  - Reciba `db`, `order`, `payment_method` (opcional), `notes` (opcional)
  - Obtenga configuración del tenant via `tenant.get_settings()`
  - Si `has_ecommerce=False` o `sync_on_validation=False`: solo actualice local
  - Si `platform="shopify"` y `sync_on_validation=True`: llame a ShopifyClient
  - Si `platform="woocommerce"` y `sync_on_validation=True`: llame a WooCommerceClient
  - Actualice la orden con: `validado=True`, `validated_at=now()`, `status="Pagado"`
  - Guarde `shopify_order_id` si viene de Shopify
  - Retorne la orden actualizada
- [ ] Implementar método privado `_sync_shopify(order, credentials)`
- [ ] Implementar método privado `_sync_woocommerce(order, credentials)`
- [ ] Exportar instancia global `ecommerce_service`

---

## US-006: Actualizar endpoint de validación para usar servicio unificado

**Etiquetas:** `backend`

### Descripción
Como API, necesito que el endpoint de validación de pago use el nuevo servicio unificado de e-commerce para soportar múltiples plataformas.

### Criterios de Aceptación
- [ ] Modificar `POST /orders/{order_id}/validate` para usar `ecommerce_service`
- [ ] Antes de validar, verificar coherencia:
  - Si `platform="shopify"` y `sync=True`: orden debe tener `shopify_draft_order_id`
  - Si `platform="woocommerce"` y `sync=True`: orden debe tener `woocommerce_order_id`
  - Retornar HTTP 400 con mensaje claro si no coincide
- [ ] Manejar errores de e-commerce:
  - HTTP 401 de e-commerce → HTTP 401 "Credenciales de e-commerce inválidas"
  - HTTP 404 de e-commerce → HTTP 404 "Orden no encontrada en e-commerce"
  - Otros errores → HTTP 502 con mensaje descriptivo
- [ ] Mantener compatibilidad con flujo actual de Shopify
- [ ] Logging de operaciones de sincronización (éxito/error)

---

## US-007: Actualizar seed.py para usar settings JSON de e-commerce

**Etiquetas:** `backend`

### Descripción
Como desarrollador, necesito que el script de seed cree los tenants de prueba usando el nuevo formato `settings` JSON para e-commerce, en lugar de las columnas legacy de Shopify.

### Criterios de Aceptación
- [ ] Actualizar `scripts/seed.py` para usar `tenant.set_ecommerce_settings()` en lugar de columnas legacy
- [ ] Crear tenant de prueba con Shopify configurado via settings JSON
- [ ] Crear tenant de prueba con WooCommerce configurado via settings JSON
- [ ] Crear tenant de prueba sin e-commerce (para probar flujo sin sync)
- [ ] Verificar que `tenant.get_settings()` retorne correctamente las credenciales descifradas
- [ ] Las columnas legacy (`shopify_store_url`, `_shopify_access_token_encrypted`) ya no se usan en seed

---

## US-008: Actualizar schemas de Tenant para configuración de e-commerce

**Etiquetas:** `backend`

### Descripción
Como API, necesito que los schemas de Tenant soporten la configuración de e-commerce via settings para crear y actualizar tenants con WooCommerce.

### Criterios de Aceptación
- [ ] Actualizar `TenantCreate` para aceptar:
  - `ecommerce_platform: Literal["shopify", "woocommerce"] | None`
  - `ecommerce_store_url: str | None`
  - `ecommerce_access_token: str | None` (para Shopify)
  - `ecommerce_consumer_key: str | None` (para WooCommerce)
  - `ecommerce_consumer_secret: str | None` (para WooCommerce)
  - `sync_on_validation: bool = True`
- [ ] Actualizar `TenantUpdate` con los mismos campos opcionales
- [ ] El servicio debe construir el `settings.ecommerce` JSON internamente:
  ```json
  {
    "ecommerce": {
      "sync_on_validation": true,
      "woocommerce": {
        "store_url": "...",
        "consumer_key_encrypted": "...",
        "consumer_secret_encrypted": "..."
      }
    }
  }
  ```
- [ ] Actualizar `TenantResponse` para incluir `settings` con estructura pero SIN credenciales
- [ ] **NUNCA** incluir `access_token`, `consumer_key` ni `consumer_secret` en responses
- [ ] Validadores de URL para `ecommerce_store_url`
- [ ] Actualizar servicio de tenant para manejar nuevos campos

---

## US-009: Corregir espaciado del botón toggle del sidebar

**Etiquetas:** `frontend`, `fix`

### Descripción
Como usuario, necesito que el botón para colapsar/expandir el sidebar sea completamente visible y accesible cuando el sidebar está colapsado.

### Contexto Técnico
- **Archivo**: `apps/frontend/app/dashboard/layout.tsx:34`
- El `SidebarTrigger` tiene clase `-ml-1` que puede causar que se oculte parcialmente
- El sidebar colapsado tiene ancho `4.5rem`

### Criterios de Aceptación
- [ ] Ajustar el espaciado del `SidebarTrigger` en `app/dashboard/layout.tsx`
- [ ] Verificar que el botón sea completamente visible cuando el sidebar está colapsado
- [ ] El mismo ajuste debe aplicarse a `app/superadmin/layout.tsx` si aplica
- [ ] Probar en diferentes resoluciones de pantalla

---

## US-010: Remover opciones API-key y Series del sidebar de clientes

**Etiquetas:** `frontend`, `refactor`

### Descripción
Como plataforma, necesito que las opciones "Series de facturación" y "Credenciales (API Key)" no sean visibles para los clientes finales, ya que estas funcionalidades serán gestionadas exclusivamente por el superadmin.

### Contexto Técnico
- **Archivo**: `apps/frontend/components/dashboard/app-sidebar.tsx`
- Array `dataConfiguration` (líneas 91-102) define estos items
- El dropdown del perfil (líneas 319-336) muestra estos links para usuarios no-superadmin

### Criterios de Aceptación
- [ ] Remover el array `dataConfiguration` del `app-sidebar.tsx` (ya que no se renderiza en el sidebar principal)
- [ ] Remover del dropdown del perfil (líneas 319-336) los items:
  - "Series de facturación" (`/dashboard/invoices/series`)
  - "Credenciales (API Key)" (`/dashboard/settings/api-keys`)
- [ ] Verificar que solo superadmin pueda acceder a estas rutas (agregar protección en middleware si no existe)
- [ ] Los clientes finales no deben ver estas opciones en ningún menú

---

## US-011: Agregar gestión de Series de facturación al panel SuperAdmin

**Etiquetas:** `frontend`, `feature`

### Descripción
Como superadmin, necesito poder gestionar las series de facturación de cada tenant desde el panel de administración.

### Contexto Técnico
- **Archivo**: `apps/frontend/components/superadmin/superadmin-sidebar.tsx`
- Ya existe `/superadmin/api-keys` en el menú (línea 61-64)
- Falta agregar "Series de facturación"

### Criterios de Aceptación
- [ ] Agregar item "Series de facturación" al menú del superadmin en `superadmin-sidebar.tsx`:
  ```typescript
  {
    title: "Series de facturación",
    url: "/superadmin/series",
    icon: FileBarChart,
  }
  ```
- [ ] Crear página `apps/frontend/app/superadmin/series/page.tsx` con:
  - Selector de tenant para filtrar
  - Tabla con las series del tenant seleccionado
  - Funcionalidad de crear/editar/eliminar series
- [ ] Actualizar `app/superadmin/layout.tsx` para incluir el título de esta página
- [ ] Reutilizar componentes existentes de series si es posible

---

## US-012: Implementar selección de plataforma e-commerce en modal de crear tenant

**Etiquetas:** `frontend`, `feature`

### Descripción
Como superadmin, necesito seleccionar la plataforma de e-commerce (Shopify o WooCommerce) al crear un tenant, en lugar de solo poder configurar Shopify.

### Contexto Técnico
- **Archivo**: `apps/frontend/components/superadmin/create-tenant-dialog.tsx`
- Actualmente pide directamente: `shopify_store_url`, `shopify_access_token`, `shopify_api_version`

### Criterios de Aceptación
- [ ] Reemplazar campos directos de Shopify por selector de plataforma:
  - Mostrar 2 botones/cards con iconos: Shopify y WooCommerce
  - Opción de "Sin e-commerce" (ninguna plataforma)
- [ ] Al seleccionar **Shopify** mostrar campos:
  - URL de tienda (`https://mi-tienda.myshopify.com`)
  - Token de acceso (password input)
  - Versión API (default: "2024-01")
- [ ] Al seleccionar **WooCommerce** mostrar campos:
  - URL de tienda (`https://mi-tienda.com`)
  - Consumer Key (password input)
  - Consumer Secret (password input)
- [ ] Agregar toggle "Sincronizar al validar pago" (default: activado)
- [ ] Actualizar el estado del formulario:
  ```typescript
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    ecommerce_platform: null as "shopify" | "woocommerce" | null,
    ecommerce_store_url: "",
    // Shopify
    ecommerce_access_token: "",
    shopify_api_version: "2024-01",
    // WooCommerce
    ecommerce_consumer_key: "",
    ecommerce_consumer_secret: "",
    sync_on_validation: true,
  });
  ```
- [ ] Actualizar el `handleSubmit` para enviar datos según plataforma seleccionada
- [ ] Los campos de credenciales deben ser requeridos solo si se selecciona una plataforma
- [ ] Agregar iconos de Shopify y WooCommerce (usar `react-icons` o SVG)

---

## US-013: Implementar selección de plataforma e-commerce en modal de editar tenant

**Etiquetas:** `frontend`, `feature`

### Descripción
Como superadmin, necesito poder cambiar o actualizar la configuración de e-commerce de un tenant existente, incluyendo cambiar de Shopify a WooCommerce o viceversa.

### Contexto Técnico
- **Archivo**: `apps/frontend/components/superadmin/edit-tenant-dialog.tsx`
- Actualmente solo permite actualizar campos de Shopify

### Criterios de Aceptación
- [ ] Mostrar la plataforma actualmente configurada (si existe) en el formulario
- [ ] Permitir cambiar de plataforma mostrando advertencia:
  - "Al cambiar de plataforma se perderán las credenciales anteriores"
- [ ] Implementar misma lógica de selección que US-012:
  - Botones Shopify / WooCommerce / Sin e-commerce
  - Campos dinámicos según selección
- [ ] Si hay plataforma actual, pre-seleccionar y mostrar URL (nunca tokens/keys)
- [ ] Campos de credenciales opcionales en edición:
  - "Dejar vacío para mantener las credenciales actuales"
  - Si se completan, se reemplazan las anteriores
- [ ] Toggle "Sincronizar al validar pago" con valor actual del tenant
- [ ] Actualizar estado inicial desde `tenant.settings` si existe:
  ```typescript
  useEffect(() => {
    if (tenant) {
      const platform = tenant.settings?.ecommerce?.shopify ? "shopify"
        : tenant.settings?.ecommerce?.woocommerce ? "woocommerce" : null;
      setFormData({
        ...formData,
        ecommerce_platform: platform,
        ecommerce_store_url: tenant.settings?.ecommerce?.shopify?.store_url
          || tenant.settings?.ecommerce?.woocommerce?.store_url || "",
        sync_on_validation: tenant.settings?.ecommerce?.sync_on_validation ?? true,
      });
    }
  }, [tenant]);
  ```

---

## US-014: Actualizar tipos TypeScript de Tenant para soportar settings

**Etiquetas:** `frontend`, `types`

### Descripción
Como desarrollador frontend, necesito tipos TypeScript actualizados para manejar la nueva estructura de `settings` del tenant con soporte para múltiples plataformas de e-commerce.

### Contexto Técnico
- **Archivo**: `apps/frontend/lib/types/tenant.ts`
- Actualmente solo tiene campos de Shopify directos

### Criterios de Aceptación
- [ ] Crear/actualizar tipos en `lib/types/tenant.ts`:
  ```typescript
  interface ShopifyConfig {
    store_url: string;
    api_version?: string;
    // access_token nunca viene del backend
  }

  interface WooCommerceConfig {
    store_url: string;
    // consumer_key y consumer_secret nunca vienen del backend
  }

  interface EcommerceSettings {
    sync_on_validation: boolean;
    shopify?: ShopifyConfig;
    woocommerce?: WooCommerceConfig;
  }

  interface TenantSettings {
    ecommerce?: EcommerceSettings;
  }

  interface Tenant {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
    settings?: TenantSettings;
    // Legacy fields (deprecated)
    shopify_store_url?: string;
    created_at: string;
    updated_at: string;
  }
  ```
- [ ] Agregar helper type para plataforma:
  ```typescript
  type EcommercePlatform = "shopify" | "woocommerce" | null;
  ```
- [ ] Actualizar cualquier referencia a campos legacy de Shopify en el frontend

---

## US-015: Mostrar plataforma e-commerce en tabla de gestión de tenants

**Etiquetas:** `frontend`, `feature`

### Descripción
Como superadmin, necesito ver qué plataforma de e-commerce tiene configurada cada tenant en la tabla de gestión.

### Contexto Técnico
- **Archivo**: `apps/frontend/app/superadmin/tenants/page.tsx`
- Actualmente muestra "TIENDA SHOPIFY" como columna

### Criterios de Aceptación
- [ ] Cambiar columna "TIENDA SHOPIFY" por "E-COMMERCE"
- [ ] Mostrar badge con icono de la plataforma:
  - Icono Shopify + URL si es Shopify
  - Icono WooCommerce + URL si es WooCommerce
  - Badge gris "Sin configurar" si no hay plataforma
- [ ] La URL debe ser clickeable y abrir en nueva pestaña
- [ ] El badge debe indicar si `sync_on_validation` está activo:
  - Indicador verde si está activo
  - Indicador gris si está desactivado

---

## Resumen del Sprint

| ID | Historia | Etiquetas | Dependencias |
|----|----------|-----------|--------------|
| US-001 | Schemas de settings | `backend` | - |
| US-002 | Métodos get/set en Tenant | `backend` | US-001 |
| US-003 | WooCommerce Client | `backend` | - |
| US-004 | Campo woocommerce_order_id | `backend` | - |
| US-005 | EcommerceService | `backend` | US-001, US-002, US-003 |
| US-006 | Actualizar endpoint validate | `backend` | US-005 |
| US-007 | Actualizar seed.py | `backend` | US-002 |
| US-008 | Schemas de Tenant | `backend` | US-001 |
| US-009 | Fix botón toggle sidebar | `frontend` | - |
| US-010 | Remover API-key/Series de clientes | `frontend` | - |
| US-011 | Series en panel SuperAdmin | `frontend` | US-010 |
| US-012 | Selector plataforma en crear tenant | `frontend` | US-008, US-014 |
| US-013 | Selector plataforma en editar tenant | `frontend` | US-008, US-014 |
| US-014 | Tipos TypeScript de Tenant | `frontend` | US-008 |
| US-015 | Mostrar plataforma en tabla tenants | `frontend` | US-014 |

### Orden de implementación sugerido

**Backend (primero):**
1. US-001 (schemas base)
2. US-003 (WooCommerce client - paralelo)
3. US-004 (campo en Order - paralelo)
4. US-002 (métodos en Tenant)
5. US-008 (schemas de Tenant)
6. US-005 (servicio unificado)
7. US-006 (endpoint)
8. US-007 (actualizar seed.py)

**Frontend (puede iniciar en paralelo con fixes):**
1. US-009 (fix sidebar - independiente)
2. US-010 (remover opciones - independiente)
3. US-011 (series superadmin - después de US-010)
4. US-014 (tipos TypeScript - después de US-008 backend)
5. US-012 (crear tenant dialog - después de US-014)
6. US-013 (editar tenant dialog - después de US-012)
7. US-015 (tabla de tenants - después de US-014)
