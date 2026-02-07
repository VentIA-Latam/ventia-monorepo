# VentIA — Design System & Brand Identity

Source: VentIA Manual de Marca (Studio 9, 2025)

---

## Brand Essence

VentIA is the first platform in Latin America combining conversational AI with real logistics. It automates sales and deliveries via WhatsApp, TikTok, and Instagram — closing sales, validating payments, and coordinating delivery from a single system with human supervision at every stage.

**Personality:** Direct, efficient, resolute, close (without being informal), visionary, trustworthy, accessible in language.

**Voice:** Clear and precise without unnecessary jargon. Speaks like a strategic partner who knows what they're doing. Empathetic and professional. Inspires businesses to think big.

---

## Color Palette

All colors from the official brand manual. Use these as the foundation for all interface work.

| Name    | Hex       | RGB             | Role / Usage                                    |
|---------|-----------|-----------------|-------------------------------------------------|
| Volt    | `#2F7CF4` | 47, 124, 244    | **Primary brand blue.** CTAs, active states, links, primary actions |
| Aqua    | `#5ACAF0` | 90, 202, 240    | **Secondary accent.** Highlights, badges, secondary indicators |
| Marino  | `#184373` | 24, 67, 115     | **Deep blue.** Headers, strong text on light bg, sidebar accents |
| Cielo   | `#C8ECFD` | 200, 236, 253   | **Light tint.** Hover states, selected rows, subtle backgrounds |
| Luma    | `#9EBEFA` | 158, 190, 250   | **Mid-tone blue.** Progress bars, tags, soft indicators |
| Noche   | `#182432` | 24, 36, 50      | **Near-black.** Dark mode base, high-contrast text, dark surfaces |
| Blanco  | `#FFFFFF` | 255, 255, 255   | **White.** Base surface in light mode |
| Negro   | `#000000` | 0, 0, 0         | **Black.** Strongest text contrast (use sparingly) |

### Color Application Rules

- **Primary action color:** Volt (`#2F7CF4`) — buttons, links, active nav items
- **Hover / soft selection:** Cielo (`#C8ECFD`) — table row hover, selected states
- **Secondary emphasis:** Aqua (`#5ACAF0`) — badges, info indicators, secondary buttons
- **Deep accents:** Marino (`#184373`) — sidebar text, section headers, dark accents
- **Soft mid-tone:** Luma (`#9EBEFA`) — progress fills, tag backgrounds, chart accents
- **Dark surfaces:** Noche (`#182432`) — dark mode base, tooltips, dark overlays
- **Semantic colors** (not in brand manual — derive from palette):
  - Success: desaturated green (keep cool to match blue palette)
  - Warning: amber/yellow (warm but muted)
  - Destructive: red (standard, but not aggressive)
  - Info: Aqua (`#5ACAF0`)

### Palette Personality

The palette is **cool, professional, and tech-forward** — dominated by blues at different depths. It conveys trust, precision, and modernity. There are NO warm accent colors in the brand. The energy comes from saturation contrast (Volt is vivid blue, Cielo is almost white-blue) rather than hue variety.

**Important:** Do not introduce warm colors (orange, red, warm yellow) as accent or brand colors. The brand world is entirely blue-spectrum. Semantic colors (success green, warning amber, error red) are the only non-blue colors and should be muted/desaturated to not fight the palette.

---

## Typography

From the brand manual hierarchy:

| Level          | Font Family        | Weight     | Usage                                      |
|----------------|--------------------|------------|--------------------------------------------|
| Headlines      | **Libre Franklin** | SemiBold   | Page titles, section headers, hero text    |
| Body           | **Adobe Clean UX** | Regular    | Paragraphs, descriptions, form labels      |
| CTA / UI       | **Inter**          | Light      | Buttons, navigation, interactive elements  |

### Implementation Notes

- **Libre Franklin** is available on Google Fonts — use for major headings
- **Adobe Clean UX** is proprietary (Adobe). For the web app, substitute with **Inter** or **DM Sans** as the body font (closest open-source match for clean, modern sans-serif)
- **Inter** is already the standard for UI/CTA — use across all interactive elements, labels, data, navigation
- Use **tight letter-spacing** on headlines (`-0.02em` to `-0.03em`)
- Use **tabular-nums** for all numeric data (prices, order counts, IDs)
- Data and monospace: use **JetBrains Mono** or **Geist Mono** for order IDs, invoice numbers, SKUs

### Practical Font Stack for the Web App

```
--font-heading: 'Libre Franklin', sans-serif;    /* Headlines, page titles */
--font-body: 'Inter', sans-serif;                /* Body, UI, navigation, CTAs */
--font-mono: 'JetBrains Mono', monospace;        /* Data, IDs, codes */
```

---

## Logo & Isotipo

- **Logo:** "ventia" in lowercase, sans-serif. "vent" and "ia" differentiated by color (Marino + Volt typically). Clean, no serifs, professional.
- **Isotipo:** Two arrows forming a compact shape — symbolizes send/receive, ask/answer, ship/deliver. Also evokes a box shape (logistics). Modern and minimalist.
- **Variations:** Horizontal and vertical layouts. Always centered alignment between logo and isotipo.
- **Safe space:** Minimum 1 inch / 4cm clearance around logo. No competing elements within this zone.
- **Minimum size:** 1 inch width (print), 4cm width (digital).
- **Incorrect uses:** No stretching, no rotation, no color alterations outside defined combinations, no busy backgrounds.

---

## Design Direction for the Dashboard/App

### Feel

**Precise, operational, trustworthy.** Like a command center for commerce — not cold like a terminal, not warm like a consumer app. The interface should feel like a capable partner that has everything under control. Think: Stripe's clarity meets Linear's density.

### Depth Strategy

**Subtle shadows + borders.** Cards use very light shadows (`0 1px 3px rgba(0,0,0,0.06)`) with thin borders (`1px solid rgba(0,0,0,0.06)`). Elevated elements (dropdowns, modals) use slightly stronger shadows. No dramatic depth changes.

### Spacing

- Base unit: **4px**
- Component padding: **12px–16px**
- Card padding: **20px–24px**
- Section gaps: **24px–32px**
- Micro gaps (icon to text): **8px**

### Border Radius

- Buttons, inputs: **8px** (approachable but not bubbly)
- Cards: **12px**
- Modals: **16px**
- Tags/badges: **6px**
- Full round: only for avatars and status dots

### Signature Elements

- **Blue gradient depth:** The palette moves from Noche → Marino → Volt → Luma → Cielo → Blanco as a continuous elevation/importance scale. Use this gradient logic for data visualization, progress indicators, and hierarchy.
- **Arrow motif:** The isotipo's dual-arrow concept (send/receive) can subtly appear in transitions, loading states, or navigation metaphors.
- **Operational tone:** Labels and copy should be direct and action-oriented ("Validar pago", "Pedidos pendientes") — no filler text.

---

## Existing Tech Stack (for implementation context)

- **Framework:** Next.js 16 + React 19
- **Styling:** Tailwind CSS v4 with OKLCH color tokens
- **Components:** shadcn/ui (Radix primitives)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Maps:** react-leaflet

### Tailwind Integration

When mapping brand colors to Tailwind/shadcn tokens, use OKLCH format for consistency with the existing design system. Map as follows:

```css
/* Brand colors mapped to OKLCH (approximate) */
--color-volt: oklch(0.62 0.19 260);        /* #2F7CF4 - Primary */
--color-aqua: oklch(0.78 0.12 220);        /* #5ACAF0 - Secondary */
--color-marino: oklch(0.35 0.10 255);      /* #184373 - Deep */
--color-cielo: oklch(0.93 0.04 230);       /* #C8ECFD - Light tint */
--color-luma: oklch(0.79 0.10 265);        /* #9EBEFA - Mid-tone */
--color-noche: oklch(0.20 0.04 250);       /* #182432 - Near-black */
```

---

## Brand Values (inform tone of UI)

1. **Functional innovation** — Technology that solves real sales and delivery problems
2. **Operational efficiency** — Automation oriented to concrete results: more sales, less friction
3. **Human supervision** — Every process backed by real people for quality and trust
4. **Adaptability** — Solutions designed to integrate with any business
5. **Transparency and reliability** — Clear, measurable, trustworthy processes at every stage

These values should be reflected in the UI: show real data clearly, make actions explicit, always show system status, never hide important information behind extra clicks.

---

## Target Users (inform UI decisions)

- **Primary:** Founders, CMOs, e-commerce heads, growth managers (25–45 years old)
- **Context:** Managing orders, validating payments, monitoring sales — operational work during business hours
- **Needs:** Speed, clarity, confidence that nothing is falling through the cracks
- **Location:** Peru (currently), expanding to Latin America
- **Language:** Spanish (UI), direct and professional tone
