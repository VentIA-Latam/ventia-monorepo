# Integración de Culqi — Suscripciones SaaS de VentIA

> Documento de mapeo y diseño técnico. Estado: **propuesta** (sin implementar).
> Autor: equipo dev · Fecha: 2026-06-11

## 1. Contexto y objetivo

VentIA muestra planes de pago en su landing (**Start / Pro / Business / Enterprise**) pero
**no tiene forma de cobrarlos**. El checkout actual
(`apps/frontend/components/dashboard/plan/plan-checkout.tsx`) es un *mockup*: solo hace
`setConfirmed(true)`, sin pasarela ni llamada al backend.

Este documento mapea cómo integrar **Culqi** (pasarela de pagos peruana) para que
**VentIA cobre a sus tenants** la suscripción mensual al SaaS, emitiendo además el
comprobante electrónico SUNAT (vía la integración eFact existente).

> ⚠️ **Distinción clave:** esto **NO** es cobrar las órdenes de ecommerce de los clientes
> finales (Shopify/WooCommerce). Es el **billing del propio VentIA**: cobrar a las empresas
> (tenants) por usar la plataforma.

## 2. Decisiones confirmadas

| Tema | Decisión |
|------|----------|
| **Cuenta Culqi** | **Una sola, global de VentIA** (llaves `sk_`/`pk_` en `config.py`). No por tenant. |
| **Moneda** | **PEN** — alinea el cobro Culqi con el comprobante eFact (que es en PEN). Los precios del landing están en USD → requieren definición en PEN (ver §8). |
| **Trial** | **Sin trial**: cobro inmediato. Estados: `active` / `past_due` / `canceled`. |
| **Planes** | **Persistidos en DB** (modelo `Plan`), migrando desde `plan-data.ts`. |
| **Límites del plan** | **Sin enforcement** en esta fase (solo se cobra y se guarda el estado/plan). |
| **Acciones** | Alta + **cambiar plan** + **cancelar** + **cambiar tarjeta**. |
| **Punto de cobro** | **Dashboard del tenant existente** (`dashboard/plan`), reusando `plan-checkout.tsx`. Sin signup público. |
| **eFact** | Cada cobro (alta y renovaciones) **emite comprobante automáticamente**. |
| **Historial de pagos** | Fuera de alcance inicial (pendiente de confirmar si se quiere). |

## 3. Cómo funciona Culqi (datos verificados)

| Aspecto | Detalle |
|---------|---------|
| **URL base** | `https://api.culqi.com/v2` (solo HTTPS) |
| **Llave pública** `pk_test_`/`pk_live_` | Va en el **frontend**. Tokeniza la tarjeta (Culqi.js / Checkout). El token encapsula la tarjeta sin que toque el servidor (PCI DSS). |
| **Llave secreta** `sk_test_`/`sk_live_` | Va en el **backend**. Header `Authorization: Bearer sk_...` |
| **Montos** | Enteros en **céntimos** (S/ 249.00 → `24900`) |
| **3D Secure** | **Culqi3DS** para el reto del banco en la tokenización |

### Endpoints relevantes (rutas exactas del SDK oficial)

| Operación | Método y ruta |
|-----------|---------------|
| Crear plan recurrente | `POST /v2/recurrent/plans/create` |
| Crear cliente | `POST /v2/customers` |
| Crear tarjeta (token + cliente) | `POST /v2/cards` |
| Crear suscripción | `POST /v2/recurrent/subscriptions/create` |
| Actualizar suscripción | `PATCH /v2/recurrent/subscriptions/{id}` |
| Cancelar suscripción | `DELETE /v2/recurrent/subscriptions/{id}` |
| Consultar cargo | `GET /v2/charges/{id}` |

### Cadena de objetos para suscripción

```
1. Plan        POST /recurrent/plans/create   → una vez por cada plan VentIA   → guardar culqi_plan_id
2. Customer    POST /customers                → la empresa (tenant)            → culqi_customer_id
3. Token       (frontend, pk_) Culqi.js       → tokeniza tarjeta               → tkn_xxx
4. Card        POST /cards (token + customer) → asocia tarjeta al cliente      → culqi_card_id
5. Subscription POST /recurrent/subscriptions/create (card_id + plan_id)       → culqi_subscription_id
6. Webhooks    cargo recurrente exitoso/fallido → actualizar estado + emitir eFact
```

## 4. Arquitectura objetivo (mapeo contra el código actual)

La integración sigue los patrones ya establecidos en el backend (Shopify/WooCommerce/eFact).

### Lo que ya existe y se reutiliza

- `components/landing/Plans.tsx` y `components/dashboard/plan/plan-data.ts` — planes
  hardcodeados (Start $99 / Pro $249 / Business $399 / Enterprise $699). Origen de los `Plan` en DB.
- `components/dashboard/plan/plan-checkout.tsx` — **UI de checkout ya construida**
  (captura tarjeta + datos de facturación RUC/razón social/dirección, líneas 124-236),
  pero sin Culqi ni backend.
- `app/integrations/woocommerce_client.py` — patrón de cliente HTTP async con `httpx` y errores tipados.
- `app/services/invoice.py` + `app/integrations/efact_client.py` (`generate_json_ubl`, `send_document`) — emisión eFact.
- `app/models/invoice_serie.py` + `invoice_serie_repository.get_next_correlative` — correlativos thread-safe.
- `app/models/tenant.py` — cifrado de credenciales y datos de emisor (`efact_ruc`, `emisor_*`).
- `lib/api-client` + `lib/services/payment-service.ts` — patrón de servicios frontend con `accessToken`.

### Piezas nuevas / cambios

| Capa | Archivo | Patrón que copia |
|------|---------|------------------|
| Config | `app/core/config.py` (+`CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY`, `CULQI_WEBHOOK_SECRET`, `CULQI_API_BASE`) | bloque `EFACT_*` |
| Cliente HTTP | `app/integrations/culqi_client.py` *(nuevo)* | `woocommerce_client.py` (httpx async, `CulqiError`/`CulqiAuthError`, `Bearer sk_`) |
| Modelo Plan | `app/models/plan.py` *(nuevo)* — `code, name, price_cents, currency, interval, culqi_plan_id, features, is_active` | `Base, TimestampMixin` |
| Modelo Subscription | `app/models/subscription.py` *(nuevo)* — `tenant_id, plan_id, status, culqi_customer_id, culqi_card_id, culqi_subscription_id, current_period_*, card_brand, card_last4, canceled_at` | FK `tenant_id` CASCADE |
| Invoice | `app/models/invoice.py` — `order_id` → **nullable** + nuevo `subscription_id` FK | — |
| Schemas | `app/schemas/plan.py`, `app/schemas/subscription.py` *(nuevos)* | `ConfigDict(from_attributes=True)` |
| Servicio | `app/services/subscription.py` *(nuevo)* | `services/invoice.py` |
| Endpoints | `app/api/v1/endpoints/subscriptions.py` *(nuevo)* + registro en `api.py` + permisos | thin + auth dual |
| eFact suscripción | `app/services/invoice.py` — método `create_subscription_invoice` *(nuevo)* | reusa `generate_json_ubl` + `send_document` |
| Webhook | `app/api/v1/endpoints/webhooks.py` — `POST /webhooks/culqi` (HMAC) | webhooks ecommerce |
| Frontend servicio | `lib/services/subscription-service.ts` *(nuevo)* | `payment-service.ts` |
| Frontend checkout | `components/dashboard/plan/plan-checkout.tsx` — Culqi.js/3DS + POST real | — |
| Frontend gestión | `plan-client.tsx` / `plan-cards.tsx` — plan activo + acciones | — |
| Migración | Alembic: `plans`, `subscriptions`, `invoices.order_id` nullable + `subscription_id` | head actual `f46cfe87e0ef` |

## 5. Punto crítico de diseño: el emisor del comprobante se **invierte**

En el flujo de facturación **actual** (`InvoiceService.create_invoice`), el **emisor es el tenant**
(cada empresa factura a *sus* clientes) y los datos del emisor se derivan de `invoice.tenant_id`.

En el **billing de suscripción es al revés**:

- **Emisor = VentIA** → el tenant con `is_platform = True` (ya existe, sembrado en `scripts/seed.py`).
  Se usan su `efact_ruc`, `name` y `emisor_*` como emisor.
- **Cliente = el tenant que paga** → su RUC / razón social / dirección (capturados en el checkout).
  Como los tenants son empresas (RUC), el comprobante es **Factura (01)**.
- **Serie / correlativo** → una `InvoiceSerie` propia del tenant-plataforma de VentIA
  (p. ej. `F001`), reusando `get_next_correlative` (thread-safe).

Por eso **no** se reutiliza `create_invoice` (acoplado a `Order` y al emisor=tenant), sino un
método dedicado **`create_subscription_invoice(db, subscription, period)`** que:

- arma un **ítem único**: `"Suscripción VentIA – Plan {name} – {periodo}"`;
- calcula `subtotal = total / 1.18`, `igv = total - subtotal` (misma fórmula del servicio actual);
- reusa `generate_json_ubl(...)` + `self.efact_client.send_document(...)` tal cual;
- persiste el `Invoice` con `tenant_id = platform_tenant.id`, `order_id = NULL`,
  `subscription_id = subscription.id`.

El seguimiento de estado eFact reusa el `check_invoice_status` existente.

## 6. Flujo end-to-end

```
Empresa (dashboard/plan) → elige plan → plan-checkout.tsx
  → Culqi.js (pk_) tokeniza tarjeta + 3DS → tkn_xxx
  → POST /subscriptions { plan_code, token, cliente_ruc, razon_social, direccion, email }
     backend (SubscriptionService.create_subscription):
       ensure Customer (Culqi) → create Card (token) → create Subscription (card_id + plan_id)
       → persistir fila `subscriptions` (status=active)
       → guardar datos de facturación en el Tenant
       → create_subscription_invoice → eFact (ticket)
  → respuesta OK → pantalla de confirmación (real) + aviso de comprobante SUNAT

Mensualmente:
  Culqi cobra → Webhook POST /webhooks/culqi (HMAC válido)
    cargo exitoso → status=active, actualizar periodo, emitir comprobante eFact del nuevo periodo
    cargo fallido → status=past_due
```

## 7. Endpoints backend propuestos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/plans` | Lista de planes activos (desde DB) |
| `GET` | `/api/v1/subscriptions/me` | Suscripción del tenant actual |
| `POST` | `/api/v1/subscriptions` | Alta (recibe `token`) |
| `PATCH` | `/api/v1/subscriptions/me` | Cambiar de plan |
| `POST` | `/api/v1/subscriptions/me/card` | Cambiar tarjeta |
| `DELETE` | `/api/v1/subscriptions/me` | Cancelar |
| `POST` | `/api/v1/webhooks/culqi` | Webhook de cargos recurrentes (HMAC) |

Auth dual (`get_current_user_or_api_key`), patrón SUPERADMIN, mapeo de errores
`CulqiError`/`CulqiAuthError` → `ValueError` (igual que el resto del backend).

## 8. Prerrequisitos / setup (fuera de código)

1. **Cuenta Culqi de VentIA** + llaves `sk_`/`pk_` (test y live) + `CULQI_WEBHOOK_SECRET`.
2. **Monto de cada plan en PEN** — decisión de producto (los precios del landing están en USD).
   Se cargan en la tabla `plans` y se crean los Plans en Culqi (`culqi_plan_id`).
3. **Tenant `is_platform = True`** con `efact_ruc` y `emisor_*` completos, y una `InvoiceSerie`
   (Factura `01`, p. ej. `F001`) sembrada para VentIA. Script de seed.
4. Registrar la URL del webhook (`WEBHOOK_BASE_URL` + `/api/v1/webhooks/culqi`) en el panel de Culqi.

## 9. Fases de implementación (resumen)

1. **Fundaciones backend** — config, `culqi_client.py`, modelos `Plan`/`Subscription`,
   migración (incl. `Invoice.order_id` nullable + `subscription_id`), schemas.
2. **Servicio + endpoints** — `subscription.py` (alta/cambio/cancelar/tarjeta) + router + permisos.
3. **Comprobante eFact** — `create_subscription_invoice` (emisor=VentIA, cliente=tenant).
4. **Webhook Culqi** — HMAC + renovación recurrente → estado + eFact.
5. **Frontend** — `subscription-service.ts`, Culqi.js/3DS en `plan-checkout.tsx`, gestión de plan,
   planes desde `GET /plans`, etiquetas USD → PEN.
6. **Seed + verificación** — planes en PEN + serie VentIA; tests (mock culqi/efact); E2E sandbox.

## 10. Verificación

1. **Migración**: `alembic upgrade head` sin errores; tablas `plans`/`subscriptions` y columnas nuevas en `invoices`.
2. **Tests backend** (`uv run pytest`): mock de `culqi_client` y `efact_client`; cubrir alta, cambio de plan,
   cancelación, webhook (firma válida/inválida) y `create_subscription_invoice` (emisor=VentIA, cliente=tenant).
3. **E2E sandbox**: con `sk_test_`/`pk_test_` y tarjetas de prueba → alta desde `dashboard/plan` →
   verificar `culqi_subscription_id`, fila `subscriptions=active` e `Invoice` con `subscription_id` / `order_id=NULL` enviado a eFact.
4. **Webhook**: evento de cargo recurrente firmado → nuevo comprobante eFact + periodo actualizado; fallido → `past_due`.
5. **Frontend**: `pnpm build` + `pnpm lint` OK; el checkout tokeniza y maneja 3DS sin exponer datos de tarjeta al backend.

## 11. Fuera de alcance (futuro)

- Signup público self-service desde el landing (crear tenant + pagar en un flujo).
- Enforcement de límites del plan (conversaciones, SKUs, features) según suscripción/estado.
- Historial de pagos / recibos en el dashboard.
- Órdenes de pago Yape / PagoEfectivo / Cuotéalo.
- Prorrateo fino en upgrades/downgrades.

## 12. Referencias

- Documentación Culqi: https://docs.culqi.com/es/documentacion
- API Reference: https://apidocs.culqi.com/
- SDK Python (rutas de endpoints): https://github.com/culqi/culqi-python
- Suscripciones / Recurrencia: https://docs.culqi.com/es/documentacion/pagos-online/recurrencia/suscripciones/resumen/
