# Respuestas Predefinidas — Plan de Implementación

**Spec:** `docs/superpowers/specs/2026-06-10-respuestas-predefinidas-design.md`
**Date:** 2026-06-10

Orden pensado para que cada fase sea verificable de forma aislada, de abajo hacia arriba (Rails → FastAPI → Next → UI). Las fases 1–4 dejan el CRUD funcionando end-to-end por API antes de tocar UI.

---

## Fase 1 — Rails: autorización de escritura

**Objetivo:** que solo `administrator`/`superadmin` puedan crear/editar/borrar; `agent` recibe `403`.

**Archivos:**
- `apps/messaging/app/controllers/api/v1/canned_responses_controller.rb`

**Cambios:**
1. Agregar `before_action :authorize_management!, only: [:create, :update, :destroy]`.
2. Implementar el método privado:
   ```ruby
   def authorize_management!
     membership = @current_account.account_users.find_by(user: @current_user)
     return if membership && %w[administrator superadmin].include?(membership.role)

     render_error("No autorizado", status: :forbidden)
   end
   ```
   - `@current_account` y `@current_user` ya los provee `BaseController` (vía headers `X-Tenant-Id` / `X-User-Id`).
   - `AccountUser#role` es enum `agent`/`administrator`/`superadmin`.
3. Guard adicional: si `@current_user` es `nil` (sin `X-User-Id`), tratar como no autorizado → `403`.

**Verificación:**
- `cd apps/messaging && bundle exec rspec spec/requests/api/v1/canned_responses_spec.rb` (ver Fase 8 para los specs).
- Manual: `curl` con header de un agente → `403`; con admin → `201`.

---

## Fase 2 — FastAPI: schemas de escritura

**Archivos:**
- `apps/backend/app/schemas/messaging.py`

**Cambios:**
- Agregar junto a los schemas de canned responses existentes:
  - `CannedResponseCreate` (`short_code: str`, `content: str`).
  - `CannedResponseUpdate` (`short_code: str | None`, `content: str | None`).
  - `CannedResponseResponse` (single item) si aún no existe (hoy solo está `CannedResponsesListResponse`).
- Seguir el estilo del archivo (Pydantic, `Field(description=...)`).

**Verificación:** `cd apps/backend && uv run python -c "from app.schemas.messaging import CannedResponseCreate"` sin error.

---

## Fase 3 — FastAPI: service + endpoints proxy

**Archivos:**
- `apps/backend/app/services/messaging_service.py`
- `apps/backend/app/api/v1/endpoints/messaging.py`

**Cambios en `messaging_service.py`** (junto a `get_canned_responses`, ~línea 542):
```python
async def create_canned_response(self, tenant_id, user_id, payload) -> Optional[dict]:
    return await self._request("POST", "/api/v1/canned_responses", tenant_id,
                               json={"canned_response": payload}, user_id=user_id)

async def update_canned_response(self, tenant_id, user_id, cr_id, payload) -> Optional[dict]:
    return await self._request("PATCH", f"/api/v1/canned_responses/{cr_id}", tenant_id,
                               json={"canned_response": payload}, user_id=user_id)

async def delete_canned_response(self, tenant_id, user_id, cr_id) -> Optional[dict]:
    return await self._request("DELETE", f"/api/v1/canned_responses/{cr_id}", tenant_id,
                               user_id=user_id)
```
- **Clave forward-compat/seguridad:** pasar `user_id` para que Rails evalúe el rol (Fase 1). Tomarlo del `current_user` resuelto en el endpoint.
- Verificar la firma exacta de `_request` (acepta `json=` / `user_id=`) y ajustar nombres de kwargs.

**Cambios en `messaging.py`** (después del `GET /canned-responses`, ~línea 1456):
- `POST /canned-responses` → `require_permission_dual("POST", "/messaging/*")`, body `CannedResponseCreate`.
- `PATCH /canned-responses/{cr_id}` → `require_permission_dual("PATCH", "/messaging/*")`, body `CannedResponseUpdate`.
- `DELETE /canned-responses/{cr_id}` → `require_permission_dual("DELETE", "/messaging/*")`.
- En cada uno: `tenant_id = _resolve_tenant_id(current_user, tenant_id)`, llamar al service pasando el `user_id` del `current_user`, y `raise HTTPException(503, ...)` si el resultado es `None` (mismo patrón que el GET).

**Verificación:** `uv run pytest` (ver Fase 8) + revisar en `/docs` que aparezcan los 3 endpoints.

---

## Fase 4 — Next.js: route handlers + api-client

**Archivos:**
- `apps/frontend/app/api/messaging/canned-responses/route.ts` (existe; agregar `POST`)
- `apps/frontend/app/api/messaging/canned-responses/[id]/route.ts` (nuevo; `PATCH` + `DELETE`)
- `apps/frontend/lib/api-client/messaging.ts`
- `apps/frontend/lib/types/messaging.ts` (si hace falta payload types)

**Cambios:**
1. `route.ts`: agregar `export async function POST(request)` que reenvía a `${API_URL}/messaging/canned-responses` con el body, reusando el patrón del `GET` existente (auth con `getAccessToken`, manejo de error/401/503).
2. `[id]/route.ts`: `PATCH` y `DELETE` hacia `${API_URL}/messaging/canned-responses/${id}`.
3. api-client: agregar
   - `createCannedResponse(payload, tenantId?)` → `apiPost("/api/messaging/canned-responses", ...)`
   - `updateCannedResponse(id, payload, tenantId?)` → `apiPatch/apiPut(...)`
   - `deleteCannedResponse(id, tenantId?)` → `apiDelete(...)`
   - Usar los helpers existentes del archivo (verificar cuáles hay: `apiGet`, `apiPost`, etc.).

**Verificación:** `cd apps/frontend && pnpm lint` + prueba manual desde el navegador/devtools (crear una respuesta y verla en el `GET`).

---

## Fase 5 — Frontend: picker de inserción

**Archivos:**
- `apps/frontend/components/conversations/canned-response-picker.tsx` (nuevo)
- `apps/frontend/components/conversations/message-composer.tsx` (integración)

**Referencia de patrón:** `components/conversations/template-picker.tsx`.

**Cambios:**
1. **`canned-response-picker.tsx`:** componente que recibe `query` (texto tras `/`), llama `getCannedResponses({ search })` (debounced), renderiza lista filtrada, soporta navegación ↑/↓/Enter/Esc, y expone `onSelect(content)`. Al pie, si `isAdmin` (`useAuth()`), un enlace *"⚙ Gestionar respuestas"* que dispara `onManage()`.
2. **`message-composer.tsx`:**
   - Detectar trigger: cuando `content` empieza con `/` (o tras whitespace), extraer el `query` y mostrar el picker encima del textarea.
   - Al `onSelect`, reemplazar el segmento `/query` por el `content` elegido y cerrar el picker.
   - Agregar un botón (ícono) en la barra del composer que abre el mismo picker en modo popover.
   - Mantener el `textareaRef`/`handleKeyDown` existentes; interceptar las teclas de navegación solo cuando el picker está abierto.

**Verificación:** manual en `/dashboard/conversations` — teclear `/` filtra; Enter inserta; botón abre el picker.

---

## Fase 6 — Frontend: dialog de gestión (CRUD)

**Archivos:**
- `apps/frontend/components/conversations/canned-responses-manager-dialog.tsx` (nuevo)
- `apps/frontend/components/conversations/canned-response-picker.tsx` (cablear `onManage`)

**Cambios:**
- Dialog (shadcn `Dialog`) con estados internos: **lista** (buscador + botón "Nueva") ↔ **formulario** (crear/editar: `short_code` + `content`) ↔ **confirmación de borrado**.
- Usa `createCannedResponse` / `updateCannedResponse` / `deleteCannedResponse`; refresca la lista tras cada mutación.
- Errores (incl. `short_code` duplicado del backend) vía `useToast()`.
- Se abre desde el `onManage` del picker (solo admin).

**Verificación:** manual — como admin, abrir picker → Gestionar → crear/editar/borrar; como agente, el enlace no aparece.

---

## Fase 7 — Gating por rol (revisión transversal)

- Confirmar que el enlace "Gestionar" usa `isAdmin` de `useAuth()` (mismo criterio que *Tickets*/*Mi Plan* en `app-sidebar.tsx`).
- Defensa en profundidad: aunque la UI oculte la gestión, el backend (Fase 1 + 3) ya rechaza escrituras de `agent` con `403`. Verificar ambos.

---

## Fase 8 — Tests

**Archivos:**
- `apps/messaging/spec/.../canned_responses_spec.rb` (request spec)
- `apps/messaging/spec/models/canned_response_spec.rb` (si no existe)
- `apps/backend/tests/.../test_messaging_canned_responses.py`
- `apps/frontend/e2e/specs/canned-responses.spec.ts` (opcional, patrón `quoted-reply.spec.ts`)

**Cobertura:**
- Rails modelo: unicidad de `short_code` por `account`.
- Rails request: `agent` → `403` en create/update/destroy; admin/superadmin → ok; index/show abiertos a agente.
- Backend pytest: happy path de POST/PATCH/DELETE (mock del messaging_service) + propagación de `503`.
- Frontend e2e (opcional): `/` → seleccionar → texto insertado en el composer.

**Verificación final:**
- `cd apps/messaging && bundle exec rspec spec/.../canned_responses_spec.rb`
- `cd apps/backend && uv run pytest -k canned && uv run ruff check .`
- `cd apps/frontend && pnpm lint`

---

## Notas de forward-compat (no implementar ahora)

- La autorización vive en **un solo** `before_action` (Fase 1) → punto único para enchufar "admin de marca".
- Esquema sin `brand_id`/`inbox_id`: migración aditiva futura; respuestas actuales quedan "org-wide".
- El CRUD encapsulado en `canned-responses-manager-dialog.tsx` puede promoverse a página dedicada sin reescribir lógica.

## Riesgos / puntos a validar durante la implementación

- **Firma de `_request`** en `messaging_service.py`: confirmar nombres de kwargs (`json=`, `user_id=`) antes de codear la Fase 3.
- **Helpers del api-client**: confirmar qué verbos hay (`apiPost`/`apiPatch`/`apiDelete`) en `lib/api-client/messaging.ts`; si falta alguno, agregarlo siguiendo el patrón de `apiGet`.
- **Intercepción de teclado** en el composer: no romper el `Enter`=enviar cuando el picker está cerrado; solo capturar navegación con el picker abierto.
