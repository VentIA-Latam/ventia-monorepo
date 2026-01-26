# Plan Frontend: Migración Shopify a OAuth2

## Resumen Ejecutivo

**Objetivo:** Actualizar el frontend para soportar la nueva autenticación OAuth2 de Shopify implementada en el backend.

**Cambio principal:**
- **ANTES**: Formularios envían `shopify_access_token` (token permanente)
- **AHORA**: Formularios envían `shopify_client_id` + `shopify_client_secret` (credenciales OAuth2)

**Componentes afectados:**
1. Tipos TypeScript (`lib/types/tenant.ts`)
2. Diálogo de creación de tenant (`components/superadmin/create-tenant-dialog.tsx`)
3. Diálogo de edición de tenant (`components/superadmin/edit-tenant-dialog.tsx`)
4. Página de detalles de tenant (`app/superadmin/tenants/[id]/page.tsx`)

---

## Historias de Usuario

### US-FE-001: Actualizar Tipos TypeScript para OAuth2

**Como** desarrollador frontend
**Quiero** actualizar las interfaces TypeScript para reflejar las nuevas credenciales OAuth2
**Para** mantener la type-safety y facilitar el desarrollo

#### Descripción

Actualizar las interfaces en `lib/types/tenant.ts` para reemplazar el campo `shopify_access_token` con los nuevos campos `shopify_client_id` y `shopify_client_secret` en las interfaces `TenantCreate` y `TenantUpdate`.

#### Criterios de Aceptación

- [ ] Interface `TenantCreate` incluye:
  - `shopify_client_id?: string` (nuevo)
  - `shopify_client_secret?: string` (nuevo)
  - `shopify_api_version?: string` (existente)
  - `shopify_store_url?: string` (existente)
- [ ] Interface `TenantUpdate` incluye los mismos campos OAuth2
- [ ] Campo `shopify_access_token` removido de ambas interfaces
- [ ] Interface `ShopifyConfig` permanece sin cambios (solo lectura desde backend)
- [ ] No hay errores de TypeScript en el proyecto
- [ ] Los tipos se importan correctamente en componentes que los usan

#### Archivos a Modificar

- `apps/frontend/lib/types/tenant.ts` (líneas ~40-80)

---

### US-FE-002: Actualizar Formulario de Creación de Tenant

**Como** SuperAdmin
**Quiero** ingresar Client ID y Client Secret al crear un nuevo tenant con Shopify
**Para** que el sistema genere automáticamente los access tokens de Shopify

#### Descripción

Modificar el componente `CreateTenantDialog` para reemplazar el campo "Access Token" con dos campos nuevos: "Client ID" y "Client Secret". Estos campos deben tener las mismas características de seguridad (encriptación backend) y validación que el campo anterior.

#### Criterios de Aceptación

- [ ] Formulario muestra dos campos nuevos cuando se selecciona plataforma "Shopify":
  - **Client ID de Shopify**
    - Label: "Client ID de Shopify"
    - Tipo: `text`
    - Placeholder: "abc123..."
    - Descripción: "Client ID de tu app de Shopify (se encriptará antes de guardarse)"
    - Requerido si plataforma es Shopify
  - **Client Secret de Shopify**
    - Label: "Client Secret de Shopify"
    - Tipo: `password`
    - Placeholder: "secret456..."
    - Descripción: "Client Secret de tu app de Shopify (se encriptará antes de guardarse)"
    - Requerido si plataforma es Shopify
- [ ] Campo anterior "Access Token de Shopify" está completamente removido
- [ ] Validación muestra error si falta Client ID o Client Secret cuando plataforma es Shopify
- [ ] Al enviar el formulario, el payload incluye:
  ```json
  {
    "shopify_client_id": "valor ingresado",
    "shopify_client_secret": "valor ingresado"
  }
  ```
- [ ] Campos NO se envían si la plataforma no es Shopify
- [ ] UI mantiene consistencia con diseño actual (shadcn/ui)
- [ ] Nota informativa sobre generación automática de tokens visible:
  - "El access token se generará automáticamente en el servidor"

#### Archivos a Modificar

- `apps/frontend/components/superadmin/create-tenant-dialog.tsx` (líneas ~120-180)

---

### US-FE-003: Actualizar Formulario de Edición de Tenant

**Como** SuperAdmin
**Quiero** poder actualizar las credenciales OAuth2 de Shopify de un tenant existente
**Para** renovar o corregir la configuración sin perder otros datos

#### Descripción

Modificar el componente `EditTenantDialog` para reemplazar el campo "Access Token" con los campos OAuth2. Además, actualizar la lógica de detección de plataforma configurada para verificar `client_id` en lugar de `access_token`.

#### Criterios de Aceptación

**Campos del Formulario:**
- [ ] Formulario muestra dos campos OAuth2 cuando plataforma es "Shopify":
  - Client ID de Shopify (tipo `text`)
  - Client Secret de Shopify (tipo `password`)
- [ ] Ambos campos son **opcionales** al editar (solo se actualizan si se ingresan valores nuevos)
- [ ] Placeholder indica "Dejar vacío para mantener actual"
- [ ] Campo "Access Token" removido completamente

**Detección de Plataforma Existente:**
- [ ] Lógica actualizada para detectar Shopify basándose en:
  ```typescript
  const hasShopify = !!tenant.settings?.ecommerce?.shopify?.client_id
  ```
  (antes verificaba `access_token`)
- [ ] Pre-carga correcta de plataforma en el selector (Shopify/WooCommerce/Ninguna)

**Cambio de Plataforma:**
- [ ] Al cambiar de WooCommerce a Shopify:
  - Muestra campos OAuth2 de Shopify
  - Limpia campos de WooCommerce del payload
  - Muestra advertencia destructiva existente
- [ ] Al cambiar de Shopify a WooCommerce:
  - Oculta campos OAuth2 de Shopify
  - Muestra campos de WooCommerce
  - Limpia campos de Shopify del payload

**Validación:**
- [ ] Si se cambia a plataforma Shopify (desde otra), Client ID y Secret son **requeridos**
- [ ] Si ya tiene Shopify y solo se editan otros campos, OAuth2 es opcional

**Payload Enviado:**
- [ ] Solo incluye `shopify_client_id` y `shopify_client_secret` si se ingresaron valores
- [ ] No envía `shopify_access_token` (campo eliminado)
- [ ] Mantiene `shopify_api_version` y `shopify_store_url` si se modificaron

#### Archivos a Modificar

- `apps/frontend/components/superadmin/edit-tenant-dialog.tsx` (líneas ~80-200)

---

### US-FE-004: Actualizar Página de Detalles de Tenant

**Como** SuperAdmin
**Quiero** ver información clara sobre las credenciales OAuth2 configuradas
**Para** verificar qué tipo de autenticación está usando el tenant

#### Descripción

Actualizar la sección "Configuración de E-commerce" en la página de detalles del tenant para mostrar los campos OAuth2 en lugar del access token permanente. Debe educar al usuario sobre la auto-renovación de tokens.

#### Criterios de Aceptación

**Sección de Credenciales Shopify:**
- [ ] Muestra tres campos de credenciales (en lugar de uno):
  1. **Client ID**
     - Etiqueta: "Client ID"
     - Valor: `••••••••••••••••` (oculto por seguridad)
  2. **Client Secret**
     - Etiqueta: "Client Secret"
     - Valor: `••••••••••••••••` (oculto por seguridad)
  3. **Access Token**
     - Etiqueta: "Access Token"
     - Valor: `•••••••• (generado automáticamente)`
     - Nota debajo: "Se renueva automáticamente cada 24 horas"
     - Estilo: texto en gris/muted para indicar que es automático

**Nota de Seguridad:**
- [ ] Mensaje existente "Por seguridad, las credenciales no se muestran" permanece visible
- [ ] Badge o tooltip adicional:
  - "OAuth2 Activo" (badge verde)
  - Tooltip: "Las credenciales OAuth2 permiten renovación automática de tokens"

**Otros Campos:**
- [ ] Store URL sigue siendo clickeable (sin cambios)
- [ ] API Version se muestra correctamente (sin cambios)
- [ ] Estado de sincronización automática se muestra (sin cambios)

**Retrocompatibilidad:**
- [ ] Si un tenant antiguo solo tiene `access_token` (legacy, sin OAuth):
  - Muestra solo "Access Token: ••••••••••••••••"
  - Badge amarillo: "Legacy Token"
  - Advertencia: "Considera migrar a OAuth2 para renovación automática"

#### Archivos a Modificar

- `apps/frontend/app/superadmin/tenants/[id]/page.tsx` (líneas ~150-220)

---

### US-FE-005: Documentación de Migración para Usuarios

**Como** SuperAdmin
**Quiero** entender cómo obtener las credenciales OAuth2 de Shopify
**Para** poder configurar correctamente la integración

#### Descripción

Agregar tooltips, placeholders informativos y un enlace a documentación que explique cómo obtener `client_id` y `client_secret` desde el panel de Shopify Partners/Apps.

#### Criterios de Aceptación

**Tooltips Informativos:**
- [ ] Tooltip en "Client ID" con:
  - Icono de información (ⓘ)
  - Texto: "Obtén el Client ID desde el panel de tu app de Shopify en Partners Dashboard"
  - Enlace: "Ver guía →" (abre nueva pestaña)
- [ ] Tooltip en "Client Secret" con mensaje similar

**Enlaces a Documentación:**
- [ ] Enlace en descripción de campos:
  - Texto: "¿Cómo obtener estas credenciales?"
  - URL: Documentación interna o de Shopify
  - Abre en nueva pestaña
  - Estilo: link azul con icono externo

**Ejemplos Visuales:**
- [ ] Placeholders muestran formato real:
  - Client ID: "shpca_abc123..."
  - Client Secret: "shpcs_secret456..."

**Ayuda Contextual:**
- [ ] Mensaje en diálogo de creación/edición:
  - "💡 Tip: Necesitas crear una Custom App en Shopify Partners para obtener estas credenciales"
  - Solo visible cuando plataforma es Shopify

#### Archivos a Crear/Modificar

- `apps/frontend/components/superadmin/create-tenant-dialog.tsx` (agregar tooltips)
- `apps/frontend/components/superadmin/edit-tenant-dialog.tsx` (agregar tooltips)
- Opcional: `apps/frontend/components/ui/info-tooltip.tsx` (componente reutilizable)

---

## Verificación y Testing

### Casos de Prueba Manual

#### Test 1: Crear Nuevo Tenant con Shopify OAuth2
1. Login como SuperAdmin
2. Ir a Tenants → "Crear Tenant"
3. Completar datos básicos (nombre, RUC, etc.)
4. Seleccionar plataforma: "Shopify"
5. Ingresar:
   - Store URL: `https://test-store.myshopify.com`
   - Client ID: `shpca_test123`
   - Client Secret: `shpcs_secret456`
   - API Version: `2025-10`
6. Marcar "Sincronizar automáticamente al validar"
7. Guardar

**Resultado esperado:**
- ✅ Tenant se crea exitosamente
- ✅ Backend genera access token automáticamente
- ✅ En página de detalles, credenciales aparecen ocultas (••••)
- ✅ Badge "OAuth2 Activo" visible

---

#### Test 2: Editar Tenant Existente (Solo Cambiar Store URL)
1. Login como SuperAdmin
2. Ir a tenant existente con Shopify configurado
3. Click "Editar"
4. Cambiar solo Store URL
5. **NO ingresar** Client ID ni Client Secret
6. Guardar

**Resultado esperado:**
- ✅ Cambios guardados correctamente
- ✅ Credenciales OAuth2 NO se sobrescriben (se mantienen las anteriores)
- ✅ No aparece error de validación

---

#### Test 3: Cambiar de WooCommerce a Shopify
1. Login como SuperAdmin
2. Ir a tenant con WooCommerce configurado
3. Click "Editar"
4. Cambiar plataforma a "Shopify"
5. **Debe requerir** Client ID y Client Secret
6. Ingresar credenciales OAuth2
7. Guardar

**Resultado esperado:**
- ✅ Muestra alerta de confirmación (cambio destructivo)
- ✅ Campos de WooCommerce desaparecen
- ✅ Campos de Shopify OAuth2 aparecen
- ✅ Validación requiere ambos campos OAuth2
- ✅ Al guardar, configuración de WooCommerce se borra

---

#### Test 4: Visualización de Tenant con OAuth2 vs Legacy
1. Login como SuperAdmin
2. Navegar a tenant con OAuth2 configurado
3. Verificar sección "Configuración de E-commerce"
4. Comparar con tenant legacy (si existe)

**Resultado esperado:**
- ✅ Tenant OAuth2 muestra:
  - Client ID (oculto)
  - Client Secret (oculto)
  - Access Token (generado automáticamente)
  - Badge verde "OAuth2 Activo"
- ✅ Tenant legacy muestra:
  - Access Token (oculto)
  - Badge amarillo "Legacy Token"
  - Advertencia de migración

---

### Tests Automatizados (Opcional)

```typescript
// tests/components/create-tenant-dialog.test.tsx

describe('CreateTenantDialog - Shopify OAuth2', () => {
  it('should show OAuth2 fields when Shopify is selected', () => {
    // ...
    expect(screen.getByLabelText('Client ID de Shopify')).toBeInTheDocument()
    expect(screen.getByLabelText('Client Secret de Shopify')).toBeInTheDocument()
    expect(screen.queryByLabelText('Access Token')).not.toBeInTheDocument()
  })

  it('should validate required OAuth2 fields for Shopify', async () => {
    // ...
    fireEvent.submit(form)
    expect(await screen.findByText(/Client ID es requerido/i)).toBeInTheDocument()
  })

  it('should send correct payload with OAuth2 credentials', async () => {
    // ...
    expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('shopify_client_id')
    }))
  })
})
```

---

## Migración de Tenants Existentes

### Escenario: Tenants con Access Token Legacy

**Problema:**
Tenants creados antes de esta migración tienen solo `shopify_access_token` en lugar de `client_id` + `client_secret`.

**Solución en Frontend:**

1. **Detección automática** en `EditTenantDialog`:
   ```typescript
   const hasOAuth2 = !!tenant.settings?.ecommerce?.shopify?.client_id
   const hasLegacyToken = !!tenant.settings?.ecommerce?.shopify?.access_token && !hasOAuth2

   if (hasLegacyToken) {
     // Mostrar banner: "Este tenant usa autenticación legacy. Considera migrar a OAuth2"
   }
   ```

2. **Opción de migración** en formulario de edición:
   - Checkbox: "Migrar a OAuth2" (solo visible si tiene legacy token)
   - Al marcarlo, habilita campos de Client ID y Secret
   - Al guardar, backend invalida el token legacy y usa solo OAuth2

3. **Backend maneja ambos** (implementado):
   - Si tiene `client_id` + `client_secret`, usa OAuth2 (auto-renovación)
   - Si solo tiene `access_token`, lo usa hasta que expire (sin renovación)
   - Logs de advertencia si usa legacy token

---

## Checklist de Implementación

### Fase 1: Tipos y Definiciones
- [ ] US-FE-001: Actualizar `lib/types/tenant.ts`
- [ ] Verificar que no hay errores de TypeScript en proyecto
- [ ] Hacer commit: `feat: update tenant types for Shopify OAuth2`

### Fase 2: Formulario de Creación
- [ ] US-FE-002: Modificar `CreateTenantDialog`
- [ ] Probar manualmente creación de tenant con Shopify
- [ ] Verificar payload enviado al backend
- [ ] Hacer commit: `feat: add OAuth2 fields to create tenant dialog`

### Fase 3: Formulario de Edición
- [ ] US-FE-003: Modificar `EditTenantDialog`
- [ ] Actualizar lógica de detección de plataforma
- [ ] Probar cambio de plataforma WooCommerce ↔ Shopify
- [ ] Probar edición parcial (sin cambiar credenciales)
- [ ] Hacer commit: `feat: add OAuth2 fields to edit tenant dialog`

### Fase 4: Página de Detalles
- [ ] US-FE-004: Actualizar página de detalles
- [ ] Agregar badge "OAuth2 Activo"
- [ ] Mostrar nota de auto-renovación
- [ ] Hacer commit: `feat: update tenant details page for OAuth2`

### Fase 5: Documentación y UX
- [ ] US-FE-005: Agregar tooltips y ayuda contextual
- [ ] Crear/actualizar documentación de usuario
- [ ] Hacer commit: `docs: add OAuth2 setup guide for Shopify`

### Fase 6: Testing y Refinamiento
- [ ] Ejecutar todos los casos de prueba manual
- [ ] Probar migración de tenant legacy
- [ ] Verificar que WooCommerce no se afectó
- [ ] Code review y ajustes finales
- [ ] Hacer commit: `test: verify OAuth2 migration for all scenarios`

---

## Rollback Plan

Si es necesario revertir los cambios:

1. **Backend soporta ambos modos:**
   - OAuth2 (preferido)
   - Legacy `access_token` (fallback)

2. **Frontend puede volver fácilmente:**
   ```bash
   git revert <commit-hash-fase-2>
   git revert <commit-hash-fase-3>
   git revert <commit-hash-fase-1>
   ```

3. **Sin pérdida de datos:**
   - Tenants con OAuth2 seguirán funcionando con backend
   - Solo se pierde capacidad de crear/editar OAuth2 desde frontend
   - Access tokens legacy siguen válidos hasta expiración

---

## Notas Importantes

1. **Backend ya está listo:**
   - ✅ Soporta OAuth2 completamente
   - ✅ Genera tokens automáticamente
   - ✅ Encripta credenciales
   - ✅ Maneja expiración y renovación

2. **Frontend es solo UI:**
   - Cambios son únicamente formularios y tipos
   - No afecta lógica de negocio
   - No requiere cambios en API calls (endpoints iguales)

3. **Sin cambios breaking:**
   - URLs de API sin cambios
   - Response schemas sin cambios
   - Solo request payload cambia (campos diferentes)

4. **Compatibilidad con WooCommerce:**
   - No se afecta en absoluto
   - Sigue usando `consumer_key` y `consumer_secret`
   - Formularios siguen igual para WooCommerce
