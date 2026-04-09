# Mintsoft/The Hub Logistics Integration Design

**Date:** 2026-02-17
**Status:** Approved

## Problem

Small-volume clients (<120 orders/month) share a single Mintsoft/The Hub account for logistics. They cannot access The Hub panel directly, so they have no visibility into their order dispatch status, tracking, or courier info. Large clients have dedicated Hub accounts and full visibility.

We need to surface logistics data inside Ventia's dashboard so small clients can see and manage their orders, with the architecture designed to later extend to large clients (Phase 2).

## Key Constraints

- Orders are created in e-commerce (Shopify/WooCommerce), never in Ventia
- Mindsoft handles the Shopify → The Hub sync automatically (external, 100% automatic)
- All small clients share one Mintsoft `ClientId`; differentiation is by SKU prefix in order number (e.g., `ladore-1001`) and item SKUs (e.g., `LADORE_GUANTE`)
- SKU format is always `MARCA_PRODUCTO` (consistent underscore separator)
- Single global API key for the shared Mintsoft account
- Mintsoft auth tokens expire every 24 hours (`POST /api/Auth`)

## Approach: Sync + Cache Local

Ventia maintains a local cache of logistics orders, synchronized via:
1. **Shopify webhook trigger**: When `orders/paid` arrives (already processed), trigger async search in Mintsoft + register ConnectAction webhook
2. **ConnectActions (real-time)**: Mintsoft notifies Ventia of every change per-order
3. **Polling fallback (every 15 min)**: Incremental sync using `SinceLastUpdated` as safety net
4. **On-demand refresh**: When user opens order detail, refresh if data is >5 min old

### Order Linking Flow

```
Shopify confirms order → orders/paid webhook → Ventia processes order
    │
    └── Async task: Search Mintsoft for matching order
        │
        ├── GET /api/Order/Search?OrderNumber={sku_prefix}-{shopify_order_name}
        │   (retry every 30s for ~5 min until found)
        │
        ├── Once found:
        │   ├── Save to logistics_orders (initial state)
        │   ├── Link to Ventia order via order_id FK
        │   └── PUT /api/Order/{id}/ConnectActions → register webhook
        │       callback: https://backend.ventia-latam.com/api/v1/webhooks/mintsoft
        │
        └── ConnectActions notifies every subsequent change in real-time
```

## Data Model

### logistics_config (per tenant)

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| tenant_id | FK → tenants | |
| provider | str | "mintsoft" (extensible) |
| account_type | str | "shared" or "dedicated" |
| api_url | str | Mintsoft API base URL |
| api_key_encrypted | str | Encrypted API credentials |
| sku_prefix | str | e.g., "LADORE" — used to filter orders in shared account |
| shared_client_id | int, nullable | Mintsoft ClientId for shared account |
| sync_enabled | bool | Whether sync is active |
| last_synced_at | datetime | Last successful polling sync |

### logistics_orders (cached Mintsoft orders)

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| tenant_id | FK → tenants | |
| order_id | FK → orders, nullable | Link to Ventia order |
| mintsoft_order_id | int | Mintsoft internal ID (e.g., 256333) |
| mintsoft_order_number | str | e.g., "ladore-1001" |
| status | str | Status name from Mintsoft |
| status_id | int | Mintsoft status ID |
| courier_service | str | Courier name |
| courier_service_id | int | |
| tracking_number | str, nullable | |
| tracking_url | str, nullable | |
| dispatched_at | datetime, nullable | |
| estimated_delivery | datetime, nullable | |
| num_parcels | int | |
| weight | float, nullable | |
| order_data_json | JSON | Full Mintsoft order payload |
| created_at | datetime | |
| updated_at | datetime | |

### logistics_tracking_events (tracking history)

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| logistics_order_id | FK → logistics_orders | |
| event_status | str | e.g., "In Transit", "Delivered" |
| event_description | str | |
| event_date | datetime | |
| location | str, nullable | |
| raw_data_json | JSON | |
| created_at | datetime | |

### Linking logic

Mintsoft order number `ladore-1001` → extract `1001` → match with Shopify order name `#1001` for the same tenant.

## API Endpoints

### Logistics Config (SuperAdmin)

```
POST   /api/v1/tenants/{id}/logistics-config
GET    /api/v1/tenants/{id}/logistics-config
PATCH  /api/v1/tenants/{id}/logistics-config
```

### Logistics Orders (Dashboard)

```
GET    /api/v1/logistics/orders                   — List tenant's logistics orders
GET    /api/v1/logistics/orders/{id}              — Order detail (with on-demand refresh)
GET    /api/v1/logistics/orders/{id}/tracking      — Tracking events history
GET    /api/v1/logistics/orders/{id}/documents     — Dispatch documents
POST   /api/v1/logistics/orders/{id}/cancel        — Cancel order in Mintsoft
POST   /api/v1/logistics/orders/{id}/comments      — Add comment in Mintsoft
GET    /api/v1/logistics/orders/{id}/shipments     — Shipment details
```

### Webhooks

```
POST   /api/v1/webhooks/mintsoft                  — Receive ConnectAction callbacks
```

### Manual Sync (SuperAdmin)

```
POST   /api/v1/tenants/{id}/logistics/sync        — Force manual sync
```

## Backend File Structure

```
apps/backend/app/
├── models/
│   ├── logistics_config.py
│   ├── logistics_order.py
│   └── logistics_tracking_event.py
├── schemas/
│   └── logistics.py
├── repositories/
│   └── logistics.py
├── services/
│   ├── logistics_service.py          — Business logic (sync, link, actions)
│   └── mintsoft_sync_service.py      — Sync logic (polling, webhook registration)
├── integrations/
│   └── mintsoft_client.py            — HTTP client for Mintsoft API
├── api/v1/endpoints/
│   ├── logistics.py                  — Dashboard endpoints
│   └── webhooks_mintsoft.py          — Webhook receiver
└── core/
    └── config.py                     — Add MINTSOFT_* settings
```

## Frontend Structure

```
apps/frontend/app/dashboard/logistics/
├── page.tsx                          — Server component
├── logistics-client.tsx              — Client component (table, filters)
├── [orderId]/
│   ├── page.tsx                      — Detail server component
│   └── logistics-detail-client.tsx   — Detail client component
├── loading.tsx                       — Skeleton
└── error.tsx                         — Error boundary
```

### List View

- Table columns: Order #, Status (colored badge), Courier, Tracking #, Dispatch date, Est. delivery
- Filters: status, date range, search by order number
- Link to original Ventia order (if linked)

### Detail View

- Visual timeline of tracking events
- Courier info + tracking number (with tracking URL link)
- Order items
- Dispatch documents
- Comments
- Actions: cancel, add comment

## Phase 2 (Future)

- Support dedicated Mintsoft accounts (large clients)
- Per-tenant Mintsoft credentials in logistics_config
- WebSocket notifications when logistics status changes
- Logistics metrics in dashboard analytics

## Mintsoft API Reference (Key Endpoints)

- `POST /api/Auth` — Get API token (24h validity)
- `GET /api/Order/List?SinceLastUpdated=X&IncludeOrderItems=true` — Incremental sync
- `GET /api/Order/Search?OrderNumber=X` — Find order by number
- `GET /api/Order/{id}` — Order detail
- `GET /api/Order/{id}/Shipments` — Shipment info
- `GET /api/Order/{id}/Cancel` — Cancel order
- `GET /api/Order/{id}/Comments` — Get comments
- `POST /api/Order/{id}/Comments` — Add comment
- `GET /api/Order/{id}/Documents` — Dispatch documents
- `PUT /api/Order/{id}/ConnectActions` — Register webhook
- `GET /api/Order/Shipments/TrackingEvents/List` — Tracking events
- `GET /api/Order/Statuses` — Status reference data
- `GET /api/Courier/Services` — Courier services reference
