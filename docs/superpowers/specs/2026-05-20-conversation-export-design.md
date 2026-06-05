# Diseño: Exportar conversaciones a CSV

**Fecha:** 2026-05-20
**Estado:** Aprobado
**Área:** Messaging — lista de conversaciones

---

## Resumen

Permitir al usuario seleccionar conversaciones manualmente mediante checkboxes y exportarlas como CSV con nombre y teléfono del contacto. La exportación ocurre completamente en el frontend, sin llamada al backend.

---

## Flujo de usuario

1. El usuario hace click en el botón "Seleccionar" del header de la lista de conversaciones.
2. La lista entra en **modo selección**: cada item muestra un checkbox que reemplaza visualmente el avatar.
3. El usuario marca conversaciones individualmente, o usa "Seleccionar todos" para marcar todas las visibles.
4. El header muta mostrando: contador de seleccionados, "Seleccionar todos", "Exportar CSV" (deshabilitado si 0 seleccionados) y "Cancelar".
5. Al hacer click en "Exportar CSV", se genera y descarga el archivo. El modo selección se cierra automáticamente.
6. "Cancelar" limpia la selección y vuelve al header normal.

---

## Componentes afectados

### `ConversationList` (`conversation-list.tsx`)

Nuevo estado local:
- `isSelectMode: boolean` — activa/desactiva el modo selección
- `selectedIds: Set<number>` — IDs de conversaciones seleccionadas

Nuevos handlers:
- `toggleSelectMode()` — activa o desactiva el modo; al desactivar limpia `selectedIds`
- `toggleSelect(id: number)` — agrega o quita un ID del Set
- `selectAll()` — agrega todos los IDs de `conversations` al Set
- `exportCsv()` — llama a `exportToCsv(selectedConversations)`, luego desactiva el modo

Header condicional:
- **Modo normal:** título "Chats" + botón "Seleccionar" (ícono de checkbox)
- **Modo selección:** "N seleccionados" + "Seleccionar todos" + "Exportar CSV" (disabled si N=0) + "Cancelar"

### `ConversationItem` (`conversation-item.tsx`)

Nuevas props:
- `isSelectMode: boolean`
- `isSelected: boolean`
- `onToggleSelect: (id: number) => void`

Comportamiento en modo selección:
- El avatar se reemplaza por un `<Checkbox>` (shadcn/ui) que refleja `isSelected`
- El click sobre el item llama `onToggleSelect(id)` en lugar de `onClick` (abrir conversación)
- El checkbox es clickeable independientemente del área del item

### `exportToCsv` (`lib/utils/messaging.ts`)

Función pura que recibe `Conversation[]` y dispara la descarga:

```ts
function exportToCsv(conversations: Conversation[]): void
```

- Cabecera: `Nombre,Teléfono`
- Filas: `contact.name`, `contact.phone_number` (vacío si es null)
- Valores con comas o comillas se encapsulan en `"..."`
- Nombre del archivo: `conversaciones-YYYY-MM-DD.csv`
- Descarga via `<a href=blob:...>` creado y clickeado programáticamente

---

## Casos borde

| Caso | Comportamiento |
|------|---------------|
| 0 conversaciones seleccionadas | Botón "Exportar CSV" deshabilitado (`disabled` + `opacity-50`) |
| Contacto sin teléfono | Celda vacía en el CSV, sin romper el formato |
| Búsqueda/filtros activos en modo selección | La lista filtra normalmente; IDs seleccionados fuera del filtro se mantienen en el Set pero no se ven ni exportan — solo se exportan los seleccionados que coinciden con la vista actual |
| Mobile | Comportamiento idéntico al desktop |

---

## Formato del CSV

```
Nombre,Teléfono
Juan Pérez,+51987654321
María García,
Pedro López,+51912345678
```

---

## Lo que NO entra en scope

- Exportación de columnas adicionales (email, stage, labels, etc.)
- Formato Excel (.xlsx)
- Persistencia de selección entre sesiones o navegaciones
- Exportación desde el backend
