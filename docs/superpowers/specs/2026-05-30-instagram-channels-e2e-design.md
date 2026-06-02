# E2E Tests — Inbox de Instagram y Vista de Canales

**Fecha:** 2026-05-30
**Rama:** `feat/instagram-dm-channel`
**Estado:** Diseño aprobado, listo para plan de implementación

## Contexto

Se acaba de integrar Instagram DMs al messaging multitenant y se introdujo una nueva
vista `/dashboard/channels` que unifica WhatsApp e Instagram. El inbox de conversaciones
ahora muestra el canal de cada conversación, permite filtrar por bandejas agrupadas
por canal, y grava notas de voz en distinto formato según el canal (WAV para Instagram,
opus para WhatsApp).

No existen tests E2E para nada de esto. Los specs actuales (`conversation-search`,
`message-search`, `scroll-to-bottom`, `jump-to-message`, `mobile-search`) cubren solo
flujos de búsqueda contra datos reales del backend.

## Objetivo

Construir una suite E2E con Playwright que detecte regresiones en:

1. La vista `/dashboard/channels` (empty state, conexión, filtros, listado mixto).
2. El filtro multi-select de bandejas en `/dashboard/conversations`.
3. Los badges de canal y nombre de bandeja en cada `ConversationItem`.
4. El flujo de onboarding de Instagram (consent → callback con `?status=...`).
5. La selección de formato de audio (wav vs opus) según canal.
6. El tooltip diferenciado para echoes de agente móvil por canal.
7. Comportamiento responsive en `mobile-chrome` para los flujos críticos de canales.

## Alcance

**Dentro de alcance:**
- Tests E2E con mocks por API para escenarios del feature de canales/Instagram.
- Page Objects nuevos: `ChannelsPage`, `InstagramConsentPage`.
- Refactor de `ConversationsPage` para añadir filtro de bandejas y eliminar
  `waitForTimeout()` (anti-patrón).
- Helpers de mock centralizados en `e2e/fixtures/messaging-mocks.ts`.
- Añadir `data-testid` mínimos en componentes para evitar selectores CSS frágiles.
- Tags `@smoke`, `@critical`, `@contract`, `@mobile`.

**Fuera de alcance:**
- Sidebar y dashboard layout (el usuario lo descartó).
- Flujo OAuth real contra Meta (se simula el callback).
- Tests unitarios o de componente.
- Visual regression snapshots.
- Tests del backend Rails/FastAPI directamente.

## Decisiones de arquitectura

### Estrategia de datos: híbrida

- Specs existentes de búsqueda → siguen contra backend real con seed.
- Specs nuevos del feature → mocks por API con `page.route()`.
- **Razón:** no hay seed data de Instagram en producción/dev consistente, y el OAuth
  de Meta no se puede completar en E2E. Mocks dan determinismo.
- **Mitigación de drift:** spec dedicado `instagram-contract.spec.ts` con tag
  `@contract @nightly` que valida que el shape del mock coincide con la respuesta
  real del backend.

### Estrategia de OAuth: simular el callback

- Test del `/dashboard/instagram-connect/consent`:
  - Verifica que el botón intenta navegar a
    `/api/messaging/instagram/oauth/authorize`.
  - Mockea ese endpoint para devolver una URL de Meta dummy.
  - Verifica que la página intenta hacer `window.location.assign` a esa URL
    (no se completa la navegación a `facebook.com`).
- Test del callback:
  - Visitar `/dashboard/channels?status=success&channel=instagram` directamente.
  - Verificar toast de éxito, limpieza de la query string, y aparición del canal.
  - Idem con `?status=error` para el caso de fallo.

### Estrategia de voice notes: mockear MediaRecorder

- Las notas de voz requieren `getUserMedia` y `MediaRecorder`. En CI no hay micrófono.
- Mockear `navigator.mediaDevices.getUserMedia` y `MediaRecorder` con
  `page.addInitScript()` antes de cargar la app.
- El test no valida el audio real, sólo que:
  - Al iniciar grabación en una conversación de IG, el upload va con `Content-Type`
    `audio/wav` (o el field `format: "wav"` según el contrato del backend).
  - Al hacerlo en una conversación de WA, va con opus.

### Locators

Prioridad estricta según el skill `playwright-best-practices`:

1. `getByRole` con `{ name }`
2. `getByLabel`, `getByPlaceholder`
3. `getByText`
4. `getByTestId` (cuando lo semántico no basta)
5. CSS sólo como último recurso

Se añadirán `data-testid` mínimos en componentes que tienen muchas instancias
similares o que dependen actualmente de selectores CSS frágiles:

- `conversation-item.tsx` → `data-testid="conversation-item"` y
  `data-testid="conversation-channel-meta"`
- `channels-client.tsx` → `data-testid="channel-card-wa"`,
  `data-testid="channel-card-ig"`, `data-testid="filter-pill-{all|wa|ig}"`,
  `data-testid="empty-state"`
- `conversation-filters.tsx` → `data-testid="inbox-filter-trigger"`,
  `data-testid="inbox-filter-option"`

## Inventario de tests

| Spec | Cobertura | Tags |
| --- | --- | --- |
| `channels-view.spec.ts` | Render con 1 canal WA, 1 canal IG, mixto. Header, conteo. | `@smoke` |
| `channels-empty-state.spec.ts` | Sin canales: hero, dos tiles, botones CTA. | `@critical` |
| `channels-filter-pills.spec.ts` | Filter pills aparecen solo si hay ambos canales. Pill `all/wa/ig` filtra el grid. | `@smoke` |
| `channels-connect-dropdown.spec.ts` | Botón "Conectar canal" abre dropdown con WhatsApp e Instagram. Click IG navega a `/dashboard/instagram-connect/consent`. | `@critical` |
| `inbox-filter.spec.ts` | Filtro de bandejas en `/dashboard/conversations`: aparece solo si hay >1 bandeja, agrupado por canal (WA/IG/Otros), master toggle, search, selección parcial, no permite vacío. | `@smoke` |
| `instagram-oauth.spec.ts` | `/dashboard/instagram-connect/consent`: muestra info, botón conectar, intenta navegar a Meta. Callback con `?status=success` muestra toast y limpia URL. `?status=error` muestra toast destructivo. | `@critical` |
| `instagram-inbox-badges.spec.ts` | Lista de conversaciones muestra logo IG para conversaciones de Instagram, logo WA para WhatsApp, label de bandeja sin sufijo de canal. | `@smoke` |
| `echo-tooltip-by-channel.spec.ts` | Mensajes echo de agente móvil: tooltip dice "WhatsApp" o "Instagram" según canal. | normal |
| `voice-notes-format.spec.ts` | Al grabar en IG sube wav, al grabar en WA sube opus. Mockea MediaRecorder. | normal |
| `instagram-contract.spec.ts` | Compara shape del mock vs respuesta real del backend de `/api/messaging/instagram/channels`. | `@contract @nightly` |
| `mobile-channels.spec.ts` | En `mobile-chrome`: layout de `/channels` colapsa a 1 columna, dropdown de bandejas es usable. | `@mobile` |

Total: 11 specs, ~25-30 tests individuales.

## Cambios fuera del directorio e2e

Componentes con cambios mínimos para añadir `data-testid`:

- `apps/frontend/components/conversations/conversation-item.tsx`
- `apps/frontend/components/conversations/conversation-filters.tsx`
- `apps/frontend/app/dashboard/channels/channels-client.tsx`

Estos cambios son aditivos, no funcionales. No alteran clases CSS, eventos ni texto.

## Estructura final

```
apps/frontend/e2e/
├── auth.setup.ts                       # existente
├── fixtures/
│   ├── pages.fixture.ts                # extender con nuevos POMs
│   └── messaging-mocks.ts              # NUEVO
├── pages/
│   ├── conversations.page.ts           # refactor: filtro de bandejas, sin waitForTimeout
│   ├── message-view.page.ts            # existente
│   ├── message-search.page.ts          # existente
│   ├── channels.page.ts                # NUEVO
│   └── instagram-consent.page.ts       # NUEVO
└── specs/
    ├── conversation-search.spec.ts     # existente
    ├── jump-to-message.spec.ts         # existente
    ├── message-search.spec.ts          # existente
    ├── mobile-search.spec.ts           # existente
    ├── scroll-to-bottom.spec.ts        # existente
    ├── channels-view.spec.ts           # NUEVO
    ├── channels-empty-state.spec.ts    # NUEVO
    ├── channels-filter-pills.spec.ts   # NUEVO
    ├── channels-connect-dropdown.spec.ts # NUEVO
    ├── inbox-filter.spec.ts            # NUEVO
    ├── instagram-oauth.spec.ts         # NUEVO
    ├── instagram-inbox-badges.spec.ts  # NUEVO
    ├── echo-tooltip-by-channel.spec.ts # NUEVO
    ├── voice-notes-format.spec.ts      # NUEVO
    ├── instagram-contract.spec.ts      # NUEVO
    └── mobile-channels.spec.ts         # NUEVO
```

`playwright.config.ts` no requiere cambios: ya tiene proyectos `chromium` y
`mobile-chrome`, y `mobile-channels.spec.ts` calza con el patrón `**/mobile-*.spec.ts`
que ya está incluido en `mobile-chrome`.

## Mocking — contrato

Helpers en `e2e/fixtures/messaging-mocks.ts`:

```typescript
mockChannels(page, { wa: WhatsAppChannel[], ig: InstagramChannel[] })
mockEmptyChannels(page)
mockInboxes(page, inboxes: Inbox[])
mockConversations(page, conversations: Conversation[])
mockInstagramAuthorizeUrl(page, redirectUrl: string)
mockMediaRecorder(page, { onUpload: (blob: Blob, contentType: string) => void })
```

Cada helper instala una `page.route()` que devuelve fixtures tipados desde
`lib/types/messaging.ts` para evitar drift de tipos.

## Validación

Después de implementar:

1. `pnpm test:e2e:desktop --grep @smoke` debe pasar verde local.
2. `pnpm test:e2e:desktop --grep @critical` debe pasar verde local.
3. `pnpm test:e2e:mobile --grep @mobile` debe pasar verde local.
4. `pnpm test:e2e:desktop` completo (sin filtro de tags) debe pasar verde, incluyendo
   los tests existentes que NO deben romperse por el refactor de `ConversationsPage`.
5. Los nuevos tests se deben correr 3 veces (`--repeat-each=3`) sin flakiness.
6. `instagram-contract.spec.ts` se ejecuta solo en nightly y requiere backend real
   funcionando con un canal IG seedeado — documentar como prereq.

## Riesgos

- **Refactor de `ConversationsPage` rompe specs existentes.** Mitigación: mantener
  la API pública del POM (`search`, `clearSearch`, etc.). Solo cambiar la
  implementación interna para esperar respuestas en lugar de `setTimeout`.
- **Mock drift sin que nadie lo note.** Mitigación: `instagram-contract.spec.ts`
  + nota en README que indique cuándo re-ejecutarlo.
- **Tests de voice notes son frágiles.** El mock de `MediaRecorder` puede divergir
  del comportamiento real del browser. Mitigación: mantener el test enfocado en
  qué se envía al backend (Content-Type / formato), no en la grabación per se.
- **Datos del backend cambian y los tests de búsqueda fallan.** Riesgo pre-existente,
  fuera de alcance de este PR.

## Prerrequisitos

- Variables de entorno `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` configuradas
  en `.env.test` (ya requeridas por `auth.setup.ts`).
- El backend dev debe estar corriendo (`pnpm dev:backend` o Docker) para los
  specs existentes y para `@contract`.
- Para `@contract`, el tenant del usuario de test debe tener al menos un canal
  de Instagram conectado.
