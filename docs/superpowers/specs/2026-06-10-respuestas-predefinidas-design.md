# Respuestas Predefinidas (Canned Responses) — Design

**Status:** Draft
**Date:** 2026-06-10
**Owner:** Piero
**Related:** Inspirado en la implementación de Chatwoot (canned responses). Convive con —pero no toca— las plantillas de Meta/WhatsApp.

## Resumen

Respuestas predefinidas: fragmentos de texto reutilizables que un agente inserta rápidamente en una conversación para responder con consistencia a preguntas comunes. Cada respuesta tiene un `short_code` (atajo) y un `content` (texto).

La entrega completa cubre:
1. **Insertar** en el chat con dos gestos: trigger `/` (estilo Chatwoot) y un botón en el composer.
2. **Gestionar (CRUD completo)** desde un dialog dentro de Conversaciones, accesible solo para `admin`/`superadmin`.

La capa de datos **ya existe** end-to-end (heredada del diseño tipo Chatwoot); este spec completa las capas que hoy solo exponen `GET` y construye la UI que falta.

## Contexto: qué ya existe vs. qué falta

**Ya existe:**
- **Rails (messaging):** modelo `CannedResponse` (`account_id`, `short_code`, `content`), `CannedResponsesController` con CRUD completo, ruta `resources :canned_responses`, y un `scope :search` que prioriza match por prefijo de `short_code`.
- **FastAPI:** proxy `GET /messaging/canned-responses` (solo listado), con schema y service.
- **Next.js:** route handler `GET` en `app/api/messaging/canned-responses/route.ts`, `getCannedResponses()` en el api-client, y el tipo `CannedResponse`.

**Falta (alcance de este spec):**
- FastAPI: `POST` / `PATCH` / `DELETE` proxy hacia Rails.
- Next.js: route handlers de escritura (`POST` y `[id]` con `PATCH`/`DELETE`) + funciones `create`/`update`/`delete` en el api-client.
- Rails: autorización de escritura (hoy el controller no restringe por rol).
- Frontend: el selector de inserción en el composer y el dialog de gestión.

## Decisión de secuencia: relación con la reestructuración a jerarquía

Existe un cambio de modelo de negocio en camino: pasar de `organización → canal` a una jerarquía de tres niveles **`organización → marca → sucursal/canal`**, con visibilidad por nivel (admin general ve todo, admin de marca ve solo lo suyo, usuario de sucursal solo sus canales). Ese frente es su propio proyecto (spec aparte) y es prioritario por el onboarding de Grupo Yes.

Decisión: **implementar respuestas predefinidas ahora, a nivel `account` (= organización), de forma que el cambio a marca/sucursal sea aditivo y no una reescritura.** Una canned response atada a `account_id` hoy se convierte naturalmente en *"válida para toda la organización"* cuando lleguen las marcas; agregar `brand_id`/`inbox_id` (nullable) después es una migración aditiva.

No se construye nada de marca/sucursal ahora (no existe la tabla). Las dos costuras que sí se cuidan desde ya están en la sección "Forward-compat".

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Alcance de la entrega | CRUD completo + inserción en el composer | Experiencia completa estilo Chatwoot |
| Gesto de inserción | Trigger `/` **y** botón en el composer | Fluidez para quien teclea + accesible con mouse |
| Variables/placeholders (`{{contact.name}}`) | **No** en esta entrega (texto plano) | YAGNI; es aditivo (el `content` sigue siendo texto, las variables son convención encima) |
| Scope de datos | `account_id` (= organización) | Forward-compat con jerarquía futura; migración aditiva a marca/sucursal |
| Quién gestiona (crear/editar/borrar) | Solo `administrator` + `superadmin` | Anticipa el futuro "admin de marca"; `agent` solo usa/inserta |
| Quién inserta | Cualquier agente que pueda responder | Es uso normal del chat |
| Ubicación de la gestión | Dialog dentro de Conversaciones | Vive donde se usa; sin ruta nueva; gating por rol limpio |
| Acceso a "Gestionar" | Enlace al pie del picker de inserción, visible solo a admin | No satura la barra del composer; contextual |
| Plantillas de Meta | No se tocan | Feature separada (templates aprobados de WhatsApp) |

## Arquitectura y flujo de datos

Se sigue el patrón existente del resto de recursos de messaging (Rails → proxy FastAPI → route handler Next → api-client → React). No se introduce arquitectura nueva; se completan las capas que hoy solo tienen `GET`.

```
Rails messaging (CRUD ya existe)
   ↑  HTTP
FastAPI proxy  /messaging/canned-responses[/{id}]   ← agregar POST/PATCH/DELETE
   ↑
Next route handlers  /api/messaging/canned-responses[/[id]]   ← agregar CRUD
   ↑
api-client (lib/api-client/messaging.ts)   ← agregar create/update/delete
   ↑
React: (a) picker de inserción en el composer  +  (b) dialog CRUD (solo admin)
```

## Backend (Rails)

Cambios mínimos sobre lo que ya existe:

- **Autorización de escritura:** un único `before_action` en `create`/`update`/`destroy` que exija rol `administrator` o `superadmin` del `AccountUser` actual; `index`/`show` quedan disponibles para cualquier agente. Centralizar la regla en un solo punto es la costura para enchufar mañana el "admin de marca". Devuelve `403` si un `agent` intenta escribir.
- **Modelo y rutas:** sin cambios. Se mantiene `account_id` como scope y la unicidad de `short_code` por `account_id`.

## Backend (FastAPI proxy)

Espejar el `GET` existente con `POST` / `PATCH` / `DELETE` hacia Rails:
- Reusar `require_permission_dual(method, "/messaging/*")` y `_resolve_tenant_id`.
- Agregar schemas de create/update en `app/schemas/messaging.py` (`CannedResponseCreate`, `CannedResponseUpdate`, response).
- Métodos correspondientes en `messaging_service.py`.
- Propagar `503` si el servicio Rails está caído (mismo patrón que el resto de endpoints messaging).

## Frontend (route handlers + api-client)

- Extender `app/api/messaging/canned-responses/route.ts` con `POST`.
- Crear `app/api/messaging/canned-responses/[id]/route.ts` con `PATCH` y `DELETE`.
- En `lib/api-client/messaging.ts`: agregar `createCannedResponse`, `updateCannedResponse`, `deleteCannedResponse` (junto al `getCannedResponses` existente).

## Frontend (UI)

### Picker de inserción — `canned-response-picker.tsx`

Sigue el patrón de `template-picker.tsx`. Montado junto a `message-composer.tsx`:

- **Trigger `/`:** cuando el `content` del textarea empieza con `/`, abre un dropdown encima del composer que filtra en vivo por `short_code` (vía `getCannedResponses` con `search`). Navegación con ↑/↓, Enter para insertar, Esc para cerrar. Al elegir, reemplaza el texto `/query` por el `content`.
- **Botón:** ícono en la barra del composer que abre el mismo picker (modo popover) para uso con mouse.
- **Pie del picker (solo admin):** enlace *"⚙ Gestionar respuestas"* que abre el dialog CRUD. Se condiciona con `isAdmin` de `useAuth()`.

### Dialog de gestión (CRUD) — `canned-responses-manager-dialog.tsx`

Solo accesible para admin (desde el pie del picker):

- **Lista:** scrolleable con buscador (`short_code` + `content`) y botón "Nueva respuesta".
- **Crear / Editar:** formulario con `short_code` y `content` (textarea). `short_code` requerido; unicidad la valida el backend y se muestra el error si choca.
- **Borrar:** con confirmación.
- **Estados internos:** lista ↔ formulario ↔ confirmación. Reutiliza `createCannedResponse` / `updateCannedResponse` / `deleteCannedResponse`.
- **Errores:** vía `useToast()` (convención del proyecto).

Nota: el CRUD vive encapsulado en este componente, así que "promoverlo" a una página dedicada en el futuro (si el catálogo crece mucho) no requiere reescribir la lógica.

## Forward-compat (costuras para la jerarquía futura)

- **Autorización en un solo lugar:** el `before_action` de escritura mapea hoy a `administrator`/`superadmin`; mañana ahí se enchufa "admin de marca".
- **Esquema aditivo:** `account_id` = organización. `brand_id`/`inbox_id` (nullable) quedan como migración aditiva futura; las respuestas existentes pasan a ser "org-wide" sin migración de datos.
- **UI encapsulada:** el CRUD vive en un componente; agregar un filtro/columna por marca luego es sumar, no rehacer.
- Sin lógica de marca/sucursal en esta entrega.

## Testing

- **Rails:**
  - Modelo: unicidad de `short_code` por `account`.
  - Controller: `agent` recibe `403` en `create`/`update`/`destroy`; `administrator`/`superadmin` sí pueden.
- **Backend (pytest):** nuevos endpoints proxy (`POST`/`PATCH`/`DELETE`) — happy path + propagación de error `503`.
- **Frontend (opcional):** e2e ligero del flujo `/` → insertar (siguiendo el patrón de `quoted-reply.spec.ts`).

## Fuera de alcance

- Plantillas de Meta/WhatsApp (no se tocan).
- Variables/placeholders (`{{contact.name}}`) — aditivo futuro.
- Scope por marca/sucursal — depende del proyecto de jerarquía.
- Automatización tipo encuesta (enviar mensaje + agregar etiqueta en un paso) — proyecto aparte, posterior a la jerarquía.
- Respuestas predefinidas personales por agente (Chatwoot tampoco las tiene; son a nivel cuenta).
