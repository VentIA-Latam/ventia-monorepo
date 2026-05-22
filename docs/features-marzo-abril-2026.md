# Funcionalidades entregadas — Marzo y Abril 2026

Resumen de las funcionalidades shippeadas entre el **2026-03-01** y el **2026-04-13**, reconstruido a partir del historial de las ramas `development`, `feat/chatwoot-integration` y `feat/n8n-reminders`.

> **Última actualización**: 2026-04-13

El hito mayor del período es la **integración de WhatsApp vía Chatwoot**, que trajo consigo una suite completa de mensajería (lista de conversaciones, chat en tiempo real, contactos, referidos de Meta Ads, agente IA). En paralelo se cerró el trabajo de **paginación server-side** en todo SuperAdmin, se lanzaron **push notifications (FCM)** para agentes, y se consolidaron **recordatorios n8n** y **generación de reportes**.

---

## 1. Mensajería / Integración WhatsApp (Chatwoot)

### 1.1 Integración WhatsApp Cloud — merge principal
Integración completa de WhatsApp Cloud API basada en la arquitectura de Chatwoot, desplegada como app Rails (`apps/messaging`) con Sidekiq para jobs asíncronos.

Incluye:
- Conexión vía **embedded signup** de Meta (endpoint `whatsapp/embedded_signup`).
- Sincronización de conversaciones y mensajes con PostgreSQL propio, compartido con el backend FastAPI.
- Webhooks de WhatsApp Cloud manejados en Rails, con re-publicación a n8n (incluye `source_id` / `wa_id`).
- Auto-provisioning de cuentas, inbox y labels del sistema al crear un tenant.
- Roles alineados con VentIA (incluye SUPERADMIN).

### 1.2 UX del chat y lista de conversaciones
- **Paginación cursor-based** de mensajes, siguiendo el patrón Chatwoot (`before` / `after`), reemplazando la paginación offset previa.
- **Infinite scroll** en la lista de conversaciones para tenants con alto volumen.
- **Separadores de fecha estilo WhatsApp** dentro del chat.
- **Restauración de scroll** al cargar mensajes antiguos, con `flushSync` para sincronía con el DOM.
- **Búsqueda server-side de conversaciones** por nombre de contacto (2026-04-11).
- Actualización de `last_activity_at` de la conversación en cada mensaje nuevo (patrón Chatwoot).
- **Tracking de `last_activity_at` del contacto** actualizado en cada mensaje entrante para ordenar contactos por actividad reciente (2026-04-12).
- Filtro de rango de fechas con `end date = 23:59:59` para incluir el día completo.

### 1.3 Envío de mensajes enriquecidos
- **Contact messages**: envío de contactos vía API, con burbuja de contacto rediseñada con avatar de iniciales y layout tipo WhatsApp, alineado al mockup de Pencil.
- **CTA URL interactive messages**: botones de acción con URL embebida en los mensajes salientes.
- **Content attributes** pasados correctamente al schema de `SendMessageRequest` para habilitar botones interactivos.

### 1.4 Estado de mensaje y referidos
- Iconos de **estado de mensaje** (enviado / entregado / leído / fallido) renderizados tanto en el hilo de chat como en la lista de conversaciones.
- Extracción de datos de **referral de Meta Ads** desde mensajes de WhatsApp, con preview embebida en la conversación (imagen + body + CTA).

### 1.5 WhatsApp coexistence y manejo de errores
- Manejo de `smb_message_echoes` del modo coexistence de WhatsApp como mensajes outgoing, incluyendo descarga de media.
- **Manejo de mensajes no entregables** (Meta error `131060` — "WhatsApp unavailable"): detección y feedback al agente cuando el destinatario no tiene WhatsApp activo (2026-04-12).

### 1.6 Vista SuperAdmin de conversaciones
- Vista dedicada en SuperAdmin para ver conversaciones de cualquier tenant, con **selector de tenant global** y WebSocket en tiempo real.
- Sub-nav con **tabs de sección**: `Todas`, `Ventas`, `No atendidas`.
- `MessagingProvider` movido al layout de SuperAdmin para mantener contadores en tiempo real desde el sidebar.
- Todos los endpoints de mensajería (labels, templates, canned responses, stage) aceptan override de `tenant_id` para el contexto SuperAdmin.

### 1.7 Agente IA y flujo de venta
- **Auto-toggle del agente IA** cuando se agrega o quita la etiqueta `soporte-humano` sobre una conversación.
- Botón de **reset a pre-sale** cuando la conversación está en etapa de venta, para retomar un flujo.
- **Definiciones de temperatura custom por tenant**, configurables desde el panel.
- **Filtro `ai_agent_enabled`** en el endpoint de conversaciones para separar las conversaciones gestionadas por IA.
- **Tracking del usuario emisor** para mensajes enviados por agentes humanos (queda registro de quién respondió).

---

## 2. Notificaciones push (FCM)

Sistema completo de push notifications para que los agentes de mensajería reciban alertas fuera de la app.

- **Firebase Cloud Messaging** integrado en frontend (Next.js) y backend.
- Service Worker `firebase-messaging-sw.js` con config hardcoded para compatibilidad con Chrome desktop, y `manifest.json` con `gcm_sender_id` para Chrome Android.
- Payload **data-only** para evitar notificaciones duplicadas entre FCM y el propio SW.
- Deep link al hacer click en la notificación, leído desde `data.click_action`.
- Migración idempotente de `push_subscription_tokens`, con `account_id` indexado.
- Registro de token FCM por usuario, usando el `ventia_user_id` correcto (no el de Rails) para compatibilidad con la app Rails de mensajería.

### 2.1 Dialog de preferencias de notificación
- Modal **"Configuración de notificaciones"** con preferencias push por usuario (canales, tipos de evento), fetched on-open para tener siempre el estado actualizado.

---

## 3. Panel SuperAdmin — tablas y filtros

### 3.1 Hook `useServerTable`
Hook compartido que centraliza el patrón `debounce + keepPreviousData + search + status + channel filter` para tablas con paginación server-side. Adoptado en:
- Dashboard orders e invoices
- SuperAdmin orders, invoices, users, api-keys, invoice-series

Incluye `isStale` UI para indicar cuando los datos están refetcheando, reset de filtros, y estabilidad de dependencias para evitar re-renders innecesarios.

### 3.2 Paginación y filtros server-side
- Todas las páginas de SuperAdmin migradas a **paginación server-side**.
- Filtros **`search`, `status`, `channel`** implementados en todos los endpoints de backend (orders, invoices, series, users, api keys).
- Consolidación de API proxy routes duplicadas en un endpoint único por recurso.
- Eliminación del legacy `from_orm` / `model_validate`.

### 3.3 Selector global de tenant
- **Tenant selector** en el sidebar de SuperAdmin con contexto compartido. Todas las páginas (users, api-keys, invoices-series, orders, invoices, conversaciones) leen el tenant activo del contexto.
- Columna "Tenant" se muestra condicionalmente solo cuando no hay tenant seleccionado.

### 3.4 Loading skeletons
- Skeletons de carga para todas las páginas SuperAdmin, reemplazando flash de empty-state.

### 3.5 Alineación de diseño
- Todas las páginas SuperAdmin alineadas al patrón estándar **page header → filters → table → pagination**.
- Vista de invoices refactorizada para reusar el mismo patrón de orders.

---

## 4. Recordatorios (n8n reminders)

Feature para programar recordatorios automáticos hacia los clientes, disparados desde workflows n8n.

- Sección de **recordatorios** en el editor de mensajes de temperatura n8n.
- Migración Alembic para la tabla de reminders.
- Merge de heads Alembic (messaging + reminders) para mantener un solo head lineal.
- Link a **Recordatorios** en el sidebar del dashboard.
- Doc de diseño: `docs/design-n8n-reminders.md`.

---

## 5. Generación de reportes

- Feature de **report generation** (PR #75) entregado tras revertir un intento previo (PR #73). Permite exportar reportes del estado de órdenes / facturación.

---

## 6. Órdenes y ecommerce (Shopify)

- **Creación automática de la orden en ecommerce** al validar el pago en VentIA para órdenes nativas (las que nacen en VentIA, no en Shopify). Llama a `draftOrderComplete` de Shopify GraphQL.
- Soporte de **`variantId`** en los line items al crear órdenes de Shopify, para productos con variantes.
- Default de `lastName = "."` cuando el cliente tiene un solo nombre, para pasar la validación de Shopify.
- Endpoint **`mark-payment-review`** para marcar órdenes en revisión de pago, con auth dual (JWT + API key).
- Endpoint `escalate` migrado a `require_permission_dual`.

---

## 7. Infraestructura y DevOps

### 7.1 CI/CD — GitHub Actions deploy
- Workflow de **deploy híbrido del backend** por GitHub Actions: push a GHCR, pull en VM, `docker compose up -d` con `--no-deps` para no recrear dependencias.
- Login a Docker en la VM antes del pull.
- Migración a `docker compose` v2 en el workflow.

### 7.2 Staging VM para AI agents
- **Setup Docker de staging** para el equipo de AI agents, con env vars completas de Auth0 runtime, Firebase admin, WhatsApp embedded signup y Sidekiq.

### 7.3 Permisos y autenticación dual
- Todos los endpoints de mensajería migrados a **`require_permission_dual`** para soportar llamadas con API key además de JWT, habilitando integraciones externas (n8n).

---

## 8. Landing y branding

- Nuevos **logos de marca** agregados a la landing page.
- **Style guide** de VentIA publicado en `docs/style-guide.md`, con manual de marca incluido, para unificar el diseño del frontend (tokens `volt`, `aqua`, `cielo`, `marino`, `noche`).

---

## 9. Bug fixes relevantes

Correcciones notables que afectaron estabilidad o UX, agrupadas por área.

### Mensajería / Chat
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-04-07 | `d644c47`, `026a0c4`, `d4a6b2f`, `b1511e3`, `10ce4d8` | Scroll bounce y duplicación de mensajes al cargar historial antiguo (múltiples iteraciones de fix). |
| 2026-04-08 | `1512383`, `0697581`, `d573e76`, `c17057b` | Paginación stale por closure, auto-trigger cascade, layout shift por `content-visibility`, scroll restore síncrono. |
| 2026-04-08 | `c59fdbe` | Filtro de fecha no incluía el día completo (faltaba `23:59:59` en end date). |
| 2026-04-08 | `b83cc09` | `last_activity_at` de conversación no se actualizaba con mensajes nuevos. |
| 2026-04-10 | `204c9b8`, `7b605fe`, `5b4f978`, `8003d28` | Ancho de burbuja de referral desbordaba el contenedor de mensajes (múltiples iteraciones). |
| 2026-04-11 | `4e82366`, `5fc8baf` | Alineación de bordes de burbuja de referral y límite de altura de imagen. |

### SuperAdmin / Panel
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-04-08 | `841b63c`, `423facf`, `f8b4213`, `bdbb00f`, `b0fe1f8` | `tenant_id` no se propagaba correctamente en múltiples endpoints de mensajería al operar como superadmin. |
| 2026-04-08 | `76ebb23` | WebSocket intentaba fetch de token sin tenant seleccionado, causando error. |
| 2026-04-08 | `1228c2b` | Labels del sistema no se auto-creaban al provisionar una cuenta nueva. |
| 2026-04-11 | `5021a6a` | Tabla de órdenes overflow con emails largos. |
| 2026-04-12 | `6e3f192`, `d553460` | Datos de SuperAdmin no se refrescaban ni reseteaban filtros al cambiar de tenant. |

### Push notifications (FCM)
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-03-24 | `4fa2dd9`, `30a9b58`, `2400ae7` | Notificaciones duplicadas por conflicto entre payload FCM y Service Worker. Se migró a data-only payload. |
| 2026-03-24 | `e10b7ab`, `65aa67e`, `aca77b9` | Incompatibilidades del SW con Chrome Android vs Chrome desktop. Se pasó a archivo estático con config hardcoded. |
| 2026-03-24 | `b45652c` | `deleteToken` en remount invalidaba tokens desktop al cambiar de pestaña. |
| 2026-04-10 | `e3101d3`, `bbc97f2` | Token FCM se registraba con user_id incorrecto (Rails vs VentIA). |
| 2026-04-10 | `71548b8` | Notification settings no se fetcheaban al abrir el dialog. |

### UI / Diseño
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-03-31 | `846f113`, `047dc24`, `9155a3b`, `9a8f819` | Mensajes largos y attachments desbordaban la burbuja y el layout de conversaciones. |
| 2026-03-31 | `d722c8a`, `c6b0565` | Panel de info de contacto empujaba el layout en vez de ser overlay. |
| 2026-04-01 | `6556ab2`, `d5b5ab2`, `632b947` | Colores de burbuja de contacto no coincidían con mockup Pencil (múltiples iteraciones). |
| 2026-04-02 | `7cc3f3b`, `e9730c5` | Contraste insuficiente en botón CTA sobre burbuja outgoing. |
| 2026-04-08 | `350da3f`, `131dbf5`, `6023e22` | Badges de temperatura mostraban hover azul incorrecto. |
| 2026-04-08 | `bec1c94`, `3d5ae81` | Texto blanco ilegible en botones destructive (faltaba `--color-destructive-foreground`). |
| 2026-04-10 | `77c82f2` | Dropdown de select sin altura máxima, desbordaba la pantalla. |

### Backend / Infra
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 2026-04-07 | `7c9b9e4` | Excepción no capturada en generación inicial de token Shopify causaba crash. |
| 2026-04-07 | `bc2fdbd` | Endpoints de mensajería no soportaban API key (solo JWT), bloqueando integraciones n8n. |
| 2026-04-10 | `94b34bd`, `e0a2821` | Import de módulo `chatwoot` inexistente crasheaba el backend al iniciar. |
| 2026-04-09 | `a7124b1` | Alembic con dos heads tras merge de migrations de messaging + reminders. |
| 2026-03-24 | `a70f46a`, `4a08921` | n8n workflow update fallaba con 400 por propiedades no aceptadas en settings. |

---

## Anexo — Referencias de branches y PRs relevantes

| Fecha       | Merge / Commit                                | Tema                                      |
|-------------|-----------------------------------------------|-------------------------------------------|
| 2026-03-02  | `eefcde6`                                     | Creación de orden ecommerce en validación |
| 2026-03-06  | PR #75                                        | Report generation                         |
| 2026-03-13  | PR #76                                        | Logos de marca en landing                 |
| 2026-03-19  | PR #80 `feat/n8n-reminders`                   | Recordatorios n8n                         |
| 2026-03-19  | `f3acb93`                                     | Workflow CI/CD backend                    |
| 2026-03-23  | `3e19929`                                     | FCM push notifications                    |
| 2026-03-25  | `a97a8f7`, `e151622`, `fe8eb7f`               | SuperAdmin: selector global + SSR pagination |
| 2026-03-26  | `0b85439`, `7aae963`                          | `useServerTable` + filtros server-side    |
| 2026-03-27  | `ae19c0e`                                     | SuperAdmin conversaciones + WebSocket     |
| 2026-03-29  | `189c723`                                     | Mensajería: sync + auto-provisioning      |
| 2026-03-31  | `81d8461`, `8843f3f`                          | Paginación cursor-based + infinite scroll |
| 2026-04-01  | `ea043ae`, `74e6ed6` (04-02)                  | Contact messages + CTA URL interactivos   |
| 2026-04-08  | `839642d`, `dd48c42`, `f2424c7`, `04e7567`    | Referrals Meta Ads, status icons, IA auto-toggle, temperature custom |
| 2026-04-09  | `bdbf8b` (merge `feat/chatwoot-integration`)  | **WhatsApp messaging integration**        |
| 2026-04-10  | `fa72f12`                                     | Preview de ad referral en conversación    |
| 2026-04-11  | `aefedca`                                     | Búsqueda server-side de conversaciones por contacto |
| 2026-04-12  | `f4b8482`                                     | Tracking de `last_activity_at` del contacto |
| 2026-04-12  | `73dca58`                                     | Manejo de WhatsApp unavailable (Meta error 131060) |
| 2026-04-12  | `6e3f192`, `d553460`                          | Fix: refresh datos y reset filtros al cambiar tenant en SuperAdmin |
