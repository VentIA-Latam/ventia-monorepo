# Spec: Enriquecimiento del CSV — Widget "Chats iniciados por día"

**Fecha:** 2026-06-03
**Rama sugerida:** `feat/dashboard-chats-csv-enrichment`
**Alcance:** Solo frontend (`chats-started-widget.tsx`). Sin cambios en backend ni Rails.

---

## Contexto

El widget "Chats iniciados por día" (US-AUDIT-003) permite exportar la serie diaria a CSV.
El CSV actual tiene solo dos columnas (`fecha`, `chats`), insuficiente para que administradores
de conversaciones y gerentes lo utilicen directamente sin re-procesar los datos.

---

## Objetivo

Enriquecer el CSV con contexto del export y columnas calculadas para que sea utilizable
directamente en Excel/Google Sheets sin pasos adicionales.

---

## Diseño

### Estructura del archivo

```
Reporte: Chats iniciados por día
Período: 2026-05-01 al 2026-05-31
Canal: WhatsApp · +51999111222
Exportado: 03/06/2026

fecha,dia_semana,chats,acumulado,pct_total
2026-05-01,Jueves,0,0,0.0%
2026-05-02,Viernes,3,3,0.7%
2026-05-03,Sábado,5,8,1.2%
...
2026-05-31,Domingo,12,420,2.9%

TOTAL,,420,,100.0%
PROMEDIO,,14.0,,
```

### Cabecera de contexto (4 líneas + línea en blanco)

| Línea | Contenido |
|-------|-----------|
| `Reporte:` | `Chats iniciados por día` (fijo) |
| `Período:` | `{startDate} al {endDate}` (formato YYYY-MM-DD del filtro activo) |
| `Canal:` | `"Todos los canales"` si no hay filtro de inbox; si hay filtro: resultado de `inboxLabel(inbox)` → `"WhatsApp · +51999111222"` o `"Instagram · ventia.shop"` |
| `Exportado:` | Fecha local de descarga en formato `DD/MM/YYYY` |

### Columnas de datos

| Columna | Fuente | Descripción |
|---------|--------|-------------|
| `fecha` | `result.date` | Fecha ISO YYYY-MM-DD (sin cambios) |
| `dia_semana` | Calculado | Nombre del día en español. Ver regla de cálculo abajo. |
| `chats` | `result.count` | Conteo de chats ese día (sin cambios) |
| `acumulado` | Calculado | Suma corriente de `chats` desde el primer día del rango |
| `pct_total` | Calculado | `(count / total * 100).toFixed(1) + "%"`. Si `total === 0` → `"0.0%"` |

### Filas de resumen (al final, separadas por línea en blanco)

| Fila | Columnas con valor |
|------|--------------------|
| `TOTAL` | columna `chats` = `data.total`; columna `pct_total` = `"100.0%"` |
| `PROMEDIO` | columna `chats` = `(total / results.length).toFixed(1)` (promedio sobre todos los días del rango, incluidos los días con 0) |

---

## Reglas de cálculo

### `dia_semana` — sin saltos de timezone

**No usar** `new Date("YYYY-MM-DD")` porque lo interpreta como UTC midnight y
en Lima (UTC-5) retrocede al día anterior.

**Usar** el constructor de hora local:

```ts
function dayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = new Date(y, m - 1, d).getDay(); // hora local, sin offset
  return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][idx];
}
```

### `Exportado` — fecha de descarga en formato local

```ts
function todayFormatted(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${now.getFullYear()}`;
}
```

### `Canal` en la cabecera

```ts
const canalLabel =
  inboxId === ALL_INBOXES
    ? "Todos los canales"
    : inboxLabel(inboxes.find((i) => String(i.id) === inboxId)!);
```

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/frontend/components/dashboard/chats-started-widget.tsx` | Reemplazar el callback `exportCsv` y añadir helpers `dayOfWeek` y `todayFormatted`. Reutilizar `inboxLabel` (ya existe en el mismo archivo). |

Sin otros cambios. No se tocan: backend Python, Rails, schemas, tests existentes, otros widgets.

---

## Casos borde

| Caso | Comportamiento |
|------|---------------|
| `total === 0` | Botón CSV deshabilitado (`isEmpty`); guardia interna en `exportCsv` retorna sin generar. `pct_total` usa `"0.0%"` de todos modos. |
| Canal seleccionado ya no existe en `available_inboxes` | Imposible al momento del export: el widget ya resetea `inboxId` a `ALL_INBOXES` si el inbox desaparece (efecto en el widget). |
| `results` vacío con `total > 0` | Teóricamente imposible (Rails siempre llena todos los días). Guardia: división segura. |

---

## Acceptance criteria

- [ ] El CSV descargado incluye las 4 líneas de contexto antes de los headers de columna.
- [ ] La línea `Canal:` muestra `"Todos los canales"` cuando no hay filtro de inbox activo.
- [ ] La línea `Canal:` muestra el nombre y el identificador del canal cuando hay filtro activo.
- [ ] Las 5 columnas están presentes: `fecha`, `dia_semana`, `chats`, `acumulado`, `pct_total`.
- [ ] `dia_semana` es correcto para fechas cerca de medianoche (sin desfase de TZ).
- [ ] `acumulado` es la suma corriente acumulada, no el total global.
- [ ] `pct_total` suma 100% en el total (salvo redondeo por decimales).
- [ ] Fila `TOTAL` muestra el total de chats del período.
- [ ] Fila `PROMEDIO` muestra el promedio diario redondeado a 1 decimal.
- [ ] El archivo se abre correctamente en Excel (BOM UTF-8 preservado).
- [ ] El botón CSV sigue deshabilitado cuando `total === 0`.
