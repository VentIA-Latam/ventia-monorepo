# VentIA — Style Guide

Guia de estilos para el frontend de VentIA. Basado en el manual de marca y la implementacion actual en Tailwind CSS v4.

---

## Paleta de Colores

### Brand Tokens

| Token | Valor OKLCH | Hex aprox | Uso principal |
|-------|------------|-----------|---------------|
| **Volt** | `oklch(0.58 0.19 260)` | #4F46E5 | Primary, CTAs, acciones principales, ring focus |
| **Aqua** | `oklch(0.78 0.11 220)` | #7DD3FC | Info, switches activos, iconos interactivos |
| **Marino** | `oklch(0.33 0.10 255)` | #1E3A5F | Texto secundario, foreground sobre cielo |
| **Cielo** | `oklch(0.93 0.04 230)` | #E0F2FE | Backgrounds suaves, fondos de badges, hover |
| **Luma** | `oklch(0.78 0.08 255)` | #93C5FD | Charts, acentos secundarios |
| **Noche** | `oklch(0.20 0.03 250)` | #0F172A | Texto principal, foreground |

### Semantic Tokens

| Token | Basado en | Uso |
|-------|-----------|-----|
| `success` / `success-bg` | Verde | Estados activos, confirmaciones |
| `warning` / `warning-bg` | Amarillo | Alertas, pendientes |
| `danger` / `danger-bg` | Rojo | Errores, acciones destructivas |
| `info` / `info-bg` | Aqua / Cielo | Informacion, tips |

### Mapping a Shadcn/UI

| Token CSS | Valor | Uso Shadcn |
|-----------|-------|------------|
| `--primary` | Volt | Botones principales, links |
| `--secondary` | Cielo | Botones secundarios |
| `--accent` | Cielo | Hover de sidebar, fondos interactivos |
| `--muted` | Gris muy claro | Fondos deshabilitados |
| `--destructive` | Danger | Botones de eliminacion |
| `--border` | Gris claro | Bordes de cards, inputs |

---

## Tipografia

| Fuente | Variable CSS | Uso |
|--------|-------------|-----|
| **Plus Jakarta Sans** | `--font-sans` | Fuente principal (body, UI) |
| **Libre Franklin** | `--font-libre-franklin` | Headings de landing |
| **Source Sans 3** | `--font-source-sans` | Italic / acentos |
| **JetBrains Mono** | `--font-jetbrains-mono` | Codigo, datos tecnicos |

---

## Componentes y Patrones

### Badges de estado

```
Activo:   bg-success-bg text-success border-success/30
Inactivo: bg-muted/50 text-foreground border-border
Alerta:   bg-warning-bg text-warning border-warning/30
Error:    bg-danger-bg text-danger border-danger/30
Info:     bg-info-bg text-info border-info/30
```

### Botones

```
Primary:     bg-volt text-white hover:bg-volt/90
Secondary:   bg-cielo text-marino hover:bg-cielo/80
Destructive: bg-danger text-white hover:bg-danger/90
Ghost:       hover:bg-accent hover:text-accent-foreground
Outline:     border border-border hover:bg-accent
```

### Cards

```
Default: bg-card rounded-xl border border-border shadow-sm
Hover:   hover:shadow-md transition-shadow
Active:  border-volt/30 bg-volt/5
```

### Switches

```
Checked:   data-[state=checked]:bg-aqua
Unchecked: data-[state=unchecked]:bg-input
```

### Sidebar

```
Footer gradient: bg-gradient-to-t from-cielo/5 to-transparent
Avatar:          bg-cielo text-marino
Active item:     bg-sidebar-accent text-sidebar-accent-foreground
```

### Toasts

```
Default:     bg-background border-border
Destructive: bg-danger text-white (cambiar a text-white, NO text-foreground)
```

### Dialog

```
Content:     sm:max-w-md rounded-xl
Header:      DialogTitle text-lg font-semibold
Description: text-muted-foreground text-sm
```

---

## Espaciado

- Padding de pagina: `px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6`
- Gap entre secciones: `gap-4 sm:gap-6`
- Border radius: `rounded-xl` (cards), `rounded-lg` (inputs, buttons)

---

## Iconos

- Libreria: **Lucide React**
- Tamano default: `h-4 w-4` (inline), `h-5 w-5` (cards)
- Color: `text-muted-foreground` (neutral), `text-cielo` (brand), `text-danger` (destructivo)

---

## Reglas Generales

1. **Nunca usar colores hardcodeados** — siempre tokens (`text-volt`, `bg-cielo`, etc.)
2. **cn() para merge de clases** — import de `@/lib/utils`
3. **Responsive mobile-first** — empezar con mobile, agregar `sm:`, `md:`, `lg:`
4. **Dark mode**: no implementado actualmente, disenar solo para light
