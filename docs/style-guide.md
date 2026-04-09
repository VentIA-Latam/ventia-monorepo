# VentIA — Style Guide

Guia de estilos para el frontend de VentIA. Basado en el Manual de Marca 2025 (Studio 9) y la implementacion actual en Tailwind CSS v4.

---

## Personalidad de Marca

VentIA se presenta como una marca **agil, confiable y visionaria**. Combina tecnologia con toque humano. Transmite eficiencia sin perder calidez.

**Tono de voz**: Profesional pero cercano. Claro y directo. Evitar jerga tecnica innecesaria en UI orientada a agentes.

---

## Paleta de Colores

> Del Manual de Marca: "Colores como Volt y Aqua aportan energia y frescura, mientras que Marino y Noche anaden seriedad y solidez. Tonos mas suaves como Cielo y Luma equilibran la intensidad."

### Brand Tokens

| Token | Valor OKLCH | Hex aprox | Rol segun manual | Uso en app |
|-------|------------|-----------|------------------|------------|
| **Volt** | `oklch(0.58 0.19 260)` | #4F46E5 | Energia, accion | Primary, CTAs, acciones principales, ring focus |
| **Aqua** | `oklch(0.78 0.11 220)` | #7DD3FC | Frescura, tecnologia | Info, switches activos, iconos interactivos |
| **Marino** | `oklch(0.33 0.10 255)` | #1E3A5F | Seriedad, solidez | Texto secundario, foreground sobre cielo |
| **Cielo** | `oklch(0.93 0.04 230)` | #E0F2FE | Equilibrio, suavidad | Backgrounds suaves, fondos de badges, hover |
| **Luma** | `oklch(0.78 0.08 255)` | #93C5FD | Armonia visual | Charts, acentos secundarios |
| **Noche** | `oklch(0.20 0.03 250)` | #0F172A | Solidez, contraste | Texto principal, foreground |
| **Blanco** | `#FFFFFF` | | Legibilidad | Backgrounds principales |
| **Negro** | `#000000` | | Legibilidad | Uso minimo, preferir Noche |

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

### Combinaciones de color del logo

Del manual: el isotipo y logotipo se usan en versiones claras y oscuras segun el fondo.
- **Fondo claro**: Logo en Noche o Marino
- **Fondo oscuro**: Logo en Blanco o Cielo
- **Nunca**: Logo sobre fondos recargados o con poco contraste

---

## Tipografia

> Del Manual: Jerarquia tipografica con Libre Franklin para encabezados, fuente sans-serif para cuerpo, Inter para CTAs.

| Fuente | Variable CSS | Uso en app | Rol segun manual |
|--------|-------------|------------|------------------|
| **Plus Jakarta Sans** | `--font-sans` | Fuente principal (body, UI) | Equivale al cuerpo del texto |
| **Libre Franklin** | `--font-libre-franklin` | Headings de landing | Subencabezados (Semibold) |
| **Source Sans 3** | `--font-source-sans` | Italic / acentos | Estilo italico para conceptos |
| **JetBrains Mono** | `--font-jetbrains-mono` | Codigo, datos tecnicos | No en manual (agregado para dev) |

### Jerarquia en la app

```
H1: text-2xl font-bold (Plus Jakarta Sans)
H2: text-xl font-semibold
H3: text-lg font-semibold
Body: text-sm (14px) — tamano base en dashboard
Caption: text-xs text-muted-foreground
```

---

## Logo e Isotipo

- **Isotipo**: Dos flechas que forman una caja — simboliza pedir/recibir, escribir/responder, enviar/entregar
- **Logo**: "ventia" en minusculas sin serifas. "vent" + "ia" diferenciados por color
- **Espacio de seguridad**: Minimo 1 pulgada (o equivalente proporcional) alrededor del logo
- **Tamano minimo**: 4cm de ancho (impreso), 1 pulgada (digital)
- **Variaciones**: Vertical y horizontal, ambas centradas con distancia exacta entre isotipo y texto

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
Destructive: bg-danger text-white
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

## Imagenes y Fotografia

Del manual:
- Evitar fondos recargados detras del logo
- Si se usa fotografia con logo, usar tono sepia o preset suave para reducir ruido
- Las imagenes deben transmitir profesionalismo y tecnologia

---

## Reglas Generales

1. **Nunca usar colores hardcodeados** — siempre tokens (`text-volt`, `bg-cielo`, etc.)
2. **cn() para merge de clases** — import de `@/lib/utils`
3. **Responsive mobile-first** — empezar con mobile, agregar `sm:`, `md:`, `lg:`
4. **Dark mode**: no implementado, disenar solo para light
5. **Consistencia visual**: mantener coherencia en todos los medios (del manual de marca)
6. **Logo siempre con espacio de seguridad** — nunca pegado a otros elementos
7. **Contraste**: asegurar legibilidad del texto sobre cualquier fondo
