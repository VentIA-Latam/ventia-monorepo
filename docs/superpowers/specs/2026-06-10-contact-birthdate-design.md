# Contact Birthdate — Design

**Status:** Draft
**Date:** 2026-06-10
**Owner:** Renzo Lenes
**Related:**
- Extiende el editor inline de `Module 7` ([contact-edit-design](2026-06-05-contact-edit-design.md)).
- Habilita futuro filtro de edad en el wizard de campañas (Spec C, paso 3 audiencia). Ese filtro queda **fuera del scope de este PR**.

## Resumen

Agregar el campo `birthdate` (fecha completa con año) al modelo Contact, exponerlo en el editor inline del panel de conversaciones, y mostrarlo en modo lectura con un sufijo contextual ("cumple en N días" / "¡Hoy cumple!"). Storage como columna `date` para habilitar segmentación por edad en una iteración siguiente sin re-migrar.

## Motivación

Hoy el contacto guarda nombre, email, teléfono y `custom_attributes` libres. Falta un campo de uso recurrente en ventas conversacionales: **fecha de nacimiento**. Casos de uso inmediatos:

1. **Contexto de venta**: el agente ve "Hoy cumple" o "cumple en 3 días" mientras conversa y puede ofrecer un descuento puntual.
2. **Base para campañas futuras**: segmentación por rango de edad (ej. "clientes 25-35") en el wizard de campañas. **No se implementa el filtro en este PR**; el campo queda persistido para que el filtro se agregue solo en una iteración siguiente.

Guardar el dato en `custom_attributes.birthdate` sería más rápido pero impide queries de rango eficientes (no se puede indexar dentro de jsonb sin trucos). Una columna `date` cuesta lo mismo de escribir y deja la puerta abierta a la segmentación.

## Decisiones de diseño (consensuadas)

| Decisión | Elección | Razón |
|---|---|---|
| Storage | Columna `birthdate date` en `contacts` | Habilita segmentación por edad; `date` (4 bytes) sin time/timezone evita ambigüedad de "12 de marzo" según zona horaria |
| Nullable | Sí (default null) | Campo opcional. La mayoría de contactos no van a tenerlo |
| Índice | NO en este PR | Sin queries por birthdate todavía. Se agrega cuando se implemente el filtro de campañas |
| Constraint de rango BD | NO | Validación en Rails modelo + Zod frontend; cambiar rangos en código es cheap |
| Año obligatorio | Sí (cuando se llena) | Sin año no se puede calcular edad. Privacidad cubierta por dejarlo vacío |
| Validación de futuro | Sí (`birthdate <= Date.current`) | Una fecha futura siempre es error de entrada |
| UX input | Calendar shadcn dentro de Popover con `captionLayout="dropdown"` para navegar años | Patrón que el proyecto ya usa (paso 6 del wizard de campañas) |
| UX display panel | `🎂 12 mar 1995 · cumple en N días` (icono Cake de lucide-react) | Más accionable que mostrar edad calculada. Si null, no se renderiza fila (evita "—") |
| Display: hoy | `· ¡Hoy cumple!` | Caso especial |
| Display: lejos | Sin sufijo si faltan >30 días | Reduce ruido visual |
| Scope este PR | Solo campo + editor + display. **NO** integración con campañas | Acotado y rápido de revisar. Filtro de edad llega en iteración siguiente |
| Foto del contacto, identifier, custom_attributes en este PR | NO (fuera de scope) | Inalterado respecto a Module 7 |

## Arquitectura

Tres capas, mismo patrón que el editor inline existente:

```
Frontend (Next.js, "use client")
└─ ContactEditForm agrega <BirthdatePicker> con Popover + Calendar shadcn
└─ ContactInfoPanel agrega fila "🎂 12 mar 1995 · cumple en 17 días" en view mode
   ↓ PATCH /api/messaging/contacts/{id}  (payload incluye birthdate)

Next.js API route
└─ Sin cambios (route propaga body completo a FastAPI)

FastAPI proxy
└─ ContactUpdate schema agrega birthdate: date | None
└─ Endpoint PATCH /messaging/contacts/{id} sin cambios (forwarda payload)

Rails messaging
├─ Migration add_birthdate_to_contacts
├─ Contact model agrega validación "no futura"
└─ ContactsController#update agrega :birthdate a permitted params
                        #contact_json devuelve birthdate ISO
```

### Archivos

**Nuevos (Rails):**
- `apps/messaging/db/migrate/YYYYMMDD_add_birthdate_to_contacts.rb`

**Modificados (Rails):**
- `apps/messaging/app/models/contact.rb` — validación

**Nuevos (Rails specs):**
- `apps/messaging/spec/models/contact_spec.rb` — no existe hoy, hay que crearlo
- `apps/messaging/spec/requests/api/v1/contacts/update_spec.rb` — no existe hoy (solo hay `notes_spec.rb` en ese directorio)

**Modificados (FastAPI):**
- `apps/backend/app/schemas/messaging.py` — `ContactUpdate` agrega `birthdate`
- `apps/backend/tests/unit/services/test_messaging_service.py` — extender `TestUpdateContact`

**Modificados (Frontend):**
- `apps/frontend/lib/types/messaging.ts` — `ContactBrief` y `ContactUpdatePayload` agregan `birthdate`
- `apps/frontend/components/conversations/contact-edit-form.tsx` — agregar `<BirthdatePicker>`
- `apps/frontend/components/conversations/contact-info-panel.tsx` — agregar fila birthdate en view mode
- `apps/frontend/e2e/pages/contact-info-panel.page.ts` — `openBirthdatePicker()` + `selectDate()`
- `apps/frontend/e2e/specs/contact-edit.spec.ts` — test nuevo + `birthdate` en snapshot/restore
- `apps/frontend/e2e/fixtures/contacts-api.ts` — `ContactSnapshot.birthdate` y `restoreContact` propagan el campo

**Nuevos (Frontend, helpers reutilizables):**
- `apps/frontend/lib/utils/birthdate.ts` — `daysUntilBirthday(iso)`, `birthdayLabel(iso, today?)` (helpers puros, testeables sin React)

**Sin cambios:**
- Next.js API route de PATCH `/api/messaging/contacts/[id]` (genérica, propaga body).

## Modelo de datos

### Migración

```ruby
class AddBirthdateToContacts < ActiveRecord::Migration[7.2]
  def change
    add_column :contacts, :birthdate, :date
  end
end
```

Sin índice (se agregará junto con el filtro de campañas).

### Modelo

```ruby
class Contact < ApplicationRecord
  # ... existentes ...

  validate :birthdate_must_be_in_past_or_today

  private

  def birthdate_must_be_in_past_or_today
    return if birthdate.blank?
    return unless birthdate > Date.current
    errors.add(:birthdate, "cannot be in the future")
  end
end
```

### Controller

`contact_params` agrega `:birthdate` a la whitelist. `contact_json` agrega:

```ruby
birthdate: contact.birthdate&.iso8601  # "1995-03-12" o nil
```

## Endpoints

Sin endpoints nuevos. Reutilizamos los existentes de Module 7:

| Capa | Cambio |
|---|---|
| Rails `PATCH /api/v1/contacts/:id` | Acepta `birthdate` en `contact: {...}` body |
| Rails `GET /api/v1/contacts/:id` | Devuelve `birthdate` en respuesta |
| FastAPI `ContactUpdate` schema | `birthdate: date \| None = None` |
| Frontend `updateContact()` | Sin cambios (acepta `ContactUpdatePayload` completo) |

## UI

### Tipos (`lib/types/messaging.ts`)

```ts
export interface ContactBrief {
  // ... existentes ...
  birthdate?: string | null;  // ISO "1995-03-12"
}

export interface ContactUpdatePayload {
  // ... existentes ...
  birthdate?: string | null;
}
```

### Helpers puros (`lib/utils/birthdate.ts`)

```ts
/** Días hasta el próximo aniversario. 0 si es hoy. Considera años bisiestos. */
export function daysUntilBirthday(isoDate: string, today: Date = new Date()): number;

/** Texto secundario del panel. Devuelve null si faltan >30 días. */
export function birthdayLabel(
  isoDate: string,
  today: Date = new Date()
): "¡Hoy cumple!" | "cumple mañana" | `cumple en ${number} días` | null;
```

Helpers puros = fáciles de testear con `vi.setSystemTime` sin tocar componentes.

### Componente: `BirthdatePicker`

Inline dentro de `ContactEditForm` (no extraído a archivo aparte salvo que crezca). Estructura:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-full justify-start">
      <Cake className="h-4 w-4 mr-2" />
      {value ? format(parseISO(value), "PPP", { locale: es }) : "Sin fecha"}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-auto p-0">
    <Calendar
      mode="single"
      selected={value ? parseISO(value) : undefined}
      onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
      captionLayout="dropdown"
      fromYear={1900}
      toYear={new Date().getFullYear()}
      locale={es}
      disabled={(date) => date > new Date()}
    />
    {value && (
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Limpiar
        </Button>
      </div>
    )}
  </PopoverContent>
</Popover>
```

Posición en el form: después del campo "Teléfono".

### Vista lectura (`ContactInfoPanel`)

Dentro de la sección "Contacto" (debajo de phone/email), solo si `contact.birthdate`:

```tsx
{contact.birthdate && (
  <div className="flex items-center gap-3 text-sm">
    <Cake className="h-4 w-4 text-muted-foreground shrink-0" />
    <span className="tabular-nums">
      {format(parseISO(contact.birthdate), "d MMM yyyy", { locale: es })}
    </span>
    {birthdayLabel(contact.birthdate) && (
      <span className="text-muted-foreground">
        · {birthdayLabel(contact.birthdate)}
      </span>
    )}
  </div>
)}
```

### Validación Zod (`contactSchema`)

```ts
birthdate: z
  .union([z.literal(""), z.string().date()])  // ISO "1995-03-12" o vacío
  .optional()
  .refine(
    (v) => !v || new Date(v) <= new Date(),
    "La fecha no puede ser futura"
  ),
```

`z.string().date()` (Zod ≥ 3.23) valida formato ISO `YYYY-MM-DD` sin permitir tiempos parciales.

## Validaciones y edge cases

| Escenario | Comportamiento |
|---|---|
| Birthdate vacía al guardar | Acepta `null`, persiste sin error |
| Birthdate en el futuro | Frontend bloquea con Zod inline + backend rechaza con 422 (defensa en profundidad) |
| Año anterior a 1900 | Calendar no permite navegar; si llega por API directa, Rails acepta (sin validación de mínimo, no es un caso real) |
| Contacto sin birthdate | Fila no se renderiza en view (no `—`) |
| Cumpleaños es hoy | Mostrar `· ¡Hoy cumple!` (sin contador en días) |
| Cumpleaños mañana | Mostrar `· cumple mañana` (sin "1 días") |
| Cumpleaños 29-feb en año no bisiesto | `daysUntilBirthday` cuenta hasta 1-mar (decisión: si no existe el día, usar siguiente día). Documentar en el helper |
| Año cambia mientras el panel está abierto | El cálculo es client-side puro, se recalcula en el próximo render. Sin hack necesario |

## Testing

### Rails

| Archivo | Cubre |
|---|---|
| `spec/models/contact_spec.rb` (nuevo) | birthdate valid past / valid nil / rejects future / stores as Date (no time) |
| `spec/requests/api/v1/contacts/update_spec.rb` (nuevo) | PATCH con birthdate válida → 200 + persisted; PATCH con futuro → 422; PATCH con `null` → birthdate queda NULL; GET devuelve formato ISO |

### FastAPI

| Archivo | Cubre |
|---|---|
| `tests/unit/services/test_messaging_service.py::TestUpdateContact` (extender) | `update_contact` forwarda `birthdate` dentro de `{contact: {...}}` payload |

### Frontend — component (Vitest + Testing Library)

| Archivo | Cubre |
|---|---|
| `lib/utils/birthdate.test.ts` (nuevo) | `daysUntilBirthday`: hoy = 0, mañana = 1, año bisiesto 29-feb edge case. `birthdayLabel`: cada bucket (hoy, mañana, N días, null cuando >30) |
| `components/conversations/contact-edit-form.test.tsx` (extender) | Zod rechaza birthdate futura. Calendar se inicializa con la fecha del contacto. Click "Limpiar" envía `null`. Submit con `null` no envía error de Zod |
| `components/conversations/contact-info-panel.test.tsx` (extender) | Render con birthdate muestra fila. Render sin birthdate no la muestra. Suffix correcto con `vi.setSystemTime` para los 4 casos (hoy / mañana / +N / >30) |

### Frontend — E2E (Playwright)

Extender `e2e/specs/contact-edit.spec.ts`:

```ts
test("editar birthdate via Calendar y verificar persistencia", async ({...}) => {
  await contactInfoPanelPage.enterEditMode();
  await contactInfoPanelPage.openBirthdatePicker();
  await contactInfoPanelPage.selectDate("1995-03-12");
  await contactInfoPanelPage.save();
  await expect(page.getByText(/12 mar 1995/i)).toBeVisible();
});
```

Page object suma 2 métodos: `openBirthdatePicker()` (click en el trigger del Popover) y `selectDate(iso)` (navega dropdowns de mes/año si hace falta y clickea el día).

Snapshot/restore en fixtures: `ContactSnapshot.birthdate` agregado; `restoreContact` propaga el campo. El `afterEach` restaura el valor original (típicamente `null` en el seed).

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| Filtro de edad en wizard de campañas | Iteración siguiente. Este PR deja el campo persistido y consultable |
| Índice en BD sobre `birthdate` | Sin queries por birthdate todavía. Se agrega junto al filtro |
| Reminder automático "hoy cumple X" en notifs/Slack | Out of scope. El display en panel es suficiente para v1 |
| Edad como columna calculada o cached | Calculable client-side cuando se necesite. No tiene sentido duplicar |
| Validación de edad mínima (18+) | No es regla del producto. Algunos contactos legítimamente pueden ser menores (familiar del comprador) |
| Localización del formato de fecha | Hard-coded `locale: es`. El resto del dashboard también está en español |
| Día/mes sin año (privacidad) | Decidimos año obligatorio cuando se llena. Si no se quiere compartir año, dejar el campo vacío |
| Campo `birthdate` en `additional_attributes` o `custom_attributes` legacy | Columna dedicada es lo correcto para queries futuras |
| Importación masiva con birthdate desde CSV | Out of scope. Cuando se agregue importación de contactos, se contemplará |
