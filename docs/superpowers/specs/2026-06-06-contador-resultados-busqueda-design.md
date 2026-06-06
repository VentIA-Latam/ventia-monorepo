# Design: Contador de resultados en lista de conversaciones

**Fecha:** 2026-06-06
**Branch:** `feat/search-results-counter` (por crear)
**Status:** Diseño aprobado, pendiente plan de implementación

## 1. Contexto

En el módulo de mensajería (`/dashboard/...`, panel de Chats), la lista de conversaciones permite buscar por texto y aplicar filtros (etiqueta, fecha, temperatura, no leídas, bandejas). Hoy no hay ninguna indicación de **cuántos resultados** arroja una búsqueda o un filtro: el usuario solo ve la lista y debe inferirlo.

El dato ya existe en el backend. La respuesta paginada de conversaciones incluye `meta.total_count` (Kaminari, vía `apps/messaging/app/controllers/api/v1/base_controller.rb:55-63`). El frontend hoy solo consume `meta.next_page` para la paginación infinita (`apps/frontend/components/conversations/conversation-list.tsx:121,196`). Es decir, mostrar la cantidad de resultados **no requiere cambios en backend** — basta con aprovechar un campo que ya viaja en la respuesta.

## 2. Objetivo

Que el usuario vea, de un vistazo, **cuántas conversaciones** coinciden con su búsqueda o sus filtros activos. Vista puramente informativa, sin drill-down ni interacción.

## 3. Decisiones de UX (acordadas con el usuario)

| Decisión | Resultado |
|----------|-----------|
| Ubicación | Línea de resumen propia, entre la fila de filtros y la lista |
| Comportamiento de scroll | **Sticky**: la línea queda fija arriba de la lista al hacer scroll |
| Qué cuenta | Total real de la búsqueda/filtro vía `meta.total_count` (no lo cargado en pantalla) |
| Interactividad | Solo informativa (sin click handlers) |
| Cuándo aparece | Solo cuando hay texto de búsqueda **o** algún filtro activo |
| Estado 0 resultados | No se muestra la línea (ya aparece el `EmptyState` "No hay resultados para esta búsqueda") |
| Texto | `N resultados` (plural) / `1 resultado` (singular) |

### Por qué una línea neutral y no junto a "MENSAJES"

La idea inicial fue colocar el conteo junto al encabezado "MENSAJES". Se descartó: ese encabezado pertenece **solo al sub-grupo de coincidencias por contenido de mensaje** (`conversation-list.tsx:552-556`), mientras que arriba —sin encabezado— van las coincidencias por contacto. Un número sobre "MENSAJES" se leería como "cantidad de mensajes" y sería ambiguo (el total combina contactos + mensajes). Una línea de resumen neutral, fuera de ambos grupos, representa el total sin confusión y además cubre el caso de **filtros sin búsqueda** (donde no existe el encabezado "MENSAJES").

### Por qué `total_count` y no el conteo de lo cargado

La lista usa scroll infinito (25 por página, `conversations_controller.rb:11`). Contar los items ya cargados (`conversations.length`) diría "25" aunque haya más. `meta.total_count` es el total exacto del conjunto filtrado/buscado, así que el número es correcto desde el primer render sin depender del scroll.

## 4. Arquitectura

Cambio aislado a un solo componente cliente. No hay nuevos componentes, servicios ni endpoints.

```
ConversationList (client component)
  ├─ estado nuevo: totalCount: number | null
  ├─ fetchConversations()  → setTotalCount(data.meta?.total_count ?? null)
  ├─ debouncedRefetch()    → setTotalCount(data.meta?.total_count ?? null)
  └─ render:
       <ConversationFilters />
       <div listRef · overflow-y-auto>
         ├─ [NUEVO] línea sticky de resumen (condicional)
         └─ grupos de resultados (contactos / MENSAJES) + skeleton/empty
```

## 5. Archivos a crear / modificar

### 5.1 `apps/frontend/components/conversations/conversation-list.tsx` (modificar) — único archivo

**a) Nuevo estado**, junto a los demás `useState` (cerca de la línea 67-72):

```tsx
const [totalCount, setTotalCount] = useState<number | null>(null);
```

**b) Setearlo al recibir data.** En `fetchConversations` (tras `onConversationsChange(data.data ?? [])`, línea ~120):

```tsx
setTotalCount(data.meta?.total_count ?? null);
```

Y lo mismo en `debouncedRefetch` (tras `onConversationsChange(data.data ?? [])`, línea ~238). No hace falta tocar `loadMoreConversations`: el total no cambia entre páginas (opcionalmente puede re-setearse desde su `data.meta` por robustez, pero no es necesario).

**c) Condición de visibilidad.** Calcular en el cuerpo del componente:

```tsx
const hasActiveFilters = !!(
  activeFilters.label ||
  activeFilters.temperature ||
  activeFilters.dateRange ||
  activeFilters.unread ||
  (activeFilters.inboxIds?.length)
);
const showResultsCount =
  !loading &&
  (searchQuery.trim() !== "" || hasActiveFilters) &&
  totalCount != null &&
  totalCount > 0;
```

**d) Render de la línea sticky.** Como **primer hijo** del contenedor scrolleable (`<div ref={listRef} className="flex-1 overflow-y-auto">`, línea 500), para que `sticky top-0` se ancle al hacer scroll de la lista:

```tsx
{showResultsCount && (
  <div className="sticky top-0 z-10 px-4 py-1.5 text-xs text-muted-foreground bg-background/95 backdrop-blur border-b border-border/30">
    {totalCount === 1 ? "1 resultado" : `${totalCount} resultados`}
  </div>
)}
```

**Notas de estilo:**
- `sticky top-0 z-10` ancla la línea al tope del área scrolleable.
- `bg-background/95 backdrop-blur` evita que el contenido se transparente por detrás al scrollear (la lista no tiene fondo opaco por item).
- `z-10` la mantiene sobre los items pero por debajo de popovers de filtros (que viven fuera del scroll).
- Coherente con el header "MENSAJES" en tamaño (`text-xs`/`text-[11px]`) y color (`text-muted-foreground`), sin imitar su `uppercase tracking-wider` para que no se confunda con un encabezado de grupo.

## 6. Comportamiento esperado

| Situación | Línea de resumen |
|-----------|------------------|
| Sin búsqueda ni filtros (lista normal) | Oculta |
| Búsqueda con N>0 resultados | Visible: `N resultados`, sticky al scrollear |
| Filtro(s) activos sin texto, N>0 | Visible: `N resultados` |
| Búsqueda/filtro con 0 resultados | Oculta (se muestra el `EmptyState` existente) |
| Mientras carga (`loading`) | Oculta (se muestran skeletons) |
| `total_count` ausente en la respuesta | Oculta (fallback seguro) |

## 7. Aplicación de `vercel-react-best-practices`

- **Sin fetch nuevo ni `useEffect` adicional:** se reutiliza la data ya pedida; solo se guarda un campo más del `meta` existente.
- **Estado mínimo:** un único `number | null`. La condición de visibilidad es derivada (se calcula en render, no se almacena).
- **Sin dependencias nuevas:** solo Tailwind y el markup existente.
- **Cero impacto en backend / red:** no se agregan llamadas.

## 8. Lo que NO está incluido (YAGNI)

- Conteos separados por grupo ("Contactos 3 · Mensajes 24") — requeriría que el backend devuelva conteos separados; descartado por el usuario a favor de un total simple.
- Contador como acción (limpiar filtros/búsqueda al hacer click).
- Mostrar el total de la sección cuando no hay búsqueda ni filtros.
- "Mostrando X de Y" / indicadores de paginación.
- Contador en el panel de búsqueda de mensajes dentro de una conversación (`message-search-panel.tsx`).

## 9. Testing

Validación manual (no se contempla testing automatizado nuevo):

1. Buscar un término con varios resultados → aparece `N resultados` con el total correcto (coincide con lo que devuelve el backend, no con los 25 cargados).
2. Hacer scroll en la lista → la línea permanece fija arriba.
3. Aplicar un filtro (p. ej. etiqueta) sin texto de búsqueda → aparece el conteo.
4. Búsqueda sin resultados → no aparece la línea; se ve el `EmptyState`.
5. Limpiar búsqueda y filtros → la línea desaparece.
6. Plural/singular: una búsqueda con exactamente 1 resultado muestra `1 resultado`.
7. Dark mode: contraste correcto del texto y del fondo `bg-background/95 backdrop-blur`.

## 10. Open questions

Ninguna. Decisiones de UX cerradas en la sección 3.

## 11. Próximos pasos

1. Usuario aprueba este spec.
2. Invocar skill `writing-plans` para generar el plan de implementación detallado.
3. Implementar siguiendo el plan, aplicando `vercel-react-best-practices` en línea.
