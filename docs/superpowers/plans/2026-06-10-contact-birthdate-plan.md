# Plan: Contact Birthdate

**Branch a crear:** `feat/contact-birthdate` desde `feat/contact-edit` (HEAD actual del Module 7).
**Spec:** `docs/superpowers/specs/2026-06-10-contact-birthdate-design.md`

## Context

Agregar el campo `birthdate` (columna `date` en `contacts`) y exponerlo en el editor inline existente del panel de conversaciones. En modo lectura se muestra como `🎂 12 mar 1995 · cumple en N días` (o `¡Hoy cumple!` cuando aplica). El campo es opcional; si está vacío no se renderiza fila.

**Scope acotado**: solo agregar el campo + editor + display. La integración con el wizard de campañas (filtro por edad) queda para una iteración siguiente, junto con el índice de BD correspondiente.

## Decisiones clave (ya validadas)

- Storage: columna `date` (no jsonb) para habilitar segmentación por edad sin re-migrar.
- Nullable, sin índice por ahora.
- Validación "no futura" en modelo Rails + Zod frontend (defensa en profundidad).
- UX input: Calendar shadcn dentro de Popover con `captionLayout="dropdown"` para navegar años (1900 → año actual). Locale `es`.
- Display panel: fecha + sufijo dinámico (`¡Hoy cumple!` / `cumple mañana` / `cumple en N días` / sin sufijo si >30 días).
- Sin fila en view mode si `birthdate` es null (evita "—").
- Lógica de display en helpers puros (`lib/utils/birthdate.ts`) — testeable con `vi.setSystemTime`.

## Patrones reutilizados

| Pieza | Origen | Uso |
|---|---|---|
| Migración Rails | `db/migrate/20260606001924_create_notes.rb` | Mismo estilo, `ActiveRecord::Migration[7.2]` |
| Strong params + JSON | `ContactsController` (ya extendido para `notes_count`) | Solo agregar `:birthdate` |
| `ContactUpdate` Pydantic | `apps/backend/app/schemas/messaging.py` | Agregar `birthdate: date \| None = None` |
| `apiPatch` + `updateContact` frontend | `lib/api-client/messaging.ts` | Sin cambios (acepta payload completo) |
| `Popover` + `Calendar` shadcn | `components/ui/popover.tsx`, `components/ui/calendar.tsx` | Pattern del wizard de campañas paso 6 |
| `date-fns` + `locale: es` | Ya importadas en `contact-note-item.tsx` | Format `"PPP"` y `"d MMM yyyy"` |
| Page Object selectores semánticos | `contact-info-panel.page.ts` Module 7 | Mismo enfoque (sin testids) |
| E2E snapshot/restore | `contacts-api.ts` Module 7 | Extender `ContactSnapshot` con `birthdate` |

**Cosas que NO existen y hay que crear:**
- `spec/models/contact_spec.rb` (no había spec del modelo Contact).
- `spec/requests/api/v1/contacts/update_spec.rb` (no había spec del PATCH).
- `lib/utils/birthdate.ts` + tests.

## Implementación en 11 pasos

### Paso 0 — Branch

Crear `feat/contact-birthdate` desde `feat/contact-edit`.

### Paso 1 — Rails: migración

`apps/messaging/db/migrate/<timestamp>_add_birthdate_to_contacts.rb`:

```ruby
class AddBirthdateToContacts < ActiveRecord::Migration[7.2]
  def change
    add_column :contacts, :birthdate, :date
  end
end
```

Aplicar localmente con `bundle exec rails db:migrate` (development + test).

### Paso 2 — Rails: modelo + controller + specs

- **Modificar** `apps/messaging/app/models/contact.rb`:
  - Agregar al schema header (comment) la columna `birthdate :date`.
  - Agregar validación `birthdate_must_be_in_past_or_today` (private method).
- **Modificar** `apps/messaging/app/controllers/api/v1/contacts_controller.rb`:
  - `contact_params` agrega `:birthdate`.
  - `contact_json` agrega `birthdate: contact.birthdate&.iso8601`.
- **Nuevo** `apps/messaging/spec/models/contact_spec.rb`: validaciones del modelo (presence de account, validaciones existentes ligeras + las nuevas de birthdate). Foco: birthdate accepts past, accepts nil, rejects future, stores as Date sin time.
- **Nuevo** `apps/messaging/spec/requests/api/v1/contacts/update_spec.rb`: PATCH con birthdate válida → 200 + persisted; PATCH con futuro → 422 + errors; PATCH con `null` → birthdate queda NULL; GET (o respuesta del PATCH) devuelve formato ISO. Mismo patrón request spec que `notes_spec.rb` (headers `X-Tenant-Id`, `X-API-Key`, `X-User-Id`).

### Paso 3 — FastAPI: schema + test

- **Modificar** `apps/backend/app/schemas/messaging.py`: `ContactUpdate` agrega `birthdate: date | None = None`. Import `from datetime import date` si no está.
- **Modificar** `apps/backend/tests/unit/services/test_messaging_service.py::TestUpdateContact`: agregar un test que verifica que `update_contact` con `payload={"birthdate": "1995-03-12"}` forwardea `json_data={"contact": {"birthdate": "1995-03-12"}}`.

### Paso 4 — Frontend: tipos

**Modificar** `apps/frontend/lib/types/messaging.ts`:

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

### Paso 5 — Frontend: helpers puros

**Nuevo** `apps/frontend/lib/utils/birthdate.ts`:

```ts
export function daysUntilBirthday(isoDate: string, today: Date = new Date()): number;
export function birthdayLabel(
  isoDate: string,
  today: Date = new Date()
): "¡Hoy cumple!" | "cumple mañana" | `cumple en ${number} días` | null;
```

Reglas:
- `daysUntilBirthday`: 0 si es hoy. Considera bisiesto: 29-feb en año no bisiesto se cuenta como 1-mar (decisión documentada).
- `birthdayLabel`: hoy → `¡Hoy cumple!`; mañana → `cumple mañana`; ≤30 días → `cumple en N días`; >30 días → `null`.

**Nuevo** `apps/frontend/lib/utils/birthdate.test.ts`: tests con `vi.setSystemTime` (Vitest) para cada bucket + bisiesto.

### Paso 6 — Frontend: editor (`ContactEditForm`)

**Modificar** `apps/frontend/components/conversations/contact-edit-form.tsx`:

- Importar `Cake` de `lucide-react`, `Popover`/`PopoverTrigger`/`PopoverContent` de `@/components/ui/popover`, `Calendar` de `@/components/ui/calendar`, `format`/`parseISO` de `date-fns`, `es` de `date-fns/locale`.
- Extender Zod schema con el campo `birthdate` (definido en el spec).
- Extender `defaultValues` con `birthdate: contact.birthdate ?? ""`.
- Después del campo "Teléfono", agregar un `<div className="space-y-1.5">` con `<Label>Fecha de nacimiento</Label>` y el `<BirthdatePicker>` inline (Popover + Calendar). Usa el `value`/`onChange` del RHF `Controller` o `setValue` + `watch`.
- Botón "Limpiar" dentro del PopoverContent que llama `onChange(null)`.
- En el submit, agregar `birthdate` al diff de campos cambiados (mismo patrón que name/email/phone). Enviar string ISO o `null`.

### Paso 7 — Frontend: panel (`ContactInfoPanel`)

**Modificar** `apps/frontend/components/conversations/contact-info-panel.tsx`:

- Importar `Cake`, `birthdayLabel`, `format`/`parseISO`, `es`.
- Dentro de la sección "Contacto" en modo view (después de phone/email), agregar el bloque condicional:

```tsx
{contact?.birthdate && (
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

No tocar el modo edit (el form ya cubre el input).

### Paso 8 — Frontend: component tests

- **Extender** `components/conversations/contact-edit-form.test.tsx`:
  - Zod rechaza birthdate futura → muestra error inline.
  - Calendar se inicializa con la fecha del contacto si está presente.
  - Click "Limpiar" envía `birthdate: null` en el submit.
- **Extender** `components/conversations/contact-info-panel.test.tsx`:
  - Render con birthdate muestra fila con icon + fecha formateada + suffix.
  - Render sin birthdate no muestra la fila.
  - Suffix correcto con `vi.setSystemTime` para los 4 buckets.

(Si los archivos `contact-edit-form.test.tsx` y `contact-info-panel.test.tsx` aún no existen porque no se crearon en Module 7, crearlos en este PR — son livianos.)

### Paso 9 — Frontend: E2E

- **Extender** `apps/frontend/e2e/fixtures/contacts-api.ts`:
  - `ContactSnapshot` agrega `birthdate: string | null`.
  - `findContactByPhone` propaga `birthdate` del response.
  - `restoreContact` incluye `birthdate: snapshot.birthdate` en el PATCH.
- **Extender** `apps/frontend/e2e/pages/contact-info-panel.page.ts`:
  - `openBirthdatePicker()`: click en el botón con icon Cake (selector por role/name) que abre el Popover.
  - `selectDate(iso)`: dentro del Popover, navegar los dropdowns de mes/año del Calendar shadcn (selectores por role) y clickear el día. La aria-label de cada día del Radix Calendar tiene el formato del locale, ej. `"12 de marzo de 1995"`.
- **Extender** `apps/frontend/e2e/specs/contact-edit.spec.ts`: agregar test "editar birthdate via Calendar y verificar persistencia" (definido en el spec). El `afterEach` ya existente restaura el snapshot incluyendo `birthdate`.

### Paso 10 — Smoke manual + commit

**Smoke manual:**
- Abrir conversación de Renzo Lenes (o cualquiera) → modo lectura no muestra fila si birthdate es null.
- Click Editar → Calendar visible. Navegar años con el dropdown. Seleccionar 12 mar 1995.
- Guardar → toast verde, panel vuelve a lectura con `🎂 12 mar 1995 · cumple en N días`.
- Setear birthdate al día de hoy → mostrar `¡Hoy cumple!`.
- Setear birthdate futura → form bloquea con error inline.
- Click Limpiar en el Popover → campo se desasigna; al guardar, fila desaparece.

**Commit final:**
- Mensaje: `feat(contacts): birthdate field with calendar picker and upcoming-birthday hint`.
- Body: 1-2 párrafos describiendo el cambio + scope acotado.

### Paso 11 — Push y opcional PR

- `git push -u origin feat/contact-birthdate`.
- Crear PR contra `feat/contact-edit` (o contra main si Module 7 ya se mergeó).

## Verification

### Manual (browser)

1. `pnpm docker:local` (postgres + redis). Rails messaging local. FastAPI + frontend local.
2. Login en `http://localhost:3000`, abrir conversación de un contacto sin birthdate.
3. Panel no muestra fila de cumpleaños.
4. Click ✎ Editar → Calendar visible al desplegar Popover.
5. Seleccionar 12 mar 1995. Guardar.
6. Modo lectura muestra `🎂 12 mar 1995 · cumple en N días`.
7. Cambiar fecha al día actual → muestra `¡Hoy cumple!`.
8. Cambiar a una fecha de pasado mañana (vía Calendar) → `cumple en 2 días`.
9. Reload → cambios persisten.

### Tests automatizados

```bash
# Rails
cd apps/messaging && bundle exec rspec spec/models/contact_spec.rb \
  spec/requests/api/v1/contacts/update_spec.rb

# FastAPI
cd apps/backend && uv run pytest tests/unit/services/test_messaging_service.py \
  -k "TestUpdateContact"

# Frontend
cd apps/frontend && pnpm test birthdate contact-edit-form contact-info-panel

# E2E
cd apps/frontend && pnpm exec playwright test \
  --grep "@contacts" --project=chromium --workers=1
```

### cURL sanity (después del paso 2)

```bash
curl -X PATCH http://localhost:3001/api/v1/contacts/476 \
  -H "X-Tenant-Id: $TENANT" -H "X-API-Key: $MESSAGING_SERVICE_API_KEY" \
  -H "X-User-Id: $USER" -H "Content-Type: application/json" \
  -d '{"contact":{"birthdate":"1995-03-12"}}'

curl -X PATCH http://localhost:3001/api/v1/contacts/476 \
  -H "X-Tenant-Id: $TENANT" -H "X-API-Key: $MESSAGING_SERVICE_API_KEY" \
  -H "X-User-Id: $USER" -H "Content-Type: application/json" \
  -d '{"contact":{"birthdate":"2099-01-01"}}'   # debe 422
```

## Notas de implementación

- **Locale y formato**: hard-coded `es` (`date-fns/locale/es`). Si se internacionaliza el dashboard en el futuro, este es uno de los puntos a parametrizar (junto con el resto del dashboard).
- **Calendar shadcn**: en el proyecto puede estar ya como `components/ui/calendar.tsx` (lo usan los specs del wizard de campañas paso 6). Si no está, instalar con `pnpm dlx shadcn-ui@latest add calendar` y verificar que use `react-day-picker` v9 + `captionLayout="dropdown"`.
- **Año bisiesto en helper**: documentar como comment en `daysUntilBirthday` que un cumple 29-feb en año no bisiesto se cuenta como 1-mar (decisión consensuada).
- **Foco**: al abrir el Popover del Calendar, el foco va al Calendar (Radix lo hace). Al cerrar, vuelve al trigger (también Radix). Sin trabajo extra.
- **A11y**: el `<Button>` trigger del Popover debe tener `aria-label="Seleccionar fecha de nacimiento"` para que screen readers lo anuncien bien (mejor que el solo texto formateado).
- **Snapshot E2E**: el `restoreContact` debe enviar `birthdate: snapshot.birthdate ?? null` para que un contacto que originalmente no tenía birthdate quede sin birthdate después del test (no que herede el que el test seteó).
