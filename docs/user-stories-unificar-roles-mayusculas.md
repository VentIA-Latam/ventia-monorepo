# Historias de Usuario: Unificación de Roles a MAYÚSCULAS

## Contexto del Proyecto
Actualmente existe inconsistencia en la representación de roles de usuario entre backend (minúsculas con guion bajo) y frontend (mayúsculas con guion bajo). Se requiere unificar todo el sistema para usar valores en MAYÚSCULAS sin guion bajo (SUPERADMIN en lugar de SUPER_ADMIN o superadmin).

---

## Historia de Usuario 1: Actualizar Enum de Roles en Backend

**Como** desarrollador backend
**Quiero** que el enum `Role` use valores en MAYÚSCULAS sin guion bajo
**Para** que haya consistencia entre el nombre del enum y su valor, y sea compatible con el frontend

### Descripción
Actualizar la definición del enum `Role` en `app/core/permissions.py` para que tanto el nombre de la constante como su valor estén en MAYÚSCULAS. Específicamente, cambiar `SUPER_ADMIN = "superadmin"` a `SUPERADMIN = "SUPERADMIN"`.

### Criterios de Aceptación

1. ✅ El enum `Role` debe definirse como:
   ```python
   class Role(str, Enum):
       SUPERADMIN = "SUPERADMIN"
       ADMIN = "ADMIN"
       LOGISTICA = "LOGISTICA"
       VENTAS = "VENTAS"
       VIEWER = "VIEWER"
   ```

2. ✅ El diccionario `PERMISSIONS` debe actualizarse reemplazando todas las referencias `Role.SUPER_ADMIN` por `Role.SUPERADMIN`

3. ✅ No debe haber errores de importación o sintaxis en el archivo modificado

4. ✅ Los tests de permisos deben seguir pasando con los nuevos valores

---

## Historia de Usuario 2: Actualizar Migraciones de Base de Datos

**Como** desarrollador backend
**Quiero** que las migraciones de Alembic creen el enum PostgreSQL con valores en MAYÚSCULAS
**Para** que la base de datos almacene los roles en formato consistente con el código

### Descripción
Modificar las migraciones existentes de Alembic para que el tipo enum `role` en PostgreSQL se cree con valores en MAYÚSCULAS (`'SUPERADMIN'`, `'ADMIN'`, etc.) en lugar de minúsculas.

### Criterios de Aceptación

1. ✅ La migración inicial (`20251223_2335-b874806f087c_migration_message.py`) debe definir:
   ```python
   sa.Column('role', sa.Enum('ADMIN', 'LOGISTICA', 'VENTAS', 'VIEWER', name='role'), ...)
   ```

2. ✅ La migración de superadmin (`20251230_0435-add_superadmin_to_role.py`) debe ejecutar:
   ```python
   op.execute("ALTER TYPE role ADD VALUE 'SUPERADMIN' BEFORE 'ADMIN'")
   ```

3. ✅ Al ejecutar `alembic upgrade head` en una BD limpia, el enum debe crearse correctamente

4. ✅ La consulta `\dT+ role` en PostgreSQL debe mostrar valores en MAYÚSCULAS

---

## Historia de Usuario 3: Actualizar Script de Seed

**Como** desarrollador backend
**Quiero** que el script de seed use el enum `Role` directamente
**Para** evitar strings hardcoded y mantener type safety

### Descripción
Modificar `scripts/seed.py` para importar el enum `Role` y usarlo en lugar de strings literales al crear usuarios de prueba.

### Criterios de Aceptación

1. ✅ Debe importar: `from app.core.permissions import Role`

2. ✅ Los 5 usuarios de prueba deben usar el enum:
   - Línea 214: `role=Role.ADMIN`
   - Línea 225: `role=Role.LOGISTICA`
   - Línea 236: `role=Role.LOGISTICA`
   - Línea 247: `role=Role.ADMIN`
   - Línea 258: `role=Role.SUPERADMIN`

3. ✅ El script debe ejecutarse sin errores: `python scripts/seed.py`

4. ✅ Los usuarios insertados deben tener roles en MAYÚSCULAS en la BD

---

## Historia de Usuario 4: Actualizar Services con Nuevo Nombre de Enum

**Como** desarrollador backend
**Quiero** que todos los services usen `Role.SUPERADMIN` en lugar de `Role.SUPER_ADMIN`
**Para** que el código compile correctamente después del cambio de enum

### Descripción
Buscar y reemplazar todas las referencias a `Role.SUPER_ADMIN` por `Role.SUPERADMIN` en los archivos de servicios (user, invoice, api_key).

### Criterios de Aceptación

1. ✅ En `app/services/user.py`:
   - Líneas 73, 121, 167, 236, 247, 259, 303, 316: `Role.SUPER_ADMIN` → `Role.SUPERADMIN`

2. ✅ En `app/services/invoice.py`: Actualizar referencias si existen

3. ✅ En `app/services/api_key.py`: Actualizar referencias si existen

4. ✅ No hay errores de atributo al ejecutar el backend

5. ✅ La lógica de negocio sigue funcionando correctamente

---

## Historia de Usuario 5: Actualizar Schemas con Validaciones Correctas

**Como** desarrollador backend
**Quiero** que los schemas Pydantic validen correctamente con el nuevo enum
**Para** que las APIs rechacen roles inválidos y acepten los nuevos valores

### Descripción
Actualizar `app/schemas/user.py` y `app/schemas/api_key.py` para usar `Role.SUPERADMIN` en validadores y mensajes de error.

### Criterios de Aceptación

1. ✅ En `app/schemas/user.py`:
   - Líneas 40, 44, 45: `Role.SUPER_ADMIN` → `Role.SUPERADMIN`
   - Mensajes de error actualizados con roles correctos

2. ✅ En `app/schemas/api_key.py`: Actualizar validaciones si existen

3. ✅ El endpoint POST `/users` debe rechazar `"SUPER_ADMIN"` o `"superadmin"`

4. ✅ El endpoint POST `/users` debe aceptar `"SUPERADMIN"` correctamente

---

## Historia de Usuario 6: Actualizar Endpoints de API

**Como** desarrollador backend
**Quiero** que los endpoints usen el nuevo nombre del enum
**Para** que los comentarios y comparaciones sean correctos

### Descripción
Actualizar todos los endpoints en `app/api/v1/endpoints/` que referencian roles, especialmente los comentarios de documentación.

### Criterios de Aceptación

1. ✅ En `app/api/v1/endpoints/api_keys.py`:
   - Línea 38: Comentario actualizado a "SUPERADMIN and ADMIN"
   - Línea 61: `Role.SUPER_ADMIN` → `Role.SUPERADMIN`

2. ✅ En `app/api/v1/endpoints/invoices.py`: Actualizar si usa roles

3. ✅ En `app/api/v1/endpoints/orders.py`: Actualizar si usa roles

4. ✅ La documentación Swagger debe mostrar roles correctos

---

## Historia de Usuario 7: Actualizar Tests Backend

**Como** desarrollador backend
**Quiero** que los tests usen los nuevos valores de enum
**Para** que pasen correctamente después de los cambios

### Descripción
Actualizar `tests/api/test_deps.py` y otros tests que comparen roles.

### Criterios de Aceptación

1. ✅ Todos los tests que usan `Role.SUPER_ADMIN` deben actualizarse a `Role.SUPERADMIN`

2. ✅ Los tests deben pasar: `pytest tests/`

3. ✅ Los fixtures de tests deben crear usuarios con roles en MAYÚSCULAS

4. ✅ No hay warnings sobre enum deprecado

---

## Historia de Usuario 8: Crear Constantes de Roles en Frontend

**Como** desarrollador frontend
**Quiero** un archivo centralizado con constantes de roles y sus labels
**Para** evitar hardcodear roles y mantener consistencia en la UI

### Descripción
Crear nuevo archivo `apps/frontend/lib/constants/roles.ts` con un array de roles (value/label), tipo TypeScript, función helper, y versión sin SUPERADMIN.

### Criterios de Aceptación

1. ✅ El archivo debe exportar:
   ```typescript
   export const ROLES = [
     { value: 'SUPERADMIN', label: 'Super Admin' },
     { value: 'ADMIN', label: 'Admin' },
     { value: 'LOGISTICA', label: 'Logística' },
     { value: 'VENTAS', label: 'Ventas' },
     { value: 'VIEWER', label: 'Viewer' },
   ] as const;
   ```

2. ✅ Debe exportar el tipo: `export type UserRole = typeof ROLES[number]['value'];`

3. ✅ Debe incluir helper: `export function getRoleLabel(role: UserRole): string`

4. ✅ Debe exportar: `export const REGULAR_ROLES = ROLES.filter(r => r.value !== 'SUPERADMIN');`

5. ✅ El archivo debe compilar sin errores TypeScript

---

## Historia de Usuario 9: Actualizar Types de Usuario en Frontend

**Como** desarrollador frontend
**Quiero** que las interfaces de usuario usen el tipo `UserRole` importado
**Para** tener type safety y autocomplete de roles válidos

### Descripción
Modificar `apps/frontend/lib/types/user.ts` para importar y usar `UserRole` en lugar de union types hardcoded.

### Criterios de Aceptación

1. ✅ Debe importar: `import { UserRole } from '@/lib/constants/roles';`

2. ✅ Las interfaces deben usar `UserRole`:
   ```typescript
   export interface User {
     role: UserRole;  // en lugar de 'SUPER_ADMIN' | 'ADMIN' | ...
   }
   ```

3. ✅ Debe incluir los 5 roles: SUPERADMIN, ADMIN, LOGISTICA, VENTAS, VIEWER

4. ✅ No hay errores TypeScript en archivos que importan `User`

---

## Historia de Usuario 10: Actualizar Hook useCurrentUser

**Como** desarrollador frontend
**Quiero** que el hook de usuario actual use los nuevos tipos de roles
**Para** que el estado global del usuario sea consistente

### Descripción
Actualizar `apps/frontend/hooks/use-current-user.tsx` para usar `UserRole` y cambiar `'SUPER_ADMIN'` a `'SUPERADMIN'`.

### Criterios de Aceptación

1. ✅ Debe importar: `import { UserRole } from '@/lib/constants/roles';`

2. ✅ La interfaz `User` debe usar:
   ```typescript
   role: UserRole;  // línea 13
   ```

3. ✅ Incluye todos los 5 roles en el tipo

4. ✅ El hook sigue funcionando correctamente en componentes que lo usan

---

## Historia de Usuario 11: Actualizar Formulario de Creación de Usuario

**Como** administrador
**Quiero** ver todos los roles disponibles al crear un usuario
**Para** poder asignar cualquiera de los 5 roles existentes

### Descripción
Modificar `components/superadmin/create-user-dialog.tsx` para usar el array `REGULAR_ROLES` (sin SUPERADMIN) y mostrar labels amigables.

### Criterios de Aceptación

1. ✅ Debe importar: `import { REGULAR_ROLES } from '@/lib/constants/roles';`

2. ✅ El `SelectContent` debe iterarse dinámicamente:
   ```typescript
   <SelectContent>
     {REGULAR_ROLES.map((role) => (
       <SelectItem key={role.value} value={role.value}>
         {role.label}
       </SelectItem>
     ))}
   </SelectContent>
   ```

3. ✅ El dropdown muestra 4 opciones: Admin, Logística, Ventas, Viewer

4. ✅ Los labels son amigables ("Logística" en lugar de "LOGISTICA")

5. ✅ Al crear un usuario, el backend recibe el valor en MAYÚSCULAS

---

## Historia de Usuario 12: Actualizar Formulario de Edición de Usuario

**Como** administrador
**Quiero** ver todos los roles al editar un usuario (incluyendo SUPERADMIN)
**Para** poder ver y modificar usuarios con cualquier rol

### Descripción
Modificar `components/superadmin/edit-user-dialog.tsx` para usar el array completo `ROLES` y mostrar labels amigables.

### Criterios de Aceptación

1. ✅ Debe importar: `import { ROLES } from '@/lib/constants/roles';`

2. ✅ El `SelectContent` debe usar `ROLES` (no `REGULAR_ROLES`):
   ```typescript
   <SelectContent>
     {ROLES.map((role) => (
       <SelectItem key={role.value} value={role.value}>
         {role.label}
       </SelectItem>
     ))}
   </SelectContent>
   ```

3. ✅ El dropdown muestra 5 opciones incluyendo "Super Admin"

4. ✅ Un usuario con rol SUPERADMIN se muestra correctamente en el form

5. ✅ Los cambios de rol se guardan correctamente en el backend

---

## Historia de Usuario 13: Actualizar Componentes que Verifican Roles

**Como** desarrollador frontend
**Quiero** que todos los checks de roles usen las constantes importadas
**Para** evitar errores por typos y facilitar refactors futuros

### Descripción
Buscar y actualizar todos los componentes, pages y hooks que hacen comparaciones hardcoded de roles (`role === 'SUPER_ADMIN'`, etc.).

### Criterios de Aceptación

1. ✅ Archivos actualizados:
   - `app/superadmin/page.tsx`
   - `app/superadmin/users/[id]/page.tsx`
   - `app/superadmin/api-keys/page.tsx`
   - `components/superadmin/create-api-key-dialog.tsx`
   - `components/superadmin/superadmin-sidebar.tsx`

2. ✅ Todas las referencias `'SUPER_ADMIN'` cambiadas a `'SUPERADMIN'`

3. ✅ Idealmente, usar constantes importadas en lugar de strings:
   ```typescript
   import { UserRole } from '@/lib/constants/roles';
   if (user.role === 'SUPERADMIN') // o mejor: usar una constante
   ```

4. ✅ No hay errores de compilación TypeScript

5. ✅ La navegación y permisos funcionan correctamente

---

## Historia de Usuario 14: Actualizar API Routes del Frontend

**Como** desarrollador frontend
**Quiero** que las API routes usen los tipos correctos de roles
**Para** que las validaciones sean consistentes

### Descripción
Revisar y actualizar todas las API routes en `app/api/superadmin/` que puedan tener roles hardcoded.

### Criterios de Aceptación

1. ✅ Archivos verificados/actualizados:
   - `app/api/superadmin/users/route.ts`
   - `app/api/superadmin/users/[id]/route.ts`
   - `app/api/superadmin/tenants/*.ts`
   - `app/api/superadmin/stats/*.ts`
   - `app/api/superadmin/global-orders/route.ts`
   - `app/api/superadmin/api-keys/route.ts`

2. ✅ Todas las referencias `'SUPER_ADMIN'` actualizadas a `'SUPERADMIN'`

3. ✅ Las API routes compilan sin errores

4. ✅ Las llamadas desde componentes funcionan correctamente

---

## Historia de Usuario 15: Actualizar Services del Frontend

**Como** desarrollador frontend
**Quiero** que los servicios de API usen los tipos correctos
**Para** que los datos se envíen en el formato esperado por el backend

### Descripción
Revisar y actualizar los archivos de servicios en `lib/services/` que puedan tener roles hardcoded.

### Criterios de Aceptación

1. ✅ Archivos verificados/actualizados:
   - `lib/services/superadmin.ts`
   - `lib/services/user-service.ts`
   - `lib/services/stats.ts`

2. ✅ Usar el tipo `UserRole` importado donde sea apropiado

3. ✅ No hay strings hardcoded de roles

4. ✅ Los servicios funcionan correctamente end-to-end

---

## Historia de Usuario 16: Verificación E2E Backend

**Como** desarrollador
**Quiero** que el backend compile y pase todos los tests
**Para** asegurar que los cambios no rompieron funcionalidad existente

### Descripción
Ejecutar validaciones completas del backend después de todos los cambios.

### Criterios de Aceptación

1. ✅ Linter pasa sin errores: `uv run ruff check .`

2. ✅ Todos los tests pasan: `uv run pytest tests/`

3. ✅ El backend inicia correctamente sin errores de importación

4. ✅ Los endpoints responden con roles en MAYÚSCULAS

---

## Historia de Usuario 17: Verificación E2E Frontend

**Como** desarrollador
**Quiero** que el frontend compile sin errores TypeScript
**Para** asegurar type safety en toda la aplicación

### Descripción
Ejecutar validaciones completas del frontend después de todos los cambios.

### Criterios de Aceptación

1. ✅ TypeScript compila sin errores: `pnpm build`

2. ✅ ESLint pasa: `pnpm lint`

3. ✅ La aplicación inicia correctamente: `pnpm dev`

4. ✅ No hay errores en consola del navegador

---

## Historia de Usuario 18: Verificación Manual en UI

**Como** QA/Usuario
**Quiero** poder crear y editar usuarios con todos los roles disponibles
**Para** asegurar que la funcionalidad completa funciona end-to-end

### Descripción
Realizar pruebas manuales de la interfaz para verificar el flujo completo de gestión de usuarios.

### Criterios de Aceptación

1. ✅ Login como SUPERADMIN funciona correctamente

2. ✅ Al ir a Superadmin → Users, la tabla carga usuarios con sus roles

3. ✅ Al crear un nuevo usuario:
   - Dropdown muestra: Admin, Logística, Ventas, Viewer (4 opciones)
   - Labels son amigables (no todo mayúsculas)
   - Se puede crear usuario con cualquiera de los 4 roles
   - El usuario aparece en la lista con el rol correcto

4. ✅ Al editar un usuario existente:
   - Dropdown muestra: Super Admin, Admin, Logística, Ventas, Viewer (5 opciones)
   - El rol actual se pre-selecciona correctamente
   - Se puede cambiar el rol y guardar
   - Los cambios persisten en BD

5. ✅ Los permisos siguen funcionando (verificar acceso a endpoints según rol)

---

## Historia de Usuario 19: Reseteo y Seed de Base de Datos

**Como** desarrollador
**Quiero** resetear la BD y ejecutar seeds con los nuevos valores
**Para** tener datos de prueba consistentes con los cambios

### Descripción
Resetear la base de datos Docker, aplicar migraciones actualizadas y ejecutar seed script.

### Criterios de Aceptación

1. ✅ Ejecutar: `docker-compose -f docker-compose.dev.yml down -v`

2. ✅ Ejecutar: `docker-compose -f docker-compose.dev.yml up -d`

3. ✅ Aplicar migraciones: `docker exec ventia-backend uv run alembic upgrade head`

4. ✅ Verificar enum en BD:
   ```sql
   docker exec -it ventia-postgres psql -U ventia_user -d ventia_db
   \dT+ role
   ```
   Debe mostrar: SUPERADMIN, ADMIN, LOGISTICA, VENTAS, VIEWER

5. ✅ Ejecutar seed: `docker exec ventia-backend uv run python scripts/seed.py`

6. ✅ Verificar usuarios:
   ```sql
   SELECT email, role FROM users;
   ```
   Debe mostrar roles en MAYÚSCULAS

7. ✅ Los datos de prueba están disponibles para testing

---

## Orden de Implementación Recomendado

### Fase 1: Backend (Historias 1-7)
1. Historia 1: Actualizar Enum de Roles
2. Historia 2: Actualizar Migraciones
3. Historia 3: Actualizar Script de Seed
4. Historia 4: Actualizar Services
5. Historia 5: Actualizar Schemas
6. Historia 6: Actualizar Endpoints
7. Historia 7: Actualizar Tests Backend
8. Historia 16: Verificación E2E Backend

### Fase 2: Frontend (Historias 8-15)
9. Historia 8: Crear Constantes de Roles
10. Historia 9: Actualizar Types
11. Historia 10: Actualizar Hook useCurrentUser
12. Historia 11: Formulario Creación
13. Historia 12: Formulario Edición
14. Historia 13: Componentes con Roles
15. Historia 14: API Routes
16. Historia 15: Services
17. Historia 17: Verificación E2E Frontend

### Fase 3: Testing & Validación (Historias 16-19)
18. Historia 18: Verificación Manual UI
19. Historia 19: Reseteo BD y Seed

---

## Notas Importantes

### ⚠️ Breaking Changes
- Los usuarios existentes en BD con roles en minúsculas no funcionarán
- Es necesario resetear la BD en desarrollo
- En producción se requerirá una migración de datos

### ⚠️ JWT Tokens
- Tokens existentes con roles en minúscula no funcionarán
- Los usuarios deberán re-loguearse después del despliegue

### ✅ Beneficios
- Consistencia total entre backend y frontend
- Type safety mejorado en TypeScript
- Código más mantenible y fácil de refactorizar
- Labels amigables en la UI
- Todos los 5 roles disponibles en el frontend
