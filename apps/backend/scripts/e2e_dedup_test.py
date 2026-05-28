"""
E2E test: deduplicación de pedidos Shopify sin email del cliente.

Simula el flujo completo de una compra sin email:
  1. draft_orders/create  → crea la orden con placeholder email
  2. draft_orders/update  → enlaza shopify_order_id (campo order_id del payload)
  3. orders/create        → debe ACTUALIZAR la orden, no crear duplicado

Al final verifica en BD que existe exactamente 1 fila para ese shopify_order_id.

Uso:
    uv run python scripts/e2e_dedup_test.py --tenant-id 2 --backend-url http://localhost:8000
"""

import argparse
import base64
import hashlib
import hmac
import json
import sys
import time
import uuid

import httpx
from sqlalchemy import text

from app.core.database import SessionLocal
from app.repositories.tenant import tenant_repository


# ──────────────────────────────────────────────
# Payload builders
# ──────────────────────────────────────────────

def build_draft_create(draft_id: int, total: str = "150.00") -> dict:
    """draft_orders/create sin email — simula pedido WhatsApp sin datos del cliente."""
    return {
        "id": draft_id,
        "name": f"#D-E2E-{draft_id}",
        "total_price": total,
        "currency": "PEN",
        "order_id": None,  # null al crearse
        "line_items": [
            {
                "id": draft_id * 10,
                "sku": "E2E-SKU-001",
                "title": "Producto E2E",
                "quantity": 2,
                "price": "75.00",
            }
        ],
        "shipping_address": {
            "first_name": "E2E",
            "last_name": "Test",
            "address1": "Av. E2E 123",
            "city": "Lima",
            "country": "Peru",
        },
    }


def build_draft_update(draft_id: int, order_id: int, total: str = "150.00") -> dict:
    """draft_orders/update con order_id poblado — el draft fue completado."""
    payload = build_draft_create(draft_id, total)
    payload["order_id"] = order_id  # ← campo clave del fix
    return payload


def build_orders_create(order_id: int, total: str = "150.00") -> dict:
    """orders/create sin email — mismo total y productos que el draft."""
    return {
        "id": order_id,
        "name": f"#ORD-E2E-{order_id}",
        "total_price": total,
        "currency": "PEN",
        "financial_status": "pending",
        "line_items": [
            {
                "id": order_id * 10,
                "sku": "E2E-SKU-001",
                "title": "Producto E2E",
                "quantity": 2,
                "price": "75.00",
            }
        ],
    }


# ──────────────────────────────────────────────
# HTTP helpers
# ──────────────────────────────────────────────

def sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def send(backend_url: str, tenant_id: int, topic: str, payload: dict, secret: str) -> httpx.Response:
    body = json.dumps(payload, separators=(",", ":")).encode()
    url = f"{backend_url.rstrip('/')}/api/v1/webhooks/shopify/{tenant_id}"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": sign(body, secret),
        "X-Shopify-Topic": topic,
        "X-Shopify-Webhook-Id": str(uuid.uuid4()),
        "X-Shopify-Shop-Domain": "e2e-test.myshopify.com",
        "X-Shopify-API-Version": "2024-10",
    }
    print(f"\n  → POST {topic}")
    resp = httpx.post(url, content=body, headers=headers, timeout=30)
    status = "✓" if resp.status_code < 400 else "✗"
    print(f"  {status} {resp.status_code}: {resp.text[:120]}")
    return resp


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-id", type=int, default=2)
    parser.add_argument("--backend-url", type=str, default="http://localhost:8000")
    args = parser.parse_args()

    # IDs únicos para este run
    ts = int(time.time())
    draft_id = ts
    order_id = ts + 1  # distinto del draft — simula IDs reales de Shopify

    print(f"\n{'='*55}")
    print(f"  E2E — Deduplicación Shopify sin email")
    print(f"  Tenant: {args.tenant_id} | Backend: {args.backend_url}")
    print(f"  draft_id={draft_id}  order_id={order_id}")
    print(f"{'='*55}")

    # Obtener client_secret del tenant
    db = SessionLocal()
    try:
        tenant = tenant_repository.get(db, id=args.tenant_id)
        if not tenant:
            sys.exit(f"✗ Tenant {args.tenant_id} no existe")
        try:
            secret = tenant.get_settings().ecommerce.shopify.client_secret or ""
        except Exception:
            secret = ""
        if secret:
            print(f"\n  ✓ client_secret cargado ({len(secret)} chars)")
        else:
            print(f"\n  ⚠ client_secret vacío — usando SKIP_WEBHOOK_HMAC=true (solo dev)")
            secret = "dev-bypass"
    finally:
        db.close()

    # ── Paso 1: draft_orders/create (sin email) ──
    print(f"\n[1/3] draft_orders/create (sin email)")
    r1 = send(args.backend_url, args.tenant_id, "draft_orders/create",
              build_draft_create(draft_id), secret)
    if r1.status_code >= 400:
        sys.exit("✗ Falló paso 1")
    time.sleep(0.5)

    # ── Paso 2: draft_orders/update (con order_id) ──
    print(f"\n[2/3] draft_orders/update (con order_id={order_id})")
    r2 = send(args.backend_url, args.tenant_id, "draft_orders/update",
              build_draft_update(draft_id, order_id), secret)
    if r2.status_code >= 400:
        sys.exit("✗ Falló paso 2")
    time.sleep(0.5)

    # ── Paso 3: orders/create (sin email) ──
    print(f"\n[3/3] orders/create (sin email, mismo orden)")
    r3 = send(args.backend_url, args.tenant_id, "orders/create",
              build_orders_create(order_id), secret)
    if r3.status_code >= 400:
        sys.exit("✗ Falló paso 3")

    # ── Verificación en BD ──
    print(f"\n{'='*55}")
    print(f"  VERIFICACIÓN EN BD")
    print(f"{'='*55}")

    db = SessionLocal()
    try:
        gid_draft  = f"gid://shopify/DraftOrder/{draft_id}"
        gid_order  = f"gid://shopify/Order/{order_id}"

        rows = db.execute(text("""
            SELECT id, shopify_draft_order_id, shopify_order_id,
                   customer_email, status, validado
            FROM orders
            WHERE tenant_id = :tid
              AND (shopify_draft_order_id = :did OR shopify_order_id = :oid)
        """), {"tid": args.tenant_id, "did": gid_draft, "oid": gid_order}).fetchall()

        print(f"\n  Filas encontradas: {len(rows)}")
        for row in rows:
            print(f"\n  id              : {row.id}")
            print(f"  draft_order_id  : {row.shopify_draft_order_id}")
            print(f"  shopify_order_id: {row.shopify_order_id}")
            print(f"  email           : {row.customer_email}")
            print(f"  status          : {row.status}")
            print(f"  validado        : {row.validado}")

        print(f"\n{'='*55}")
        if len(rows) == 1:
            row = rows[0]
            checks = [
                (row.shopify_draft_order_id == gid_draft, "draft_order_id enlazado"),
                (row.shopify_order_id == gid_order,       "shopify_order_id enlazado"),
                ("no-email" in (row.customer_email or ""), "placeholder email"),
            ]
            for ok, label in checks:
                print(f"  {'✓' if ok else '✗'} {label}")
            print(f"\n  ✅ PASS — 1 sola fila, sin duplicado")
        else:
            print(f"  ❌ FAIL — se esperaba 1 fila, se encontraron {len(rows)}")
            sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
