# Campaigns UI — Design (Spec C del Módulo 6)

**Status:** Draft
**Date:** 2026-06-04
**Owner:** Renzo Lenes
**Related:**
- ClickUp "Módulo 6: Campañas Masivas" (este spec cubre la capa UI completa)
- Depende de [`campaigns-engine`](2026-06-04-campaigns-engine-design.md) (backend ya mergeable en `feat/campaigns-engine`)
- Reutiliza primitivas de [`send-by-phone-endpoint`](2026-06-03-send-by-phone-endpoint-design.md) (Spec A)

## Resumen

Frontend completo del Módulo 6 en `apps/frontend` (Next.js 16, RSC + shadcn/ui + React Hook Form + Zod). Reemplaza el placeholder actual de `app/dashboard/campaigns/page.tsx`. Incluye lista de campañas, wizard full-page de 6 pasos para creación/edición, vista de detalle con stats + recipients table, y retry de fallos. Consume los 12 endpoints del proxy FastAPI ya definidos en Spec B.

## Motivación

Hoy `app/dashboard/campaigns/page.tsx` es un placeholder estático ("Próximamente"). El backend (Spec B) ya expone toda la funcionalidad. Falta solo el UI que permita:
1. Listar campañas con su estado actual.
2. Crear/editar campañas mediante un wizard que guíe al usuario (template + audiencia + variables + preview + schedule).
3. Ver detalle de campañas en curso o finalizadas (stats + recipients con filtros).
4. Reintentar fallos y borrar campañas.

## Decisiones de diseño (consensuadas)

| Decisión | Elección | Razón |
|---|---|---|
| Wizard location | Full-page con ruta propia (`/new`, `/[id]/edit`) | Permite refresh sin perder paso, deep-link desde otras vistas, espacio para CSV preview y tabla de variables |
| Step navigation | Lineal con pasos previos clickeables | El usuario puede volver a corregir pasos tempranos sin perder el progreso de los avanzados |
| State persistence | Backend (`:draft` status persistente) | Cada paso es un PATCH al backend. Refresh / cerrar / multi-device preservan el draft |
| List layout | Card-per-row con tabs por estado | Combina densidad (5-7 visibles) con badges + progress bar inline. Tabs filtran sin recargar |
| Detail layout | 3 ratios + pipeline visual + recipients table | Evita el "hero-metric template" de 6 stat cards. 3 ratios dan resumen ejecutivo; el pipeline visualiza distribución; tabla tiene los detalles |
| Variables binding (paso 4 con etiquetas) | Dropdown estructurado de atributos del Contact | No Liquid free-text. Auto-completion + validación al vuelo. Decidido en Spec B |
| Edge case datos faltantes | Omitir del envío, mostrar en "Omitidos" del preview | Decidido en Spec B |
| Sistema visual | Tokens del proyecto (volt/marino/aqua/cielo/luma + semantic) | No paleta Tailwind genérica. Patrón impeccable: status pills con dot prefix, tabular-nums en timestamps, sin borders coloridos por card |
| Data fetching | RSC para initial load + fetch + React state para refresh client-side | Patrón existente del proyecto (ver `app/dashboard/conversations/page.tsx`). No TanStack Query (no instalada) |
| Forms | React Hook Form + Zod | Ya instaladas en el proyecto |
| File upload (CSV) | `react-dropzone` para drag-and-drop accesible | Componente lightweight, ya patrón en React; alternativa a montar drag handlers manualmente |

## Arquitectura

### Rutas Next.js

```
app/dashboard/campaigns/
├── page.tsx                        # Lista (RSC)
├── campaigns-list-client.tsx       # Cards con tabs + acciones (client)
├── new/
│   └── page.tsx                    # Crea draft inmediato + redirige a /[id]/edit?step=1
├── [id]/
│   ├── page.tsx                    # Detalle (RSC con stats + recipients iniciales)
│   ├── campaign-detail-client.tsx  # Interactividad: filtros, retry, refresh
│   └── edit/
│       ├── page.tsx                # Wizard wrapper (RSC, carga campaign por id)
│       └── wizard-client.tsx       # Wizard state + steps (client)
└── _components/                    # Compartidos entre rutas
    ├── campaign-status-pill.tsx
    ├── campaign-card.tsx
    ├── campaign-pipeline-bar.tsx
    ├── stats-ratios.tsx
    ├── recipients-table.tsx
    ├── wizard-stepper.tsx
    ├── step1-basics.tsx
    ├── step2-template.tsx
    ├── step3-audience.tsx
    ├── step4-variables.tsx
    ├── step5-preview.tsx
    └── step6-schedule.tsx
```

### Data flow

```
USER click "Nueva campaña" → POST /campaigns (status :draft)
                          → redirect /campaigns/{id}/edit?step=1

WIZARD step N → PATCH /campaigns/{id} con campos del paso
            → next button habilitado si paso pasa Zod validation
            → URL refleja step actual (?step=N) para deep-link y refresh-safe

CSV UPLOAD step 3 → POST /campaigns/{id}/audience/csv (multipart)
LABELS step 3   → POST /campaigns/{id}/audience/labels
PREVIEW step 5  → GET  /campaigns/{id}/preview (3 samples + omitted)
TRIGGER step 6  → POST /campaigns/{id}/trigger { scheduled_at? }
              → redirect /campaigns/{id}

DETAIL view    → GET /campaigns/{id} (incluye stats)
            → GET /campaigns/{id}/recipients?page=1&status=X (paginado)
RETRY          → POST /campaigns/{id}/retry-failed → revalidatePath
DELETE         → DELETE /campaigns/{id} → router.push("/campaigns")
```

### Componentes principales

| Componente | Propósito | Ubicación |
|---|---|---|
| `CampaignsListClient` | Container interactivo: tabs por estado, render cards, refresh | `campaigns-list-client.tsx` |
| `CampaignCard` | Row visual: título + badges + counts + progress bar | `_components/campaign-card.tsx` |
| `CampaignStatusPill` | Pill reutilizable (draft/active/running/paused/completed/failed) con dot prefix | `_components/campaign-status-pill.tsx` |
| `WizardClient` | State machine de 6 pasos, persistencia URL (?step=N), validation per step | `[id]/edit/wizard-client.tsx` |
| `WizardStepper` | Barra superior con 6 pasos, clickeable hacia atrás | `_components/wizard-stepper.tsx` |
| `Step1Basics` ... `Step6Schedule` | Cada paso es un componente con su Zod schema y form | `_components/step{N}-*.tsx` |
| `CampaignPipelineBar` | Stacked bar de read/delivered/failed/omitted con leyenda | `_components/campaign-pipeline-bar.tsx` |
| `StatsRatios` | 3 ratios destacados (% delivered, % read, % failed+omitted) | `_components/stats-ratios.tsx` |
| `RecipientsTable` | Tabla paginada filtrable con search + status filter, link a conversación | `_components/recipients-table.tsx` |

## Sistema visual

### Tokens (ya existentes en `apps/frontend/app/globals.css`)

```css
/* Brand palette */
--volt:   oklch(0.58 0.19 260)  /* Primary (azul violeta) */
--marino: oklch(0.33 0.10 255)  /* Azul profundo — estados "comprometidos" como :read */
--aqua:   oklch(0.78 0.11 220)  /* Azul cielo claro — entregas */
--cielo:  oklch(0.93 0.04 230)  /* Background suave de info */
--luma:   oklch(0.78 0.08 255)  /* Lavanda neutro */
--noche:  oklch(0.20 0.03 250)  /* Foreground */

/* Semantic */
--success / --success-bg  /* :sent, :delivered, status verde */
--warning / --warning-bg  /* :omitted, scheduled */
--danger  / --danger-bg   /* :failed */
--info    / --info-bg     /* informativo neutro = aqua/cielo */
```

### Mapeo estado → color

| Estado de campaña | Pill bg | Pill fg | Acento |
|---|---|---|---|
| `:draft` | `muted` | `muted-foreground` | neutro, "Continuar →" CTA en `volt` |
| `:active` (programada) | `warning-bg` | `warning` | mostrar countdown "Se enviará en…" |
| `:running` | `cielo` | `marino` | mostrar progreso real-time |
| `:paused` | `muted` | `muted-foreground` | botón "Reanudar" en `volt` |
| `:completed` | `success-bg` | `success` | dot pulse no |
| `:failed` | `danger-bg` | `danger` | banner con razón |

| Estado de recipient | Pill bg | Pill fg |
|---|---|---|
| `pending / queued` | `muted` | `muted-foreground` |
| `sent` | `aqua` (tint) | `aqua` (oscuro) |
| `delivered` | `volt` mix 12% | `volt` |
| `read` | `marino` mix 12% | `marino` |
| `failed` | `danger-bg` | `danger` + row tint sutil |
| `omitted` | `warning-bg` | `warning` + row tint sutil |

### Patrones aplicados (del impeccable audit)

- **Sin borders coloridos por card** — todo `border-border`, diferenciación via badges
- **Status pills con dot prefix** + texto sobre fondo semi-transparente del mismo color (`color-mix` 12%)
- **Tabular-nums** en timestamps y phones para alineación vertical sin esfuerzo
- **Row attention tint** muy sutil para failed/omitted (mix de `danger-bg` o `warning-bg` ~60% con white)
- **3 ratios prominentes** en detalle (no 6 stat cards genéricas — anti-pattern "hero-metric template")
- **Pipeline visual stacked** con segmentos read/delivered/failed/omitted, leyenda debajo con conteos
- **Sin emoji decorativos**: usar `lucide-react` icons consistentes
- **Letter-spacing -0.01em** en headings, weight contrast ≥ 1.25 para hierarchy
- **No animaciones de entrada por defecto** — solo en hover/focus para interactividad

## Pantallas

### 1. Lista `/campaigns`

```
┌─────────────────────────────────────────────────────────────┐
│ Bell icon  Campañas (12)                  [+ Nueva campaña] │
│            Marketing masivo y notificaciones                 │
├─────────────────────────────────────────────────────────────┤
│ [Todas 12] [Borrador 3] [Programadas 2] [Enviadas 7]        │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Card row ─────────────────────────────────────────────┐ │
│ │ Recordatorio entregas Mayo   [✓ Enviada]               │ │
│ │ imagen_button · 📱 Ventas · 4 jun 8:30am               │ │
│ │ 156 destinatarios · 138 entregados · 95 leídos · 6 ✗  │ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 92% entrega                 │ │
│ └────────────────────────────────────────────────────────┘ │
│ ... más cards ...                                            │
└─────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- RSC fetches initial via `fetchCampaigns(token)` → `GET /campaigns` (incluye stats por campaña, sin N+1)
- Tabs en client filtran in-memory (no refetch)
- Click en card → `/campaigns/{id}` (detalle si no es draft) o `/campaigns/{id}/edit?step=1` (si draft)
- Empty state cuando no hay campañas: card grande con CTA "Crear primera campaña"
- Skeleton durante navigation transitions

### 2. Wizard `/campaigns/[id]/edit?step=N`

#### Header (constante en todos los pasos)

```
[Stepper: ① datos  ② template  ③ audiencia  ④ variables  ⑤ preview  ⑥ enviar]

[Título del paso actual]
[Subtítulo descriptivo]
```

#### Paso 1: Datos básicos

```
Nombre de la campaña *
[input]

Inbox de envío *
[select de WhatsApp inboxes del tenant]

                    [← Cancelar]     [Siguiente →]
```

Validación Zod: `title.min(1).max(120)`, `inbox_id.required()`.
PATCH al "Siguiente".

#### Paso 2: Template

```
Templates aprobados (N)
┌─────────────────────────────────┐
│ ◉ imagen_button · es · 2 vars   │
│   "Hola {{1}} te enviamos..."   │
├─────────────────────────────────┤
│ ○ jockey · es · sin vars        │
└─────────────────────────────────┘

[← Anterior]                [Siguiente →]
```

- Carga templates via `fetchInboxTemplates(token, inbox_id)` en RSC del paso.
- Click selecciona; muestra preview del body con placeholders sin resolver.
- Validación: `template_params.name.required()`.

#### Paso 3: Audiencia (toggle CSV / Etiquetas)

```
Origen de datos
[📁 CSV] [🏷️ Etiquetas]

(si CSV)
┌──────────────────────────────────────┐
│  Arrastra el CSV aquí                │
│  o haz click para seleccionar        │
│                                       │
│  Columnas detectadas: cliente, pedido │
│  156 filas válidas · 3 omitidas      │
└──────────────────────────────────────┘

(si Etiquetas)
[multi-select de labels existentes]
"234 contactos coinciden"
```

- CSV: dropzone (react-dropzone o Input nativo con onDrop). Al soltar → POST CSV multipart → muestra `recipients_count`, `columns`, `skipped_rows`. Re-upload reemplaza.
- Etiquetas: multi-select con labels del tenant (`fetchLabels`). POST al "Siguiente".

#### Paso 4: Variables

Renderiza dinámicamente según el template seleccionado (1 fila por `{{N}}`).

**Si audiencia = CSV:** dropdown por variable mostrando las columnas del CSV detectadas. Phone column ya seleccionada automática.

**Si audiencia = Etiquetas:** dropdown por variable mostrando atributos del Contact:
- Built-in: `Nombre`, `Teléfono`, `Email`, `Identificador`
- "Atributo personalizado…" abre input para escribir key custom (ej. `order_id`, `discount_code`). El backend resuelve via dig recursivo en `contact.custom_attributes.<key>`.

> Decisión: en v1 NO listamos dinámicamente qué keys de `custom_attributes` existen en la audiencia (requeriría endpoint nuevo + scan de todos los contactos). El usuario que sabe usar custom_attributes sabe sus keys. Si en feedback se ve fricción, agregamos `GET /campaigns/{id}/available-attributes` en una iteración posterior.

Mostrar warning live: "12 de 156 contactos no tienen 'order_id' — serán omitidos. Ver lista en el siguiente paso."

Si template tiene HEADER IMAGE: campo separado para URL de imagen (fija por campaña).

Validación: cada variable debe tener una fuente asignada.

#### Paso 5: Preview

```
Vista previa para 3 destinatarios sample
156 contactos en total · 12 omitidos

┌─ Sample 1 ─────────────────────┐
│ Juan Pérez · +51 904 890 457    │
│ "Hola Juan te enviamos tu      │
│  pedido número ORD-12345..."   │
│ [imagen del header]             │
└──────────────────────────────────┘
... +2 samples ...

▼ Ver 12 omitidos
  · +51 911 222 333 — Sin order_id
  · ... etc
```

- `GET /campaigns/{id}/preview` devuelve los 3 samples + omitted samples
- Sin acciones de "modificar" (vuelve al paso 4 para cambios)
- Validación implícita: si `omitted_count == recipients_count` → bloquear avanzar con mensaje "Todos los destinatarios serían omitidos. Revisá variables."

#### Paso 6: Schedule

```
¿Cuándo enviar?
[⚡ Ahora] [📅 Programar]

(si Programar)
Fecha y hora: [datetime picker con calendar + time]
              Mínimo: ahora + 1 min

┌─ Confirmación ────────────────────┐
│ ⚠ Vas a enviar imagen_button a    │
│   144 contactos                   │
│   (12 omitidos)                   │
│   Costo estimado: 144 mensajes    │
│   marketing                       │
└────────────────────────────────────┘

[← Anterior]       [✓ Enviar campaña]
```

- Al click final: POST `/campaigns/{id}/trigger` con `scheduled_at` opcional
- Redirect a `/campaigns/{id}` con toast "Campaña enviada" o "Campaña programada"

### 3. Detalle `/campaigns/[id]`

```
[crumb: Campañas / Recordatorio entregas Mayo]

┌─ Panel header ─────────────────────────────────────────────┐
│ Recordatorio entregas Mayo                                  │
│ ● Enviada · 📱 Ventas · 📄 imagen_button · 🏷️ etiqueta     │
│ · 4 jun 8:30am                                              │
│                            [Reintentar 6 fallos] [Borrar]   │
├─────────────────────────────────────────────────────────────┤
│ ENTREGADOS    LEÍDOS              FALLARON + OMITIDOS       │
│ 95.8%         68.8%                11.5%                    │
│ 138 de 144    95 de 138            18 de 156                │
├─────────────────────────────────────────────────────────────┤
│ Pipeline                          156 destinatarios totales │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░                              │
│ ■ Leídos 95  ■ Entregados 43  ■ Fallaron 6  ■ Omitidos 12  │
└─────────────────────────────────────────────────────────────┘

┌─ Destinatarios (156) ─── [🔍 Buscar...] [Todos los estados ▼] ┐
│ CONTACTO          ESTADO       ENVIADO   ENTREGADO   LEÍDO    │
│ Juan Pérez        ● Leído      08:30:05  08:30:12   08:34:21  │
│ +51 904 890 457                                                │
│ ───────────────────────────────────────────────────────────── │
│ María López       ● Entregado  08:30:08  08:30:15   —         │
│ ───────────────────────────────────────────────────────────── │
│ Carlos Vega       ● Falló      08:30:11  —          —         │
│ +51 987 654 321                            131062 rate limit  │
│ ───────────────────────────────────────────────────────────── │
│ Ana García        ● Omitida    —         —          —         │
│ +51 911 222 333                            Sin order_id        │
└────────────────────────────────────────────────────────────────┘
Mostrando 1-25 de 156   [← Anterior]  Página 1 de 7  [Siguiente →]
```

**Comportamiento:**
- RSC fetches `GET /campaigns/{id}` + `GET /campaigns/{id}/recipients?page=1` en paralelo
- Tabla en client: cambiar filtro / search refetcha sin reload (router-aware)
- Click en "Ver conv." (última columna, no mostrada arriba) → `/conversations?id=<conversation_id>`
- "Reintentar fallos": confirmación dialog → POST retry-failed → revalidate
- "Borrar": confirmación destructive dialog → DELETE → redirect

### Variantes de detalle por estado

- `:draft` — no muestra ratios/pipeline/tabla. Card grande con "Configuración pendiente" y CTA "Continuar configurando →" hacia el wizard
- `:active` (scheduled) — banner amarillo "Se enviará el 12 jun 10:00 a.m." + countdown live (en client). Botón "Cancelar programación"
- `:running` — ratios y pipeline parciales con polling cada 3s (en client). Botón "Pausar"
- `:paused` — ratios congeladas + banner "Pausada hace X minutos". Botón "Reanudar"
- `:failed` — banner rojo "La campaña falló durante el disparo" con razón. Botón "Reintentar"

## Servicios y types

### `lib/types/campaign.ts` (nuevo)

Tipos derivados de los Pydantic schemas del backend (Spec B). Manualmente sincronizados:

```ts
export type CampaignStatus = "draft" | "active" | "running" | "paused" | "completed" | "failed";
export type RecipientStatus = "pending" | "queued" | "sent" | "delivered" | "read" | "failed" | "omitted";
export type AudienceType = "labels" | "csv";

export interface CampaignVariableMapping {
  source: "csv_column" | "contact_attribute";
  key?: string;
  path?: string;
}

export interface CampaignTemplateParams {
  name: string;
  language: string;
  variables: Record<string, CampaignVariableMapping>;
}

export interface CampaignStats {
  pending: number; queued: number; sent: number;
  delivered: number; read: number; failed: number; omitted: number;
}

export interface Campaign {
  id: number;
  title: string;
  campaign_status: CampaignStatus;
  audience_type: AudienceType | null;
  header_media_url: string | null;
  template_params: CampaignTemplateParams | null;
  enabled: boolean;
  scheduled_at: string | null;
  triggered_at: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  inbox: { id: number; name: string };
  stats?: CampaignStats;
}

export interface CampaignRecipient {
  id: number;
  phone: string;
  contact_id: number | null;
  contact_name: string | null;
  conversation_id: number | null;
  message_id: number | null;
  status: RecipientStatus;
  external_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

export interface CampaignCsvUploadResult {
  recipients_count: number;
  columns: string[];
  phone_column: string | null;
  skipped_rows: Array<{ row: number; phone: string | null; reason: string }>;
}

export interface CampaignPreviewSample {
  recipient_id: number;
  phone: string;
  contact_name: string | null;
  rendered_body: string | null;
  header_media: string | null;
  omitted?: boolean;
  reason?: string;
  error?: string;
}

export interface CampaignPreview {
  template_name: string | null;
  recipients_count: number;
  samples: CampaignPreviewSample[];
  omitted_samples: Array<{ phone: string; reason: string }>;
}
```

### `lib/services/campaigns-service.ts` (nuevo)

12 funciones espejo de los endpoints proxy. Cada una toma `accessToken` como primer argumento (patrón del proyecto):

```ts
// Funciones a implementar (signatures):
fetchCampaigns(token): Promise<{ success: boolean; data: Campaign[] }>
fetchCampaign(token, id): Promise<{ success: boolean; data: Campaign }>
createCampaign(token, payload): Promise<{ success: boolean; data: Campaign }>
updateCampaign(token, id, payload): Promise<{ success: boolean; data: Campaign }>
deleteCampaign(token, id): Promise<void>
uploadCampaignCsv(token, id, file: File): Promise<{ success: boolean; data: CampaignCsvUploadResult }>
setLabelsAudience(token, id, label_ids: number[]): Promise<{ success: boolean; data: { recipients_count: number } }>
previewCampaign(token, id): Promise<{ success: boolean; data: CampaignPreview }>
triggerCampaign(token, id, scheduled_at?: string): Promise<{ success: boolean; data: Campaign }>
retryFailedCampaign(token, id): Promise<{ success: boolean; data: { retrying: number } }>
fetchCampaignRecipients(token, id, params): Promise<{ success: boolean; data: CampaignRecipient[]; meta: Pagination }>
deleteCampaignRecipient(token, id, recipient_id): Promise<void>
```

Patrón existente para multipart (ver `messaging-service.ts`): construir `FormData`, fetch con `Authorization: Bearer ${accessToken}` y SIN Content-Type explícito (browser pone boundary).

## Reglas y validaciones del wizard

| Paso | Validación Zod | Bloquea avanzar si |
|---|---|---|
| 1 Datos | `title ≥ 1 char`, `inbox_id required` | título vacío o sin inbox |
| 2 Template | `template_params.name required` | sin template seleccionado |
| 3 Audiencia | Implícita: CSV success o labels seleccionadas | sin recipients creados (`recipients_count === 0`) |
| 4 Variables | Toda variable del template tiene `source + key/path` válido | alguna variable sin asignar Y template requiere variables |
| 5 Preview | `recipients_count > omitted_count` (al menos 1 enviará) | TODOS serían omitidos |
| 6 Schedule | `scheduled_at` futuro si modo programar (mínimo +1 min) | fecha en el pasado |

State entre pasos: Zod schema parcial validado en cliente + PATCH al avanzar. Si el backend rechaza (ej. campaña ya no en `:draft`), se muestra error y se redirige al detalle.

## Estados especiales y empty states

| Estado | Vista |
|---|---|
| 0 campañas en lista | Card grande centrado con icon + "Aún no tenés campañas" + CTA "Crear primera campaña" |
| 0 templates aprobados en paso 2 | Mensaje "No hay templates aprobados en este inbox. Esperá la aprobación de Meta o configurá un template en el inbox." con link al inbox |
| CSV upload error de validación | Toast con razón. Form sigue en estado anterior (sin recipients) |
| `:draft` desde lista | Card highlighted (background `muted`) con "Borrador" badge y "Continuar configurando →" CTA |
| Preview con 0 samples (todos omitidos) | Mensaje "Todos los destinatarios serían omitidos. Volvé al paso 4 y revisá los atributos." con link al paso 4 |
| Retry sin failed | Toast informativo "No hay fallos para reintentar" |

## Testing

| Tipo | Archivo / scope |
|---|---|
| Smoke E2E (Playwright) | `tests/e2e/campaigns/create-and-trigger.spec.ts` — crear → CSV upload → variables → preview → trigger ahora → verificar detalle |
| Smoke E2E (Playwright) | `tests/e2e/campaigns/labels-audience.spec.ts` — audience por labels → variables con contact_attribute → preview |
| Smoke E2E (Playwright) | `tests/e2e/campaigns/retry-failed.spec.ts` — abrir campaña :completed con failures → retry → verificar transición a :running |
| Unit (component) | `_components/*.test.tsx` — al menos `CampaignCard`, `CampaignStatusPill`, `Step4Variables` con la lógica dinámica de CSV vs labels |
| Unit (service) | `lib/services/campaigns-service.test.ts` — mock fetch, verifica que cada función llama el endpoint correcto con auth header |

E2E corre contra el stack docker (Spec B ya merged). Usa fixtures de test (label "smoke-test" precargado con N contactos).

## Archivos afectados (resumen)

**Nuevos (Frontend):**
- `app/dashboard/campaigns/page.tsx` (reemplaza el placeholder actual)
- `app/dashboard/campaigns/campaigns-list-client.tsx`
- `app/dashboard/campaigns/new/page.tsx`
- `app/dashboard/campaigns/[id]/page.tsx`
- `app/dashboard/campaigns/[id]/campaign-detail-client.tsx`
- `app/dashboard/campaigns/[id]/edit/page.tsx`
- `app/dashboard/campaigns/[id]/edit/wizard-client.tsx`
- `app/dashboard/campaigns/_components/` (10+ archivos según mapeo arriba)
- `lib/types/campaign.ts`
- `lib/services/campaigns-service.ts`
- `tests/e2e/campaigns/*.spec.ts` (3 specs E2E)

**Modificados (Frontend):**
- Posible: `components/dashboard/app-sidebar.tsx` para destacar item activo
- Tokens / globals.css **no se tocan** — usamos los existentes

**Sin cambios:** backend (Rails + FastAPI ya cubierto por Spec B)

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| Real-time updates via WebSocket / ActionCable | Polling cada 3s en `:running` es suficiente para v1. ActionCable existe pero integrarlo en client component agrega complejidad |
| Cloning / "duplicar campaña" | Iteración futura. Crear desde cero por ahora |
| Multi-step undo / cambiar inbox mid-wizard | Si el usuario quiere cambiar inbox después del paso 1, debe cancelar el draft y crear nuevo (constraint: vars y template son inbox-dependientes) |
| Edición de campañas en `:running` o `:completed` | State machine del backend lo bloquea |
| Vista de logs detallados por recipient | Tabla muestra `external_error`; logs completos quedan en backend |
| Stats agregadas tipo dashboard ("total enviados este mes") | Out of scope. Vista de detalle per-campaña es suficiente para v1 |
| Notificaciones push cuando una campaña termina | Out of scope |
| Drafts auto-guardados sin salir del paso 1 antes de POST inicial | El draft se crea al click "Nueva campaña" antes de pedir datos. Mínimo es title + inbox |
| i18n strings | Hoy el dashboard está en español hard-coded. Mantener consistencia |
| Mobile responsive del wizard | Tabla de variables en paso 4 quedaría apretada. Asegurar que se vea OK en `md` (≥768px). Mobile real (móvil) puede mostrar "Usa una pantalla más grande para configurar campañas" |
