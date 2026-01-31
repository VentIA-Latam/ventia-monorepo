# User Stories: Auth0 Management API Integration

## Epic: Sincronización Automática de Usuarios con Auth0

**Objetivo**: Integrar Auth0 Management API para automatizar la creación, invitación y gestión de usuarios desde el panel de Superadmin, eliminando la necesidad de crear usuarios manualmente en Auth0.

**Valor de Negocio**:
- Reduce tiempo de onboarding de usuarios de ~5 minutos a ~30 segundos
- Elimina errores humanos en la creación manual de usuarios
- Centraliza la gestión de usuarios en una sola interfaz
- Garantiza consistencia entre base de datos local y Auth0

---

## US-001: Crear Usuario en Auth0 Automáticamente

**Como** Superadmin
**Quiero** que al crear un usuario desde el panel, se cree automáticamente en Auth0
**Para** no tener que acceder al dashboard de Auth0 manualmente

### Acceptance Criteria

- [ ] Al crear un usuario desde `/superadmin/users`, se debe llamar automáticamente a Auth0 Management API
- [ ] El usuario se crea con los siguientes parámetros:
  - `email`: Email del usuario
  - `name`: Nombre completo
  - `connection`: Conexión de base de datos configurada en `AUTH0_CONNECTION`
  - `email_verified`: `false`
  - `app_metadata.needsInvitation`: `true`
- [ ] Si la creación en Auth0 falla, NO se debe guardar el usuario en la base de datos local
- [ ] El `auth0_user_id` devuelto por Auth0 se debe guardar en la columna `auth0_user_id` de la tabla `users`
- [ ] Se debe mostrar un mensaje de error claro si falla la creación en Auth0

### Technical Notes

- Endpoint: `POST https://{AUTH0_DOMAIN}/api/v2/users`
- Requiere Management API token via Client Credentials Flow
- Token debe ser cacheado (TTL 24 horas, validar `expires_in`)
- Validar que `AUTH0_CONNECTION` no esté vacío (lanzar `ValueError` en `__init__`)

### Definition of Done

- [ ] Usuario creado en Auth0 con metadata correcta
- [ ] `auth0_user_id` guardado en base de datos
- [ ] Tests unitarios pasan
- [ ] Tests de integración pasan
- [ ] Logs informativos registrados

---

## US-002: Enviar Email de Invitación Automáticamente

**Como** Superadmin
**Quiero** que al crear un usuario se le envíe automáticamente un email de invitación
**Para** que pueda activar su cuenta sin intervención manual

### Acceptance Criteria

- [ ] Después de crear el usuario en Auth0, se debe llamar automáticamente al endpoint de change password
- [ ] El email enviado debe ser "Activate your account" (porque `needsInvitation=true`)
- [ ] El link de activación debe permitir al usuario establecer su contraseña
- [ ] Si el envío de invitación falla, el usuario SÍ se debe crear igualmente (warning log)
- [ ] Se debe mostrar un mensaje informativo al admin indicando que se envió la invitación

### Technical Notes

- Endpoint: `POST https://{AUTH0_DOMAIN}/dbconnections/change_password`
- Parámetros:
  - `client_id`: Auth0 Client ID
  - `email`: Email del usuario
  - `connection`: Base de datos de usuarios
- Comportamiento según metadata:
  - `needsInvitation=true`: "Activate your account"
  - `needsInvitation=false`: "Reset password"

### Definition of Done

- [ ] Email de invitación enviado tras creación
- [ ] Usuario recibe email "Activate your account"
- [ ] Link funciona correctamente para establecer contraseña
- [ ] Warning log si falla envío (pero usuario creado)
- [ ] Tests de integración pasan

---

## US-003: Bloquear Usuario en Auth0 al Desactivar

**Como** Superadmin
**Quiero** que al desactivar un usuario en el panel, se bloquee automáticamente en Auth0
**Para** garantizar que no pueda iniciar sesión aunque tenga credenciales válidas

### Acceptance Criteria

- [ ] Al desactivar un usuario (`is_active=false`), se debe llamar automáticamente a Auth0 Management API
- [ ] Se debe enviar PATCH con `{"blocked": true, "connection": "{AUTH0_CONNECTION}"}`
- [ ] Si el bloqueo en Auth0 falla, el usuario SÍ se desactiva localmente (warning log)
- [ ] El usuario bloqueado en Auth0 NO puede iniciar sesión
- [ ] Se debe mostrar un mensaje informativo al admin

### Technical Notes

- Endpoint: `PATCH https://{AUTH0_DOMAIN}/api/v2/users/{auth0_user_id}`
- Requiere Management API token
- Parámetro `connection` es REQUERIDO para especificar qué base de datos afectar
- Validación adicional: JWT validation también valida `is_active` localmente

### Definition of Done

- [ ] Usuario bloqueado en Auth0 (`blocked=true`)
- [ ] Usuario no puede iniciar sesión
- [ ] Usuario marcado como `is_active=false` en base de datos
- [ ] Warning log si falla sincronización con Auth0
- [ ] Tests de integración pasan

---

## US-004: Desbloquear Usuario en Auth0 al Reactivar

**Como** Superadmin
**Quiero** que al reactivar un usuario desactivado, se desbloquee automáticamente en Auth0
**Para** permitirle volver a iniciar sesión

### Acceptance Criteria

- [ ] Al reactivar un usuario (`is_active=true`), se debe llamar automáticamente a Auth0 Management API
- [ ] Se debe enviar PATCH con `{"blocked": false, "connection": "{AUTH0_CONNECTION}"}`
- [ ] Si el desbloqueo en Auth0 falla, el usuario SÍ se reactiva localmente (warning log)
- [ ] El usuario desbloqueado en Auth0 puede iniciar sesión normalmente
- [ ] Se debe mostrar un mensaje informativo al admin

### Technical Notes

- Endpoint: `PATCH https://{AUTH0_DOMAIN}/api/v2/users/{auth0_user_id}`
- Requiere Management API token
- Parámetro `connection` es REQUERIDO

### Definition of Done

- [ ] Usuario desbloqueado en Auth0 (`blocked=false`)
- [ ] Usuario puede iniciar sesión
- [ ] Usuario marcado como `is_active=true` en base de datos
- [ ] Warning log si falla sincronización con Auth0
- [ ] Tests de integración pasan

---

## US-005: Cache Automático de Management API Token

**Como** Sistema
**Quiero** cachear el token de Management API con renovación automática
**Para** minimizar llamadas de autenticación y mejorar performance

### Acceptance Criteria

- [ ] El token de Management API debe cachearse en memoria
- [ ] El token debe renovarse automáticamente 5 minutos antes de expirar
- [ ] Se debe validar el campo `expires_in` de la respuesta de Auth0 (no hardcodear TTL)
- [ ] Si el token está cacheado y válido, NO se debe solicitar uno nuevo
- [ ] Los logs deben indicar cuándo se obtiene un nuevo token

### Technical Notes

- Client Credentials Flow: `POST https://{AUTH0_DOMAIN}/oauth/token`
- TTL típico: 24 horas (pero siempre validar `expires_in`)
- Implementar en clase `Auth0ManagementClient` con propiedad `_token`
- Estructura: `Auth0Token(access_token: str, expires_at: datetime)`

### Definition of Done

- [ ] Token cacheado correctamente
- [ ] Renovación automática funciona
- [ ] Validación de `expires_in` implementada
- [ ] Logs informativos registrados
- [ ] Tests unitarios pasan

---

## US-006: Validación de Configuración de Auth0

**Como** Desarrollador
**Quiero** que el sistema valide la configuración de Auth0 al inicio
**Para** detectar errores de configuración antes de llegar a producción

### Acceptance Criteria

- [ ] Si `AUTH0_CONNECTION` está vacío o es `None`, lanzar `ValueError` en `__init__`
- [ ] El mensaje de error debe ser descriptivo: "AUTH0_CONNECTION must be set in environment variables"
- [ ] NO debe existir un valor por defecto para `AUTH0_CONNECTION` (prevenir errores silenciosos)
- [ ] La validación debe ocurrir al instanciar `Auth0ManagementClient`
- [ ] El error debe prevenir que la aplicación inicie con configuración incorrecta

### Technical Notes

- Variable requerida: `AUTH0_CONNECTION`
- Config en `apps/backend/app/core/config.py`:
  ```python
  AUTH0_CONNECTION: str = Field(
      ...,
      description="Auth0 database connection name (REQUIRED)"
  )
  ```
- Validación en `Auth0ManagementClient.__init__()`:
  ```python
  if not self.connection or not self.connection.strip():
      raise ValueError("AUTH0_CONNECTION must be set...")
  ```

### Definition of Done

- [ ] `ValueError` lanzado si `AUTH0_CONNECTION` vacío
- [ ] Mensaje de error claro y descriptivo
- [ ] Tests unitarios verifican validación
- [ ] Documentación actualizada

---

## US-007: Logs y Monitoreo de Operaciones Auth0

**Como** DevOps
**Quiero** que todas las operaciones con Auth0 se logueen correctamente
**Para** poder monitorear, debuggear y auditar la sincronización

### Acceptance Criteria

- [ ] Cada creación de usuario en Auth0 debe registrar: `logger.info(f"Created Auth0 user: {user_id} ({email})")`
- [ ] Cada envío de invitación debe registrar: `logger.info(f"Sent invitation email to {email}")`
- [ ] Cada bloqueo debe registrar: `logger.info(f"Blocked Auth0 user: {user_id}")`
- [ ] Cada desbloqueo debe registrar: `logger.info(f"Unblocked Auth0 user: {user_id}")`
- [ ] Errores de sincronización deben registrarse como warnings (no errores críticos)
- [ ] Los logs deben incluir suficiente contexto para debugging

### Technical Notes

- Niveles de log:
  - `INFO`: Operaciones exitosas
  - `WARNING`: Operación local exitosa pero fallo en Auth0
  - `ERROR`: Fallos críticos que previenen la operación
- Métricas a considerar:
  - Tasa de éxito de creación en Auth0
  - Tasa de envío de invitaciones
  - Tasa de sincronización de bloqueo
  - Tiempo de respuesta de Management API

### Definition of Done

- [ ] Logs informativos implementados
- [ ] Logs de warning para fallos no críticos
- [ ] Contexto suficiente en cada log
- [ ] Tests verifican que logs se generan correctamente

---

## Technical Requirements

### Environment Variables

```bash
# apps/backend/.env
AUTH0_MANAGEMENT_CLIENT_ID=your_management_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_management_client_secret
AUTH0_MANAGEMENT_AUDIENCE=https://your-tenant.auth0.com/api/v2/
AUTH0_CONNECTION=Username-Password-Authentication  # REQUIRED, no default
```

### Files to Create/Modify

**New Files:**
- `apps/backend/app/integrations/auth0_client.py`
- `apps/backend/tests/integrations/test_auth0_client.py`
- `apps/backend/tests/api/test_users_auth0.py`

**Modified Files:**
- `apps/backend/.env.example`
- `apps/backend/app/core/config.py`
- `apps/backend/app/services/user.py`
- `apps/backend/app/api/v1/endpoints/users.py`
- `apps/backend/app/schemas/user.py`
- `apps/backend/pyproject.toml` (add `httpx` dependency)

---

## Testing Strategy

### Unit Tests
- Token caching logic
- Connection validation
- Error handling for Auth0 API failures
- Payload construction for create/block/unblock

### Integration Tests
- End-to-end user creation flow
- Invitation email sending
- Block/unblock synchronization
- Rollback scenarios (Auth0 fails but DB succeeds)

### Manual Tests
1. Create user from Superadmin panel
2. Verify user exists in Auth0 Dashboard
3. Verify invitation email received
4. Deactivate user and verify blocked in Auth0
5. Reactivate user and verify unblocked in Auth0

---

## Security Considerations

1. **Client Secret**: Never expose in logs or frontend
2. **Token Caching**: Always validate `expires_in`, never hardcode TTL
3. **Connection Parameter**: CRITICAL - must be set, no default value
4. **Rate Limits**: Auth0 Management API has rate limits (consult docs)
5. **Audit Trail**: Log all Auth0 operations for compliance

---

## Rollback Strategy

### If Auth0 user creation fails:
- User NOT created in DB (transaction rollback)
- Clear error message to admin
- No inconsistency

### If invitation send fails:
- User IS created (warning log)
- Admin can resend manually from Auth0 Dashboard
- User can use "Forgot password"

### If block/unblock fails:
- User IS activated/deactivated locally
- Warning log for manual review
- Access denied by JWT validation (`is_active` check)

---

## Success Metrics

- **Onboarding Time**: Reduce from ~5 min to ~30 sec
- **Manual Errors**: Reduce to 0 (automated process)
- **Sync Success Rate**: Target 99.9% for critical operations
- **Admin Satisfaction**: Positive feedback on simplified workflow

---

## Appendix: API References

- [Auth0 Management API](https://auth0.com/docs/api/management/v2)
- [Client Credentials Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-credentials-flow)
- [Create User](https://auth0.com/docs/api/management/v2/users/post-users)
- [Update User](https://auth0.com/docs/api/management/v2/users/patch-users-by-id)
- [Change Password](https://auth0.com/docs/api/authentication/change-password)
