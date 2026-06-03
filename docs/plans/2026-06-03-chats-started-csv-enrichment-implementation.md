# Plan de implementación: Enriquecimiento CSV — Chats iniciados por día

**Spec:** `docs/superpowers/specs/2026-06-03-chats-started-csv-enrichment-design.md`
**Rama:** `feat/dashboard-chats-csv-enrichment`

Un solo archivo a modificar: `apps/frontend/components/dashboard/chats-started-widget.tsx`

---

## Paso 1 — Añadir helpers `dayOfWeek` y `todayFormatted`

Agregar justo debajo de la función `shortDate` existente (línea ~41):

```ts
// "2026-06-01" → "Lunes" sin desfase de timezone (constructor de hora local)
function dayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = new Date(y, m - 1, d).getDay();
  return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][idx];
}

// Fecha de hoy en formato DD/MM/YYYY (hora local, sin TZ offset)
function todayFormatted(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}/${mo}/${now.getFullYear()}`;
}
```

---

## Paso 2 — Reemplazar el callback `exportCsv`

Reemplazar el callback completo (desde `const exportCsv = useCallback(` hasta su cierre `}, [data, startDate, endDate])`).

```ts
const exportCsv = useCallback(() => {
  if (!data || total === 0) return;

  // Cabecera de contexto
  const canalLabel =
    inboxId === ALL_INBOXES
      ? "Todos los canales"
      : inboxLabel(inboxes.find((i) => String(i.id) === inboxId)!);

  const header = [
    `Reporte: Chats iniciados por día`,
    `Período: ${startDate} al ${endDate}`,
    `Canal: ${canalLabel}`,
    `Exportado: ${todayFormatted()}`,
    "",
  ].join("\n");

  // Columnas
  const cols = "fecha,dia_semana,chats,acumulado,pct_total";

  let running = 0;
  const rows = data.results.map((r) => {
    running += r.count;
    const pct = total > 0 ? (r.count / total * 100).toFixed(1) : "0.0";
    return `${r.date},${dayOfWeek(r.date)},${r.count},${running},${pct}%`;
  });

  // Filas de resumen
  const avg = (total / data.results.length).toFixed(1);
  const summary = [
    "",
    `TOTAL,,${total},,100.0%`,
    `PROMEDIO,,${avg},,`,
  ].join("\n");

  const csv = [header, cols, ...rows, summary].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chats-iniciados_${startDate}_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}, [data, total, inboxId, inboxes, startDate, endDate]);
```

> **Nota:** se añade `total`, `inboxId` e `inboxes` a las deps del `useCallback` porque ahora se usan dentro.

---

## Paso 3 — Verificación

```bash
cd apps/frontend
pnpm lint
pnpm build
```

Verificación manual en el browser:
- Descargar CSV con "Todos los canales" → cabecera dice `Canal: Todos los canales`.
- Descargar CSV con un canal específico → cabecera dice `Canal: WhatsApp · +51...`.
- Abrir en Excel → abre sin problemas de encoding, `dia_semana` es correcto para fechas cerca del cambio de día, `acumulado` es la suma corriente, `pct_total` del último día ≠ 100% pero la fila TOTAL sí.
- Botón deshabilitado cuando no hay chats en el período.

---

## Cierre

- Sin cambios en backend, schemas, tests de Python ni specs de Rails.
- No commitear sin que el usuario lo pida.
