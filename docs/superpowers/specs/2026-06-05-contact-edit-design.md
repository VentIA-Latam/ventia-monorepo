# Contact Edit + Notes — Design

**Status:** Draft
**Date:** 2026-06-05
**Owner:** Renzo Lenes
**Related:**
- Bloquea la utilidad de [`campaigns-engine`](2026-06-04-campaigns-engine-design.md) (las campañas por etiquetas leen `contact.custom_attributes` que hoy no se pueden poblar; este PR no soluciona custom_attributes pero abre el flujo de edición)
- Reutiliza primitivas de `Api::V1::ContactsController#update` (ya existe en `apps/messaging`)

## Resumen

Habilitar edición inline de la información de contacto desde el panel lateral de conversaciones y agregar gestión de notas por contacto. Reemplaza el panel de lectura actual por un modo dual lectura ↔ edición sin sacar al usuario del contexto de la conversación. Las notas siguen al contacto y se ven desde cualquier conversación del mismo. Incluye un modelo Rails nuevo (`Note`), 5 endpoints proxy nuevos en FastAPI, y refactor del componente `ContactInfoPanel` en frontend.

## Motivación

Hoy `ContactInfoPanel` (`apps/frontend/components/conversations/contact-info-panel.tsx`) muestra contact info totalmente read-only. Rails `Api::V1::ContactsController#update` ya existe pero no hay UI ni proxy FastAPI que lo exponga. Esto produce dos problemas concretos:

1. **No se puede corregir el nombre/email/teléfono** de un contacto cuando llega con datos incompletos desde WhatsApp.
2. **No hay forma de adjuntar contexto** al contacto (notas tipo "cliente VIP", "pidió descuento", "llamó por reclamo de envío") que sobreviva más allá de la conversación actual.

Adicionalmente, el módulo 6 (Campañas Masivas, Spec B) mapea variables de templates a `contact.custom_attributes.<key>`, pero hoy no hay UI para poblar esos atributos. Este PR **no resuelve custom_attributes** (queda para iteración siguiente) pero pone la infraestructura de edición sobre la que se construirá.

## Decisiones de diseño (consensuadas)

| Decisión | Elección | Razón |
|---|---|---|
| Ubicación del editor | Inline en el panel lateral existente (no modal, no drawer, no página dedicada) | Cero pérdida de contexto. El usuario sigue viendo de qué conversación viene |
| Foco visual durante edición | Backdrop `blur(3px) saturate(0.92)` + oscurecido `noche/18%` sobre la lista + el hilo de mensajes; el panel queda nítido | Indica que toda la atención está en el editor sin necesidad de modal |
| Click en backdrop | NO cierra | Evita perder cambios sin querer. Para salir, Cancelar o ESC (con confirmación si dirty) |
| Header del editor | Avatar (36px, no editable) + título `"Editar contacto"`. Sin nombre repetido (se está editando abajo) | Limpio. El nombre vive en el input, no se duplica en header |
| Avatar / foto | NO editable en este PR | Subir foto requiere Active Storage + crop UI. Out of scope, iteración siguiente |
| Campos editables | `name`, `email`, `phone_number`. Todos label arriba + input full-width apilados | Patrón Chatwoot. Consistencia entre los tres campos (sin "input centrado bonito" para el nombre) |
| `identifier` (campo CRM) | NO editable, NO visible | Hoy ningún flow lo usa. Las custom_attributes cubren el caso de ID externos |
| `custom_attributes` | FUERA de scope de este PR | Iteración siguiente. La motivación de campañas se desbloquea entonces |
| Notas: scope | Por **contacto** (no por conversación) | Patrón CRM (Chatwoot). Si Renzo vuelve a escribir en 3 meses, las notas siguen ahí |
| Notas: nombre de tabla y modelo | `notes` (tabla), `Note` (modelo) | Convención Chatwoot |
| Notas: `user_id` | Nullable (autor opcional). `belongs_to :user, optional: true`. En `User`, `has_many :notes, dependent: :nullify` | Si el user que creó la nota es borrado, la nota persiste con autor `nil`; UI muestra "Usuario eliminado" |
| Notas: acciones (editar / eliminar) | Pattern A — icon buttons (pencil + trash) en esquina superior derecha, hover-reveal | Limpio en lectura, descubrible con hover. Estilo Linear / Notion. Eliminar es hover-tint danger (no color permanente) |
| Notas: máximo `content` | 2000 caracteres | Cota razonable. Counter visible `"1850 / 2000"` al pasar 1800 |
| Conflictos last-write-wins | Sí (sin etag / If-Match) | Concurrent editing del mismo contact es raro en este producto. Si surge fricción, se agrega después |
| Backend layer | Rails | El controller `ContactsController#update` ya existe. Solo agregamos `notes` y su controller anidado |
| Frontend pattern | Server component → client component (mismo patrón que conversations) | Consistente con el resto del dashboard |

## Arquitectura

```
USER en una conversación
  ↓
ContactInfoPanel (modo "view")
  - lee contact + temperature + labels (de la conversation ya cargada)
  - lazy fetch GET /messaging/contacts/{id}/notes al primer render
  ↓ click "✎ Editar"
ContactInfoPanel (modo "edit")
  - emite onEditModeChange(true) al outer client → activa backdrop blur
  - renderiza ContactEditForm con campos + ContactNotesList con hover-actions
  ↓ click "Guardar"
  - PATCH /messaging/contacts/{id} con dirty fields
  - POST / PATCH / DELETE /messaging/contacts/{id}/notes/... por cada cambio pendiente
  - paralelo via Promise.all; toast "Contacto actualizado"
  - emite onEditModeChange(false) → cierra backdrop
```

### Archivos

**Nuevos (Frontend):**

- `components/conversations/contact-edit-form.tsx` — form con RHF + Zod, fields (name/email/phone)
- `components/conversations/contact-notes-list.tsx` — lista de notas con hover-actions + textarea para crear
- `components/conversations/contact-note-item.tsx` — una nota individual, alterna entre `<p>` y `<textarea>` al editar, dialog de delete

**Modificados (Frontend):**

- `components/conversations/contact-info-panel.tsx` — agrega prop `mode: "view" | "edit"` controlada internamente. En `view` muestra layout actual + botón "Editar" + sección Notas read-only. En `edit` renderiza `ContactEditForm` y `ContactNotesList` editables
- `app/dashboard/conversations/conversations-client.tsx` — recibe `onEditModeChange` desde el panel; cuando true, monta un `<div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-noche/[0.18] pointer-events-none" />` sobre la columna de la lista + thread (no sobre el panel)
- `lib/api-client/messaging.ts` — agrega `updateContact`, `getContactNotes`, `createContactNote`, `updateContactNote`, `deleteContactNote`
- `lib/types/messaging.ts` — agrega `Note`, `NoteAuthor`, `ContactUpdatePayload`

**Nuevos (Rails messaging):**

- `app/models/note.rb`
- `app/controllers/api/v1/contacts/notes_controller.rb`
- `db/migrate/YYYYMMDD_create_notes.rb`
- Modificación a `app/models/contact.rb` (agregar `has_many :notes, dependent: :destroy`)
- Modificación a `app/models/user.rb` (agregar `has_many :notes, dependent: :nullify`)
- Modificación a `config/routes.rb` (anidar `notes` dentro de `contacts`)

**Nuevos (FastAPI proxy):**

- 5 endpoints en `app/api/v1/endpoints/messaging.py`
- Schemas en `app/schemas/messaging.py`: `ContactUpdate`, `NoteCreate`, `NoteUpdate`, `NoteResponse`, `NoteUser`
- Métodos proxy en `app/services/messaging_service.py`

## Modelo de datos

### Migración

```ruby
class CreateNotes < ActiveRecord::Migration[7.1]
  def change
    create_table :notes do |t|
      t.text :content, null: false
      t.references :account, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :user,    null: true,  foreign_key: true
      t.timestamps
    end
    add_index :notes, [:contact_id, :created_at]
  end
end
```

### Modelo

```ruby
class Note < ApplicationRecord
  belongs_to :account
  belongs_to :contact
  belongs_to :user, optional: true

  validates :content, presence: true, length: { maximum: 2000 }

  scope :recent_first, -> { order(created_at: :desc) }
end
```

`Contact` agrega `has_many :notes, dependent: :destroy`. `User` agrega `has_many :notes, dependent: :nullify`.

## Endpoints

### Rails (`apps/messaging`)

| Método | Path | Body | Respuesta |
|---|---|---|---|
| PATCH | `/api/v1/contacts/:id` | `{ contact: { name, email, phone_number } }` | `{ success: true, data: Contact }` (ya existe, no se toca) |
| GET | `/api/v1/contacts/:contact_id/notes` | — | `{ success: true, data: [Note, ...] }` ordenado por `created_at desc` |
| POST | `/api/v1/contacts/:contact_id/notes` | `{ note: { content } }` | `{ success: true, data: Note }` status 201 |
| PATCH | `/api/v1/contacts/:contact_id/notes/:id` | `{ note: { content } }` | `{ success: true, data: Note }` |
| DELETE | `/api/v1/contacts/:contact_id/notes/:id` | — | `{ success: true }` |

`Contact#contact_json` (ya existente) **se extiende** para incluir `notes_count` (opcional, para el badge en modo lectura).

### Controller Notes

```ruby
class Api::V1::Contacts::NotesController < Api::V1::BaseController
  before_action :set_contact
  before_action :set_note, only: [:update, :destroy]

  def index
    notes = @contact.notes.recent_first.includes(:user)
    render_success(notes.map { |n| note_json(n) })
  end

  def create
    note = @contact.notes.new(
      content: params.require(:note).permit(:content)[:content],
      account: current_account,
      user: current_user
    )
    if note.save
      render_success(note_json(note), status: :created)
    else
      render_error('Failed to create note', errors: note.errors.full_messages)
    end
  end

  def update
    if @note.update(params.require(:note).permit(:content))
      render_success(note_json(@note))
    else
      render_error('Failed to update note', errors: @note.errors.full_messages)
    end
  end

  def destroy
    @note.destroy
    render_success(nil)
  end

  private

  def set_contact
    @contact = current_account.contacts.find(params[:contact_id])
  end

  def set_note
    @note = @contact.notes.find(params[:id])
  end

  def note_json(note)
    {
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      updated_at: note.updated_at,
      user: note.user ? {
        id: note.user.id,
        name: note.user.name,
        email: note.user.email
      } : nil
    }
  end
end
```

### Routes

```ruby
namespace :api do
  namespace :v1 do
    resources :contacts do
      resources :notes, controller: 'contacts/notes',
                        only: [:index, :create, :update, :destroy]
    end
  end
end
```

### FastAPI proxy

| Método | Path | Permission |
|---|---|---|
| PATCH | `/messaging/contacts/{contact_id}` | `PATCH /messaging/*` (wildcard existente) |
| GET | `/messaging/contacts/{contact_id}/notes` | `GET /messaging/*` |
| POST | `/messaging/contacts/{contact_id}/notes` | `POST /messaging/*` |
| PATCH | `/messaging/contacts/{contact_id}/notes/{note_id}` | `PATCH /messaging/*` |
| DELETE | `/messaging/contacts/{contact_id}/notes/{note_id}` | `DELETE /messaging/*` |

### Schemas Pydantic

```python
class ContactUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    phone_number: str | None = Field(None, max_length=32)

class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class NoteUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class NoteUser(BaseModel):
    id: int
    name: str | None
    email: str | None

class NoteResponse(BaseModel):
    id: int
    content: str
    created_at: datetime
    updated_at: datetime
    user: NoteUser | None
```

## UI / Componentes

### Tipos nuevos (`lib/types/messaging.ts`)

```ts
export interface NoteAuthor {
  id: number;
  name: string | null;
  email: string | null;
}

export interface Note {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  user: NoteAuthor | null;
}

export interface ContactUpdatePayload {
  name?: string;
  email?: string | null;
  phone_number?: string;
}
```

### API client (`lib/api-client/messaging.ts`)

```ts
export async function updateContact(
  id: number,
  payload: ContactUpdatePayload,
  tenantId?: number
): Promise<Contact>

export async function getContactNotes(
  contactId: number,
  tenantId?: number
): Promise<Note[]>

export async function createContactNote(
  contactId: number,
  content: string,
  tenantId?: number
): Promise<Note>

export async function updateContactNote(
  contactId: number,
  noteId: number,
  content: string,
  tenantId?: number
): Promise<Note>

export async function deleteContactNote(
  contactId: number,
  noteId: number,
  tenantId?: number
): Promise<void>
```

### Estados del `ContactInfoPanel`

**Modo `view` (default):** layout actual + sección de notas read-only debajo de Etiquetas + botón "✎ Editar" en el header (junto al "×" de cerrar).

**Modo `edit`:** header con avatar 36px + título `"Editar contacto"`; body con `ContactEditForm` (campos label-arriba apilados) + `ContactNotesList` (con hover-actions y textarea para crear); footer fijo con `[Cancelar] [Guardar]` ocupando 50% del ancho cada uno. Se emite `onEditModeChange(true)` que el outer client usa para montar el backdrop blur sobre las columnas de la izquierda.

### Validación (RHF + Zod)

```ts
const contactSchema = z.object({
  name: z.string().trim().max(255).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  phone_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\+\d{8,15}$/, "Formato: +51 904 890 457"))
    .optional(),
});
```

El input se muestra con espacios para legibilidad (ej. `+51 904 890 457`), pero se normaliza antes de validar y enviar.

### Backdrop blur

Mountado en `conversations-client.tsx` cuando `editMode === true`:

```tsx
{editMode && (
  <div
    className="absolute inset-y-0 left-0 right-[var(--panel-width)] z-10
               backdrop-blur-[3px] saturate-90 bg-noche/[0.18]
               pointer-events-none transition-opacity duration-200"
    aria-hidden="true"
  />
)}
```

`--panel-width` corresponde al ancho del `ContactInfoPanel` (variable CSS pasada como inline style desde el client).

## Estados, errores y edge cases

| Escenario | Comportamiento |
|---|---|
| Loading inicial de notas | Skeleton de 2 notas si tarda >800ms. Si vuelve antes, sin skeleton |
| Sin notas | Texto `"Sin notas todavía"` + textarea visible para crear la primera |
| Error al cargar notas | Toast `"No pudimos cargar las notas"` + sección con botón "Reintentar" |
| Error al guardar contact | Toast con el motivo si Rails lo devuelve. Form sigue en edición, no resetea |
| Email inválido | Border rojo + mensaje `"Email no válido"` debajo del input |
| Phone inválido | Mensaje `"Formato: +51 904 890 457"` debajo del input |
| Nota vacía | Botón "Agregar" deshabilitado si `content.trim() === ""` |
| Nota >1800 chars | Counter visible `"1850 / 2000"`. Hard stop a 2000 |
| Cancelar con dirty | `AlertDialog` `"¿Descartar cambios sin guardar?"`. Sin dialog si nada cambió |
| ESC con dirty | Igual que Cancelar |
| Last-write-wins | Sí: si otro dispositivo cambió el contact, gana el último que guarda. Sin etag por ahora |
| Conexión cae | Botón muestra spinner; si red falla, toast `"Sin conexión"`, no se sale del modo edición |
| Optimistic delete + falla DELETE | Toast de error + restore de la nota a su posición original |
| Edit + Delete concurrentes sobre misma nota | El segundo recibe 404 → toast `"La nota ya no existe"` + se quita de la lista |
| User autor borrado | Backend devuelve `user: null` → UI muestra `"Usuario eliminado"` |

## Testing

### Rails — unit + request specs

| Archivo | Cubre |
|---|---|
| `spec/models/note_spec.rb` | Validaciones, asociaciones, `recent_first`, comportamiento `dependent: :nullify` al borrar user |
| `spec/controllers/api/v1/contacts/notes_controller_spec.rb` | CRUD completo, scope por account, autorización |
| `spec/requests/api/v1/contacts_update_spec.rb` | PATCH contact con campos válidos / inválidos (extiende lo existente si lo hay) |

### FastAPI

| Archivo | Cubre |
|---|---|
| `tests/integration/test_messaging_contacts.py` | Proxy de PATCH contact + 4 endpoints de notes. Auth + permisos + propagación de status code |

### Frontend (component)

| Archivo | Cubre |
|---|---|
| `components/conversations/contact-info-panel.test.tsx` | Toggle view↔edit, dirty check, payload del form |
| `components/conversations/contact-edit-form.test.tsx` | Zod (email, phone), submit success/error |
| `components/conversations/contact-notes-list.test.tsx` | Render, hover-reveal, optimistic CRUD, rollback en error |

### Frontend (E2E Playwright)

| Archivo | Flow |
|---|---|
| `tests/e2e/conversations/contact-edit.spec.ts` | Abrir conversación → click Editar → cambiar nombre y email → guardar → verificar persistencia |
| `tests/e2e/conversations/contact-notes.spec.ts` | Crear nota, editar, eliminar con confirmación, verificar tras reload |

## Fuera de scope (intencional)

| Item | Razón |
|---|---|
| `custom_attributes` editables | Iteración siguiente. Desbloqueará completamente la motivación de campañas |
| Foto del contacto editable | Requiere Active Storage + crop UI. Out of scope |
| Campo `identifier` (CRM externo) | Hoy ningún flow lo usa. Las custom_attributes cubren el caso cuando se habiliten |
| `additional_attributes` (city, country, company del Contact heredado de Chatwoot) | Out of scope. No los usamos en ningún flow actual |
| Markdown / rich text en notas | YAGNI. Plain text es suficiente |
| Reacciones / threads de notas | YAGNI |
| Búsqueda de notas | YAGNI. Si una cuenta llega a 100+ notas por contacto, se evalúa |
| Adjuntos en notas | Out of scope |
| Optimistic concurrency (etag / If-Match) | Edit concurrente del mismo contact es raro en este producto. Si surge fricción, se agrega |
| Edición de stage (Pre-venta / Venta) desde el editor | El stage es de la conversación, no del contacto. Sigue editándose desde la vista de lectura del panel |
| Mobile responsive del editor | El panel actual no es responsive hoy. Mantener consistencia con el resto del dashboard |
| i18n | Hoy el dashboard está en español hard-coded. Mantener consistencia |
| Notes por conversación | Decidimos por contacto (patrón CRM). Si en el futuro se necesitan por conversación, se agrega otra tabla |
