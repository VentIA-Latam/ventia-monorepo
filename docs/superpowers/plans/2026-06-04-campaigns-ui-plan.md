# Plan: Campaigns UI (Spec C del Módulo 6)

**Branch a crear:** `feat/campaigns-ui` desde `feat/campaigns-engine` (que tiene el backend)
**Spec:** `docs/superpowers/specs/2026-06-04-campaigns-ui-design.md`
**Plan detallado:** se escribirá en `docs/superpowers/plans/2026-06-04-campaigns-ui-plan.md` durante el paso 0

## Context

El placeholder en `apps/frontend/app/dashboard/campaigns/page.tsx` ("Próximamente") es lo único que tiene el módulo de campañas en frontend hoy. El backend (Spec B) ya expone 12 endpoints proxy en `/api/v1/messaging/campaigns/*`. Falta sólo la capa visual.

Este plan implementa todo el frontend del Módulo 6 en `apps/frontend` (Next.js 16 + RSC + shadcn/ui + React Hook Form + Zod): lista de campañas con filtros por estado, wizard full-page de 6 pasos para creación, vista de detalle con stats y recipients, y acciones de retry/borrado. Diseño visual basado en los tokens del proyecto (volt/marino/aqua/cielo + semantic) y patrones extraídos del impeccable audit (3 ratios prominentes + pipeline visual en vez del "hero-metric template" cliché).

## Decisiones clave (ya validadas)

- **Wizard full-page** en rutas propias (`/campaigns/new`, `/campaigns/[id]/edit?step=N`) en vez de modal — permite refresh sin perder paso, deep-link, espacio para CSV preview y tabla de variables.
- **Navegación lineal con pasos previos clickeables** — el usuario puede volver a corregir pasos anteriores sin perder el progreso de los avanzados.
- **State persistido en backend** vía `:draft` status — cada paso es un PATCH. Refresh / multi-device preservan.
- **Lista = card-per-row con tabs por estado** (Todas / Borrador / Programadas / Enviadas).
- **Detalle = 3 ratios + pipeline stacked + recipients table** — no el "6 stat cards" cliché.
- **Variables paso 4**: dropdown estructurado de columnas CSV o atributos del Contact (no Liquid free-text).
- **Custom attributes**: input free-text para keys que no son built-in (v1 no fetcheamos qué keys existen).
- **Edge case datos faltantes**: omitir del envío, mostrar en "Omitidos" del preview.
- **Sistema visual**: tokens del proyecto (volt/marino/aqua/cielo + semantic). Sin paleta Tailwind genérica.
- **State management**: fetch directo + useState/useEffect (sin TanStack Query). Patrón existente del proyecto.
- **Forms**: React Hook Form + Zod (ya instalados).
- **Toast**: custom hook `useToast()` ya existente (NO sonner).
- **File upload**: agregar dependencia `react-dropzone`.

## Patrones reutilizados (verificados con Explore)

| Pieza | Origen | Uso |
|---|---|---|
| `getAccessToken()` en RSC | `apps/frontend/lib/auth0.ts` | Pasar token a services en server components |
| `fetchWithAuth<T>()` helper | `apps/frontend/lib/services/messaging-service.ts` (privado) | Lo replico/extraigo a un helper genérico para campaigns-service.ts |
| Response wrapper `{ success, data, meta }` | mismo archivo | Shape esperado en cada fetch |
| Patrón RSC + `*-client.tsx` | `app/dashboard/conversations/page.tsx` + `conversations-client.tsx` | Replicar exactamente para `campaigns/page.tsx` y `[id]/page.tsx` |
| Forms con Zod + zodResolver | `components/landing/reclamaciones-form.tsx` | Misma estructura por step |
| TanStack Table con paginación + filtros | `components/dashboard/payments/payments-table.tsx` | Reutilizar para `RecipientsTable` |
| `useToast` con variant | `hooks/use-toast.ts` (uso en `channels-client.tsx:75`) | Para feedback de mutations (trigger, retry, delete) |
| `useRouter` + `router.replace/push` | `app/dashboard/channels/channels-client.tsx:87` | Navegación post-mutation |
| shadcn `Dialog`, `AlertDialog`, `Sheet`, `Tabs`, `Table`, `Select`, `DropdownMenu`, `Popover`, `Calendar` | `components/ui/` | Componentes base del wizard y detail |
| Plus Jakarta Sans | `app/layout.tsx:10-14` | Font ya configurada como `var(--font-sans)` |

**Cosas que NO existen y hay que crear:**
- Helper multipart (extender o agregar a `fetchWithAuth`). Patrón: `FormData` + fetch sin `Content-Type` explícito.
- Componente `WizardStepper` (no hay stepper en el codebase).
- `RecipientsTable` específica (usa TanStack Table como base).
- `CampaignPipelineBar` (stacked bar custom).

## Implementación en 13 pasos

### Paso 0 — Branch + dependencias + plan detallado

- Crear branch `feat/campaigns-ui` desde `feat/campaigns-engine`.
- `cd apps/frontend && pnpm add react-dropzone` (~10kb gzipped, accesible).
- Escribir `docs/superpowers/plans/2026-06-04-campaigns-ui-plan.md` con la versión detallada de este plan.

### Paso 1 — Types

**Nuevo:** `apps/frontend/lib/types/campaign.ts`

Tipos TS mirror de los Pydantic schemas del backend: `Campaign`, `CampaignStatus`, `RecipientStatus`, `AudienceType`, `CampaignVariableMapping`, `CampaignTemplateParams`, `CampaignStats`, `CampaignRecipient`, `CampaignCsvUploadResult`, `CampaignPreview`, `CampaignPreviewSample`. Estructura exacta documentada en sección "Servicios y types" del spec.

### Paso 2 — Service

**Nuevo:** `apps/frontend/lib/services/campaigns-service.ts`

12 funciones espejo de los endpoints proxy: `fetchCampaigns`, `fetchCampaign`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `uploadCampaignCsv`, `setLabelsAudience`, `previewCampaign`, `triggerCampaign`, `retryFailedCampaign`, `fetchCampaignRecipients`, `deleteCampaignRecipient`.

Cada una toma `accessToken` como primer arg. Reusa el patrón `fetchWithAuth<T>()` de `messaging-service.ts`. Para multipart CSV: helper nuevo que arma `FormData` y fetch sin `Content-Type` (browser pone boundary). Tests unitarios mockean `global.fetch` y verifican URL + headers + body.

### Paso 3 — Componentes compartidos del módulo

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/campaign-status-pill.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/recipient-status-pill.tsx`

Pills con dot prefix + texto sobre fondo `color-mix(in oklch, var(--TOKEN) 12%, transparent)`. Mapea `campaign_status` y `recipient_status` a tokens según tabla del spec. Storybook-style snapshot test mínimo.

### Paso 4 — Lista `/campaigns`

**Reemplazar:** `apps/frontend/app/dashboard/campaigns/page.tsx` (era placeholder)
**Nuevo:** `apps/frontend/app/dashboard/campaigns/campaigns-list-client.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/campaign-card.tsx`

`page.tsx` (RSC): `getAccessToken()` + `fetchCampaigns(token)` → pasa a `CampaignsListClient`. Si error → empty state. Si 0 campañas → empty state grande con CTA "Crear primera campaña".

`CampaignsListClient`: tabs (shadcn `Tabs`) con filtros in-memory por `campaign_status`. Render `CampaignCard` por campaña con progress bar inline (solo si `recipients_count > 0`). Click en card → `router.push(/campaigns/{id})` si `:active/:running/:completed/:paused/:failed`, o `/campaigns/{id}/edit?step=1` si `:draft`.

### Paso 5 — "Nueva campaña" flow

**Nuevo:** `apps/frontend/app/dashboard/campaigns/new/page.tsx`

Server action que hace `POST /campaigns` con `{ title: "Nueva campaña sin nombre", campaign_status: :draft, inbox_id: <primer WhatsApp inbox del tenant> }` (placeholder editable en paso 1) y redirige a `/campaigns/{id}/edit?step=1`. Si el tenant no tiene inboxes WhatsApp → redirect a `/campaigns` con toast "Configura un inbox de WhatsApp primero".

### Paso 6 — Wizard infrastructure

**Nuevo:** `apps/frontend/app/dashboard/campaigns/[id]/edit/page.tsx` (RSC: carga campaign por id)
**Nuevo:** `apps/frontend/app/dashboard/campaigns/[id]/edit/wizard-client.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/wizard-stepper.tsx`

`page.tsx` (RSC): `fetchCampaign(token, id)` + `fetchInboxTemplates(token, campaign.inbox_id)` + `fetchLabels(token)` → pasa todo al `WizardClient`. Si `campaign_status !== :draft` → redirect a `/campaigns/{id}` (no se edita).

`WizardClient`: state machine. `currentStep` viene de `?step=N` (default 1). Cada step renderiza un componente específico (Paso 7-10). `WizardStepper` arriba muestra los 6 pasos con check verde para completados, círculo violeta para actual, gris para futuros. Click en step previo (≤ currentStep) → navega vía `router.replace(?step=X)`.

**Validación inter-paso:** cada step expone su propio Zod schema. Botón "Siguiente →" disabled si `!form.formState.isValid`. Al click: `PATCH /campaigns/:id` con cambios → si OK → `router.replace(?step=N+1)`. Si error 422 → toast con razón.

### Paso 7 — Step 1 (Datos básicos) + Step 2 (Template)

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step1-basics.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step2-template.tsx`

**Step 1:** form con `title` (`min(1).max(120)`) y `inbox_id` (select de WhatsApp inboxes pre-cargados). PATCH a "Siguiente".

**Step 2:** lista radio-style de templates aprobados del inbox seleccionado (vienen del RSC). Click selecciona; muestra body raw del template con placeholders sin resolver. Validación: `template_params.name` requerido. PATCH al template_params parcial `{name, language}`.

### Paso 8 — Step 3 (Audiencia)

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step3-audience.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/csv-dropzone.tsx`

Toggle entre CSV y Etiquetas (shadcn `Tabs` o `RadioGroup`).

**CSV path:** `CsvDropzone` usa `react-dropzone`. Drop → `uploadCampaignCsv(token, campaignId, file)` con loading state. Al éxito: muestra `recipients_count`, `columns` detectadas, `skipped_rows` (collapsible list). Re-upload reemplaza.

**Labels path:** multi-select de labels del tenant (popover con checkboxes). Al cambio: `setLabelsAudience(token, campaignId, ids)` → muestra `recipients_count`.

Validación al "Siguiente": `recipients_count > 0`. PATCH no necesario (los endpoints de audiencia ya mutan).

### Paso 9 — Step 4 (Variables)

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step4-variables.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/variable-row-csv.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/variable-row-attribute.tsx`

Render dinámico según template: una fila por placeholder `{{N}}` detectado.

**Si audiencia = CSV:** `VariableRowCsv` con dropdown de columnas (de `campaign.audience` info o response del paso anterior). Phone column ya asignada.

**Si audiencia = Etiquetas:** `VariableRowAttribute` con dropdown de built-ins (Nombre/Teléfono/Email/Identificador) + opción "Atributo personalizado…" que abre `Input` para escribir `custom_attributes.<key>`.

Si template tiene HEADER IMAGE: campo separado `header_media_url` con input URL.

PATCH al "Siguiente" con `template_params.variables` actualizado.

### Paso 10 — Step 5 (Preview) + Step 6 (Schedule)

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step5-preview.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/step6-schedule.tsx`

**Step 5:** `useEffect` al mount → `previewCampaign(token, id)`. Render 3 samples con `rendered_body` + header image. Si `omitted_samples.length > 0` → collapsible "Ver 12 omitidos" con razones. Si `samples.length === 0` (todos omitidos) → bloquear avance con CTA "Volver al paso 4".

**Step 6:** toggle `Enviar ahora` / `Programar`. Si Programar: shadcn `Calendar` + `TimePicker` (custom o combinación de Selects para hora/minuto). Confirmación inline con conteo + costo estimado. Click "Enviar campaña" → `triggerCampaign(token, id, scheduled_at?)` → toast → `router.push(/campaigns/{id})`.

### Paso 11 — Detalle `/campaigns/[id]`

**Nuevo:** `apps/frontend/app/dashboard/campaigns/[id]/page.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/[id]/campaign-detail-client.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/stats-ratios.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/campaign-pipeline-bar.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/recipients-table.tsx`

`page.tsx` (RSC): `fetchCampaign(token, id)` + `fetchCampaignRecipients(token, id, {page: 1})` en paralelo. Si `:draft` → redirect a `/campaigns/{id}/edit?step=1`.

`CampaignDetailClient`: header + `StatsRatios` (3 ratios calculados de campaign.stats) + `CampaignPipelineBar` (stacked con leyenda) + `RecipientsTable` (TanStack Table con search + status filter + paginación server-side).

**Variantes por estado** (renderizado condicional en client):
- `:active` scheduled futuro → banner + countdown live (useEffect con `setInterval`)
- `:running` → polling cada 3s vía `setInterval` que llama `fetchCampaign` y `fetchCampaignRecipients`. Cleanup en unmount.
- `:paused`, `:failed` → banners + acción contextual

### Paso 12 — Acciones contextuales (Retry / Pause / Resume / Delete)

**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/retry-failed-dialog.tsx`
**Nuevo:** `apps/frontend/app/dashboard/campaigns/_components/delete-campaign-dialog.tsx`

`AlertDialog` (shadcn) para confirmar acciones destructivas. Retry: muestra `failed_count` y "Vas a reintentar X destinatarios fallidos". Delete: doble confirmación si la campaña tiene >100 destinatarios. Al confirmar:
- Retry: `retryFailedCampaign` → toast → recargar detalle.
- Delete: `deleteCampaign` → toast → `router.push(/campaigns)`.

Pause/Resume del paso 11 son botones directos sin dialog (acciones no destructivas).

### Paso 13 — E2E tests

**Nuevo:** `apps/frontend/tests/e2e/campaigns/create-and-trigger-csv.spec.ts`
**Nuevo:** `apps/frontend/tests/e2e/campaigns/create-and-trigger-labels.spec.ts`
**Nuevo:** `apps/frontend/tests/e2e/campaigns/retry-failed.spec.ts`

Playwright. Cada spec corre contra el stack local (Spec B engine + UI). Pre-condiciones: tenant con WhatsApp inbox, template `jockey` aprobado, label `smoke-test` con 3 contactos.

- **csv:** login → "+Nueva" → llenar paso 1 → seleccionar jockey → CSV upload con 3 filas → variables → preview → "Enviar ahora" → assert estado `:running`/`:completed`.
- **labels:** login → similar pero paso 3 = label "smoke-test" → paso 4 con `contact.name` → preview → "Enviar".
- **retry-failed:** crear campaña → trigger → forzar fallo (mockear network) → en detalle hacer click "Reintentar fallos" → verificar `:running`.

## Verificación end-to-end

1. **Lint + typecheck:** `cd apps/frontend && pnpm lint && pnpm build` (catch type errors).
2. **E2E suite:** `pnpm test:e2e` (corre los 3 specs nuevos).
3. **Smoke manual local con docker:**
   - Levantar stack: `pnpm docker:up` (Spec B engine ya corriendo).
   - Login → `/campaigns` → click "+Nueva campaña".
   - Completar wizard CSV (con archivo `audience.csv` de 3 filas).
   - Verificar conversación recién creada aparece en `/conversations`.
   - Volver a `/campaigns/{id}` → ver stats y recipient marcado `:delivered` después de webhook de Meta.
   - Borrar campaña → verificar redirect a lista sin la campaña.
4. **Visual QA:** capturar screenshots de cada paso del wizard + detalle en estado `:completed`. Comparar contra mockups del visual companion (`/Users/renzolenes/Desktop/Proyectos/ventia-monorepo/.superpowers/brainstorm/67040-1780600299/content/campaign-detail-impeccable.html`). Validar tokens (volt en CTAs, marino en pills de `:read`, sin tints de cards genéricos).
5. **PR** con referencia al spec y al PR del engine (debe mergear primero).

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| Real-time updates via WebSocket / ActionCable | Polling cada 3s en `:running` es suficiente para v1 |
| Cloning / "duplicar campaña" | Iteración futura |
| Multi-step undo / cambiar inbox mid-wizard | Constraint: vars y template son inbox-dependientes — cancelar draft y crear nuevo |
| Edición en `:running` o `:completed` | State machine del backend lo bloquea |
| Vista de logs detallados por recipient | Tabla muestra `external_error`; logs completos en backend |
| Stats agregadas tipo dashboard | Vista de detalle per-campaña es suficiente para v1 |
| Notificaciones push cuando termina campaña | Out of scope |
| i18n | Dashboard hard-coded en español; mantener consistencia |
| Mobile responsive del wizard (móvil real) | Tabla de variables apretada en mobile — bloquear con mensaje "Usa pantalla más grande" si `<md` |
| Fetch dinámico de keys de `custom_attributes` disponibles | v1 usa free-text. Iteración posterior si hay fricción de UX |
| Lista dinámica de "atributos disponibles en la audiencia" en paso 4 | Mismo, v1 free-text |
