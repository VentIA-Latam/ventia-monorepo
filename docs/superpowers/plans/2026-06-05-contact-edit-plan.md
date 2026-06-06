# Plan: Contact Edit + Notes

**Branch a crear:** `feat/contact-edit` desde `feat/campaigns-ui`
**Spec:** `docs/superpowers/specs/2026-06-05-contact-edit-design.md`

## Context

Hoy `ContactInfoPanel` (`apps/frontend/components/conversations/contact-info-panel.tsx`) muestra el contact totalmente read-only. Rails `Api::V1::ContactsController#update` ya existe y acepta `name, email, phone_number, identifier, additional_attributes, custom_attributes`, pero no hay UI ni proxy FastAPI que lo expongan. Tampoco existe modelo `Note` ni tabla `notes`.

Este plan implementa:
1. Modelo `Note` y endpoints CRUD en Rails (`apps/messaging`).
2. Proxy FastAPI para PATCH contact + 4 endpoints notes.
3. Edición inline del contact en el panel lateral existente, con backdrop blur sobre la lista + el hilo de mensajes mientras está activa.
4. Sección Notas integrada al panel (read-only en modo lectura, editable con hover-actions pencil/trash en modo edición).

Scope acotado a campos básicos (name, email, phone) + notas. Custom_attributes, foto y `identifier` quedan fuera de scope (iteración siguiente).

## Decisiones clave (ya validadas en spec)

- Editor **inline** en el panel lateral (no modal, no drawer, no página dedicada).
- **Backdrop blur** sobre lista + hilo cuando el panel está en modo edición. Click no cierra (evita perder cambios).
- Notas **por contacto** (no por conversación). Persisten a través de todas las conversaciones del mismo contacto.
- Notas: tabla `notes`, modelo `Note`. `user_id` nullable (`belongs_to :user, optional: true`).
- Notas: acciones pencil/trash en esquina superior derecha, hover-reveal. Eliminar pide confirmación via `AlertDialog`.
- Header del editor: avatar 36px (no editable) + título `"Editar contacto"`. Sin nombre repetido.
- Campos editables: `name`, `email`, `phone_number`. Apilados, label arriba + input full-width.
- Last-write-wins (sin etag por ahora).
- `custom_attributes`, foto y `identifier` **fuera de scope**.

## Patrones reutilizados (verificados con grep)

| Pieza | Origen | Uso |
|---|---|---|
| `ContactsController#update` | `apps/messaging/app/controllers/api/v1/contacts_controller.rb:31-37` | Ya existe y ya acepta los campos que necesitamos. Lo extendemos sólo para devolver `notes_count` en `contact_json` |
| `resources :contacts do ... end` | `apps/messaging/config/routes.rb:100-106` | Tiene bloque do/end, agregamos `resources :notes` adentro |
| Patrón `Api::V1::BaseController` | mismo dir | Para el nuevo `Contacts::NotesController` |
| `current_account` + `current_user` helpers | `BaseController` | Para scoping y autoría de notas |
| `render_success` / `render_error` | `BaseController` | Wrapper estándar `{ success, data, ... }` |
| `fetchWithAuth<T>` en messaging client | `apps/frontend/lib/api-client/messaging.ts` | Helper para los 5 endpoints nuevos del frontend |
| RHF + Zod + zodResolver | `components/landing/reclamaciones-form.tsx` | Para `ContactEditForm` |
| `AlertDialog` shadcn | `components/ui/alert-dialog.tsx` | Confirmación de delete de nota y de cancelar con dirty |
| `useToast()` custom hook | `hooks/use-toast.ts` | Feedback de mutations |
| Plus Jakarta Sans via `var(--font-sans)` | `app/layout.tsx` | Ya configurada |
| Tokens `--volt`, `--marino`, `--cielo`, `--noche`, `--muted-fg`, `--border`, `--danger-bg` | `app/globals.css` | Para colores del editor + backdrop |
| Lucide-react: `Pencil`, `Trash2`, `X` | Ya instalado | Iconos del editor y de notas |

**Cosas que NO existen y hay que crear:**
- Modelo `Note` + tabla `notes` + spec.
- `Api::V1::Contacts::NotesController` + spec.
- 5 endpoints proxy FastAPI + schemas Pydantic.
- 3 componentes frontend nuevos (`ContactEditForm`, `ContactNotesList`, `ContactNoteItem`).
- Refactor de `ContactInfoPanel` para estados view/edit.
- Backdrop blur mount en `conversations-client.tsx`.

## Implementación en 13 pasos

### Paso 0 — Branch + plan

- Crear branch `feat/contact-edit` desde `feat/campaigns-ui`.
- Este archivo de plan ya queda commiteado al inicio del branch.

### Paso 1 — Migración Rails

**Nuevo:** `apps/messaging/db/migrate/YYYYMMDD_create_notes.rb`

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

Generar timestamp con `bin/rails g migration CreateNotes` para que el filename quede correcto. Aplicar con `pnpm db:migrate` (Docker).

### Paso 2 — Modelo `Note` + asociaciones

**Nuevo:** `apps/messaging/app/models/note.rb`

```ruby
class Note < ApplicationRecord
  belongs_to :account
  belongs_to :contact
  belongs_to :user, optional: true

  validates :content, presence: true, length: { maximum: 2000 }

  scope :recent_first, -> { order(created_at: :desc) }
end
```

**Modificar** `apps/messaging/app/models/contact.rb`: agregar `has_many :notes, dependent: :destroy`.

**Modificar** `apps/messaging/app/models/user.rb`: agregar `has_many :notes, dependent: :nullify`.

**Nuevo:** `apps/messaging/spec/models/note_spec.rb` — cubre:
- Validaciones (presence, max length).
- Asociaciones (account, contact, user optional).
- Scope `recent_first`.
- `dependent: :destroy` al borrar contact.
- `dependent: :nullify` al borrar user (user_id queda NULL).

**Nuevo:** `apps/messaging/spec/factories/notes.rb` — factory para los specs.

### Paso 3 — Controller `Contacts::NotesController`

**Nuevo:** `apps/messaging/app/controllers/api/v1/contacts/notes_controller.rb`

Implementación exacta del spec (sección Endpoints, controller). Hereda `Api::V1::BaseController`. `before_action :set_contact` (scopea por `current_account.contacts`). `before_action :set_note` solo para `update` / `destroy`. `note_json` incluye `user` con `{id, name, email}` o `null`.

**Modificar** `apps/messaging/config/routes.rb`: agregar dentro del bloque `resources :contacts do ... end` (línea 100):

```ruby
resources :notes, controller: 'contacts/notes',
                  only: [:index, :create, :update, :destroy]
```

**Modificar** `apps/messaging/app/controllers/api/v1/contacts_controller.rb`: extender `contact_json` para incluir `notes_count: contact.notes.size` (cached count). Esto evita un fetch separado en la UI para el badge "Notas (N)" en modo lectura.

**Nuevo:** `apps/messaging/spec/controllers/api/v1/contacts/notes_controller_spec.rb` — cubre:
- `index` lista las notas del contacto en `recent_first` order.
- `create` con content válido → 201 + nota persistida con `user_id = current_user.id`.
- `create` con content vacío → 422 + errors.
- `update` con content nuevo → 200 + content actualizado.
- `update` de nota de otro account → 404.
- `destroy` → 200 + nota borrada.
- Scope por account: no se puede acceder a notas de contactos de otro tenant.

### Paso 4 — Schemas Pydantic + service FastAPI

**Modificar** `apps/backend/app/schemas/messaging.py`: agregar `ContactUpdate`, `NoteCreate`, `NoteUpdate`, `NoteUser`, `NoteResponse` (definidos en spec).

**Modificar** `apps/backend/app/services/messaging_service.py`: agregar métodos proxy:

```python
async def update_contact(tenant_id: int, contact_id: int, payload: dict) -> dict
async def get_contact_notes(tenant_id: int, contact_id: int) -> dict
async def create_contact_note(tenant_id: int, contact_id: int, content: str) -> dict
async def update_contact_note(tenant_id: int, contact_id: int, note_id: int, content: str) -> dict
async def delete_contact_note(tenant_id: int, contact_id: int, note_id: int) -> dict
```

Cada uno hace `httpx` PATCH/GET/POST/DELETE al Rails endpoint correspondiente, con `tenant_id` en header (mismo patrón que el resto del archivo). Cuerpo de PATCH/POST envuelve en `{contact: {...}}` o `{note: {...}}` según convención Rails.

### Paso 5 — Endpoints FastAPI

**Modificar** `apps/backend/app/api/v1/endpoints/messaging.py`: agregar 5 endpoints:

```python
@router.patch("/contacts/{contact_id}", response_model=ContactResponse, dependencies=[Depends(require_permission_dual("PATCH", "/messaging/*"))])
async def update_contact(contact_id: int, payload: ContactUpdate, ...): ...

@router.get("/contacts/{contact_id}/notes", response_model=list[NoteResponse], ...): ...
@router.post("/contacts/{contact_id}/notes", response_model=NoteResponse, status_code=201, ...): ...
@router.patch("/contacts/{contact_id}/notes/{note_id}", response_model=NoteResponse, ...): ...
@router.delete("/contacts/{contact_id}/notes/{note_id}", status_code=200, ...): ...
```

Cada uno hace forward al método del service. Manejo de errores: `httpx.HTTPStatusError` → re-raise como `HTTPException` con el status code y body de Rails.

**Nuevo:** `apps/backend/tests/integration/test_messaging_contacts.py` — mockea httpx, verifica:
- PATCH contact con campos válidos forwarda payload correcto y propaga 200.
- 4 endpoints de notes (CRUD) forwardean URL + payload + propagan status.
- Auth header + tenant_id header van en cada request.
- 404 de Rails se propaga como 404.

### Paso 6 — Tipos TS

**Modificar** `apps/frontend/lib/types/messaging.ts`: agregar `NoteAuthor`, `Note`, `ContactUpdatePayload` (definidos en spec).

Verificar que `ContactBrief` existente tenga campos compatibles con lo que el editor necesita (`id`, `name`, `email`, `phone_number`). Si falta algo, agregar.

### Paso 7 — API client

**Modificar** `apps/frontend/lib/api-client/messaging.ts`: agregar 5 funciones:

```ts
export async function updateContact(id: number, payload: ContactUpdatePayload, tenantId?: number): Promise<Contact>
export async function getContactNotes(contactId: number, tenantId?: number): Promise<Note[]>
export async function createContactNote(contactId: number, content: string, tenantId?: number): Promise<Note>
export async function updateContactNote(contactId: number, noteId: number, content: string, tenantId?: number): Promise<Note>
export async function deleteContactNote(contactId: number, noteId: number, tenantId?: number): Promise<void>
```

Cada una usa el helper interno existente (mismo patrón que `updateConversation`, `updateConversationStage` ya presentes en ese archivo). El `Authorization: Bearer` lo arma el helper común; `tenantId` va como header `X-Tenant-Id` si está presente.

### Paso 8 — `ContactNoteItem` (componente individual)

**Nuevo:** `apps/frontend/components/conversations/contact-note-item.tsx`

Props:
```ts
interface ContactNoteItemProps {
  note: Note;
  onUpdate: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  editable: boolean;  // false en modo view
}
```

Estados internos:
- `editing: boolean` — al click en pencil, el contenido se reemplaza por `<textarea>` con botones inline `[Cancelar] [Guardar]`.
- `deleteDialogOpen: boolean` — `AlertDialog` shadcn al click trash.

Render:
- Card sutil con `border-border` + `rounded-lg` + `p-3`.
- Hover: border-color sube a `border-strong` (mix de border).
- Top-right corner: `<div>` con dos `<button>` (pencil + trash), `opacity-0 group-hover:opacity-100 transition-opacity`. Hover en trash: `bg-danger-bg text-danger`.
- Footer: `<author> · <fecha relativa>` (`4 jun · 10:24`). Si `user === null`: "Usuario eliminado".

### Paso 9 — `ContactNotesList`

**Nuevo:** `apps/frontend/components/conversations/contact-notes-list.tsx`

Props:
```ts
interface ContactNotesListProps {
  contactId: number;
  tenantId?: number;
  editable: boolean;  // false → solo render, sin textarea ni hover-actions
}
```

Estado interno:
- `notes: Note[]` — cargadas al mount con `getContactNotes`.
- `loading: boolean`.
- `error: string | null`.
- `newNoteContent: string` (solo si `editable`).

Render:
- Skeleton de 2 notas si `loading && !notes.length` (>800ms via `useDelayedLoading` helper o `setTimeout`).
- Empty state si `!notes.length`: texto `"Sin notas todavía"`.
- `<ContactNoteItem>` por cada nota.
- Si `editable`: `<textarea>` al pie con counter `1850 / 2000` cuando pasa de 1800, botón "Agregar" deshabilitado si vacío.

Comportamiento:
- Crear: optimistic add a la lista con `id: -1` temporal, swap por el real al éxito; rollback si falla.
- Editar (delegado a `ContactNoteItem`): optimistic update; rollback si falla.
- Eliminar (delegado a `ContactNoteItem`): optimistic remove; restore en su posición original si falla.
- Errores → `useToast()` con variant destructive.

### Paso 10 — `ContactEditForm`

**Nuevo:** `apps/frontend/components/conversations/contact-edit-form.tsx`

Props:
```ts
interface ContactEditFormProps {
  contact: ContactBrief;
  tenantId?: number;
  onCancel: () => void;
  onSaved: (updated: ContactBrief) => void;
}
```

Implementación:
- `useForm` con `zodResolver(contactSchema)` (schema del spec, incluye normalización de espacios en phone).
- Tres campos: `name`, `email`, `phone_number`. Cada uno `<Label>` + `<Input>` apilados.
- Botón "Guardar" con spinner cuando `isSubmitting`; deshabilitado si `!isDirty`.
- Botón "Cancelar" → si `isDirty` muestra `AlertDialog` "¿Descartar cambios?"; si no, llama `onCancel` directo.
- Submit: llama `updateContact(contact.id, payload, tenantId)` → toast success → `onSaved(updated)`.
- En error: toast destructive con mensaje del backend si está disponible.
- Atajo `⌘+S` global (mientras el form está montado) → trigger submit.
- Atajo `ESC` → trigger cancel (con confirmación si dirty).

### Paso 11 — Refactor `ContactInfoPanel`

**Modificar:** `apps/frontend/components/conversations/contact-info-panel.tsx`

Agregar:
- Estado interno `mode: "view" | "edit"`, inicia en `"view"`.
- Nueva prop `onEditModeChange?: (editing: boolean) => void` para que el outer client sepa cuándo aplicar el backdrop.

En `mode === "view"`:
- Layout actual (avatar grande centrado, nombre, pill, contacto, temperature, labels, detalles, botón incidencia).
- Agregar **botón "✎ Editar"** en el header (junto al "×"), abre `setMode("edit")` + `onEditModeChange(true)`.
- Agregar sección **"Notas"** abajo de Etiquetas (antes de Detalles): renderiza `<ContactNotesList contactId={contact.id} editable={false} />`. Para que en view mode también se vean. El badge "Notas (N)" usa `notes_count` del contact si está disponible (ya viene del backend extendido en paso 3).

En `mode === "edit"`:
- Header con avatar 36px + "Editar contacto" (sin nombre).
- Body: `<ContactEditForm>` arriba + `<ContactNotesList editable={true}>` abajo.
- Footer fijo `[Cancelar] [Guardar]` (los botones del form se renderizan en el footer via portal o prop drilling).
- Al salir del modo edición (cancel o saved): `setMode("view")` + `onEditModeChange(false)`.

### Paso 12 — Backdrop blur en `conversations-client.tsx`

**Modificar:** `apps/frontend/app/dashboard/conversations/conversations-client.tsx`

- Agregar estado `contactEditing: boolean` (default false).
- Pasar `onEditModeChange={setContactEditing}` a `<ContactInfoPanel>` (dos lugares: línea ~152 y ~201 según `grep`).
- Cuando `contactEditing === true`, renderizar dentro del contenedor de las columnas:

```tsx
{contactEditing && (
  <div
    className="absolute inset-y-0 left-0 z-10
               backdrop-blur-[3px] saturate-90 bg-noche/[0.18]
               pointer-events-none transition-opacity duration-200"
    style={{ right: 'var(--panel-width, 380px)' }}
    aria-hidden="true"
  />
)}
```

(`--panel-width` se define en el style del panel o como constante).

Verificar que el contenedor padre tenga `position: relative` para que el `absolute inset-y-0` funcione. Si no, agregar.

### Paso 13 — Tests + smoke + commit

**Component tests (Vitest + Testing Library):**
- `components/conversations/contact-info-panel.test.tsx` — toggle view↔edit, payload del form, dirty check.
- `components/conversations/contact-edit-form.test.tsx` — Zod (email inválido, phone inválido), submit success/error.
- `components/conversations/contact-notes-list.test.tsx` — render, hover-reveal, optimistic CRUD, rollback.

**E2E (Playwright):**
- `tests/e2e/conversations/contact-edit.spec.ts` — Abrir conversación → click Editar → cambiar nombre y email → guardar → verificar valores en modo lectura.
- `tests/e2e/conversations/contact-notes.spec.ts` — Crear nota, editar, eliminar con confirmación, verificar tras reload.

**Smoke manual:**
- Levantar stack (`pnpm docker:up`), abrir conversación de un contacto.
- Editar nombre → verificar persistencia.
- Editar email vacío → debe permitir guardar.
- Editar phone con formato inválido → debe bloquear submit con error inline.
- Crear nota, editar, eliminar (confirmar dialog).
- Cancelar con cambios → confirmar dialog "descartar".
- Verificar backdrop blur cubre lista + thread, no panel. Click en backdrop no cierra.
- Verificar que al cambiar de conversación (sin guardar) y volver, los cambios no aplicados se descartan.

**Commit final:**
- Mensaje: `feat(contacts): inline contact edit + notes (Module 7)`.
- Body: 1-2 párrafos describiendo el flow + scope.

## Notas de implementación

- **Orden de PRs si se quiere dividir:** backend Rails (pasos 1-3) puede mergearse primero y probarse con cURL/Postman. FastAPI proxy (pasos 4-5) se mergea después. Frontend (pasos 6-12) se mergea al final. Si se prefiere un PR único, hacer todo en `feat/contact-edit` y mergear como bundle.
- **Si Rails no tiene factory de `Account` / `Contact` / `User` ya disponible:** usar las existentes en `apps/messaging/spec/factories/` (verificado: existe `contacts.rb`).
- **CSS del backdrop:** Tailwind 4 con tokens del proyecto. Si `saturate-90` no es una utility válida, usar `style={{ filter: 'saturate(0.9)' }}` directo o un util Tailwind arbitrary.
- **Atajos de teclado:** usar `useEffect` con `keydown` listener montado solo cuando `mode === "edit"`. Limpiar al unmount.
- **Foco al abrir editor:** el primer input (`name`) debe recibir focus automáticamente al entrar en modo edición. Mejora UX.
- **Foco al cancelar:** el botón "Editar" del modo lectura debe recibir focus al volver (accesibilidad).
