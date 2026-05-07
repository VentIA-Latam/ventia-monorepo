# US-UX-004: Dark Mode — Paleta Gris Suave + Contraste AA

**Fecha:** 2026-05-07
**Estado:** Aprobado
**Rama objetivo:** development

---

## Contexto

Los operadores usan la app en sesiones largas (chat + pedidos). El dark mode actual ("Slate Noir", hue 286 azulado) genera fatiga visual por su alto contraste y tinte frío. Además el toggle solo permite light/dark, sin opción "sistema". Se reportaron también íconos con contraste insuficiente en dark mode.

---

## Decisiones de diseño

| Aspecto | Decisión |
|---------|----------|
| Paleta dark | Gris neutro suave (chroma ≈ 0, sin matiz azul) |
| Toggle | `DropdownMenuRadioGroup` con 3 opciones: Claro / Sistema / Oscuro |
| Auditoría AA | Puppeteer + axe-core automatizado sobre rutas clave |
| FOUC | Sin cambios — `suppressHydrationWarning` + `disableTransitionOnChange` ya protegen |

---

## 1. Paleta Dark Mode

### Tokens a reemplazar en `apps/frontend/app/globals.css` (bloque `.dark`)

| Token | Valor actual (Slate Noir) | Valor nuevo (Gris Neutro) | Uso |
|-------|--------------------------|--------------------------|-----|
| `--background` | `oklch(0.141 0.004 286)` | `oklch(0.17 0.001 0)` | Fondo de página |
| `--foreground` | `oklch(0.947 0.004 286)` | `oklch(0.92 0 0)` | Texto principal |
| `--card` | `oklch(0.170 0.006 286)` | `oklch(0.21 0.001 0)` | Cards / paneles |
| `--card-foreground` | `oklch(0.947 0.004 286)` | `oklch(0.92 0 0)` | Texto en cards |
| `--popover` | `oklch(0.170 0.006 286)` | `oklch(0.21 0.001 0)` | Dropdowns / popovers |
| `--popover-foreground` | `oklch(0.947 0.004 286)` | `oklch(0.92 0 0)` | Texto en popovers |
| `--secondary` | `oklch(0.211 0.008 286)` | `oklch(0.25 0.001 0)` | Fondos secundarios |
| `--secondary-foreground` | `oklch(0.947 0.004 286)` | `oklch(0.92 0 0)` | Texto secundario |
| `--muted` | `oklch(0.211 0.008 286)` | `oklch(0.25 0.001 0)` | Fondos muted |
| `--muted-foreground` | `oklch(0.556 0.012 286)` | `oklch(0.55 0 0)` | Texto muted |
| `--border` | `oklch(0.279 0.011 286)` | `oklch(0.30 0.001 0)` | Bordes |
| `--input` | `oklch(0.279 0.011 286)` | `oklch(0.30 0.001 0)` | Bordes de inputs |
| `--sidebar-background` | `oklch(0.170 0.006 286)` | `oklch(0.19 0.001 0)` | Fondo sidebar |
| `--sidebar-border` | `oklch(0.240 0.008 286)` | `oklch(0.26 0.001 0)` | Borde sidebar |
| `--sidebar-accent` | `oklch(0.240 0.008 286)` | `oklch(0.26 0.001 0)` | Hover sidebar |

**No cambian:** `--primary` (volt), `--destructive`, colores semánticos (success/warning/danger), `--chat-wallpaper-filter`, `--chat-wallpaper-opacity`, `--noche`, `--volt`, `--marino`, `--cielo`.

---

## 2. Toggle de Tema (3 estados)

### Archivos a modificar
- `apps/frontend/components/dashboard/app-sidebar.tsx`
- `apps/frontend/components/superadmin/superadmin-sidebar.tsx`

### Cambio

Reemplazar el `DropdownMenuItem` actual:
```tsx
<DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
  {theme === "dark" ? <Sun /> : <Moon />}
  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
</DropdownMenuItem>
```

Por un `DropdownMenuRadioGroup` con label de sección:
```tsx
<DropdownMenuSeparator />
<DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
  Apariencia
</DropdownMenuLabel>
<DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
  <DropdownMenuRadioItem value="light">
    <Sun className="mr-2 h-4 w-4" /> Claro
  </DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="system">
    <Monitor className="mr-2 h-4 w-4" /> Sistema
  </DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="dark">
    <Moon className="mr-2 h-4 w-4" /> Oscuro
  </DropdownMenuRadioItem>
</DropdownMenuRadioGroup>
```

Imports a añadir: `Monitor` de `lucide-react`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel` de `@/components/ui/dropdown-menu`.

> `DropdownMenuRadioItem` muestra el indicador de selección de Radix (círculo) por defecto — no requiere ícono de checkmark manual.

**Persistencia:** next-themes guarda en `localStorage` automáticamente. No requiere código adicional.

---

## 3. Auditoría AA con Puppeteer

### Archivo nuevo
`apps/frontend/scripts/audit-dark-mode.ts`

### Comportamiento
1. Lanza Chromium headless con Puppeteer
2. Navega a cada ruta clave con la app corriendo en `localhost:3000`
3. Inyecta clase `.dark` en `document.documentElement` para forzar dark mode
4. Inyecta `axe-core` via CDN
5. Ejecuta `axe.run({ runOnly: ['color-contrast'] })`
6. Acumula violaciones con `impact: 'serious' | 'critical'`
7. Imprime reporte en consola con elemento, color actual, contraste calculado
8. Sale con código 1 si hay violaciones (para uso en CI)

### Rutas auditadas
- `/dashboard`
- `/dashboard/orders`
- `/dashboard/messages` (chat)
- `/superadmin`
- `/superadmin/tenants`
- `/superadmin/invoices`

### Dependencias
`puppeteer` (dev) — verificar si ya está instalado; si no, `pnpm add -D puppeteer`.

### Ejecución
```bash
cd apps/frontend
pnpm tsx scripts/audit-dark-mode.ts
```

---

## 4. Corrección de violaciones AA

Tras ejecutar el script:
- Las violaciones de íconos se corrigen ajustando tokens en `globals.css` (ej. aumentar lightness de `--muted-foreground` en dark)
- Las violaciones en componentes específicos se corrigen con clases `dark:text-*` puntuales
- Re-ejecutar script hasta cero violaciones críticas/serias

---

## Archivos que NO cambian
- `apps/frontend/app/layout.tsx` — FOUC fix intacto
- `apps/frontend/app/providers.tsx` — ThemeProvider config intacta
- `apps/frontend/public/wallpaper-test.html` — referencia visual, no parte del build
- Backend / messaging app

---

## Verificación

1. Cambiar a dark mode → fondo `#1a1a1a`, sin tinte azulado
2. Seleccionar "Sistema" en el dropdown → tema sigue preferencia del SO
3. Recargar → preferencia persiste (localStorage)
4. `pnpm tsx scripts/audit-dark-mode.ts` → 0 violaciones críticas/serias
5. Abrir `wallpaper-test.html` → filtros del chat sin cambios
