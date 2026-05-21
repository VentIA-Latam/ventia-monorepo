"""
Simula un webhook orders/create de Shopify para validar el flujo de:
- Recepción del webhook (HMAC válido firmado con client_secret real del tenant)
- Auto-vinculación con conversación por phone (try_link_conversation)
- (Opcional) validación del order vía orders/paid para reflejar en conversion-rate

Uso (desde dentro del contenedor backend):
    docker exec ventia-backend uv run python scripts/simulate_shopify_webhook.py \\
        --tenant-id 2 \\
        --phone "+51999888777" \\
        --backend-url http://localhost:8000 \\
        --validate-paid

Salida: muestra status code, body de respuesta, y order_id creado.
Validar luego con queries SQL (ver docs).
"""

import argparse
import base64
import hashlib
import hmac
import json
import sys
import time
import uuid
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.repositories.tenant import tenant_repository


def build_orders_create_payload(
    shopify_order_id: int,
    phone: str,
    customer_email: str = "test+webhook@ventia.lat",
    total_price: str = "100.00",
    currency: str = "PEN",
) -> dict[str, Any]:
    """Construye un payload realista de Shopify orders/create.

    El phone va en shipping_address (prioridad #1 en try_link_conversation).
    """
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S-05:00")
    return {
        "id": shopify_order_id,
        "name": f"#TEST-{shopify_order_id}",
        "email": customer_email,
        "phone": phone,
        "total_price": total_price,
        "currency": currency,
        "financial_status": "pending",
        "fulfillment_status": None,
        "created_at": now_iso,
        "updated_at": now_iso,
        "customer": {
            "id": shopify_order_id * 10,
            "email": customer_email,
            "first_name": "Test",
            "last_name": "Webhook",
            "phone": phone,
        },
        "shipping_address": {
            "first_name": "Test",
            "last_name": "Webhook",
            "phone": phone,
            "address1": "Av. Test 123",
            "city": "Lima",
            "country": "Peru",
            "zip": "15001",
        },
        "billing_address": {
            "first_name": "Test",
            "last_name": "Webhook",
            "phone": phone,
            "address1": "Av. Test 123",
            "city": "Lima",
            "country": "Peru",
            "zip": "15001",
        },
        "line_items": [
            {
                "id": shopify_order_id * 100,
                "title": "Producto de Prueba Webhook",
                "quantity": 1,
                "price": total_price,
                "sku": "TEST-WEBHOOK-001",
            }
        ],
    }


def build_orders_paid_payload(orders_create_payload: dict[str, Any]) -> dict[str, Any]:
    """Convierte un payload de orders/create al equivalente orders/paid (financial_status=paid)."""
    paid = dict(orders_create_payload)
    paid["financial_status"] = "paid"
    paid["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S-05:00")
    return paid


def sign_shopify(body: bytes, client_secret: str) -> str:
    digest = hmac.new(client_secret.encode("utf-8"), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def send_webhook(
    backend_url: str,
    tenant_id: int,
    topic: str,
    payload: dict[str, Any],
    client_secret: str,
) -> httpx.Response:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = sign_shopify(body, client_secret)
    webhook_id = str(uuid.uuid4())
    url = f"{backend_url.rstrip('/')}/api/v1/webhooks/shopify/{tenant_id}"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": signature,
        "X-Shopify-Topic": topic,
        "X-Shopify-Webhook-Id": webhook_id,
        "X-Shopify-Shop-Domain": "test-staging.myshopify.com",
        "X-Shopify-API-Version": "2024-10",
    }
    print(f"\n>>> POST {url}")
    print(f">>> Topic: {topic}, Webhook-Id: {webhook_id}")
    print(f">>> Phone in payload: {payload.get('phone')}")
    with httpx.Client(timeout=30.0) as client:
        return client.post(url, content=body, headers=headers)


def get_tenant_client_secret(db: Session, tenant_id: int) -> str:
    tenant = tenant_repository.get(db, id=tenant_id)
    if not tenant:
        raise SystemExit(f"❌ Tenant {tenant_id} no existe")
    if not tenant.is_active:
        raise SystemExit(f"❌ Tenant {tenant_id} no está activo")
    settings = tenant.get_settings()
    if not settings.ecommerce or not settings.ecommerce.shopify:
        raise SystemExit(f"❌ Tenant {tenant_id} no tiene credenciales Shopify")
    secret = settings.ecommerce.shopify.client_secret
    if not secret:
        raise SystemExit(f"❌ Tenant {tenant_id}: client_secret vacío o no descifrable")
    print(f"✓ Tenant {tenant_id} ({tenant.name}) — client_secret cargado ({len(secret)} chars)")
    return secret


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-id", type=int, required=True)
    parser.add_argument(
        "--phone",
        type=str,
        required=True,
        help="Phone E.164 o local — debe pertenecer a una conversación existente del tenant",
    )
    parser.add_argument(
        "--backend-url",
        type=str,
        default="http://localhost:8000",
        help="URL del backend FastAPI (sin /api/v1)",
    )
    parser.add_argument(
        "--shopify-order-id",
        type=int,
        default=None,
        help="ID de orden Shopify simulada. Default: timestamp",
    )
    parser.add_argument(
        "--validate-paid",
        action="store_true",
        help="También dispara orders/paid para marcar el order como validado",
    )
    parser.add_argument("--email", type=str, default="test+webhook@ventia.lat")
    parser.add_argument("--price", type=str, default="100.00")
    parser.add_argument("--currency", type=str, default="PEN")
    args = parser.parse_args()

    shopify_order_id = args.shopify_order_id or int(time.time())
    print(f"\n=== Simulación webhook Shopify ===")
    print(f"Tenant: {args.tenant_id} | Backend: {args.backend_url}")
    print(f"Shopify Order ID simulado: {shopify_order_id}")

    db = SessionLocal()
    try:
        client_secret = get_tenant_client_secret(db, args.tenant_id)
    finally:
        db.close()

    payload = build_orders_create_payload(
        shopify_order_id=shopify_order_id,
        phone=args.phone,
        customer_email=args.email,
        total_price=args.price,
        currency=args.currency,
    )

    resp = send_webhook(
        backend_url=args.backend_url,
        tenant_id=args.tenant_id,
        topic="orders/create",
        payload=payload,
        client_secret=client_secret,
    )
    print(f"<<< Status: {resp.status_code}")
    print(f"<<< Body: {resp.text}")
    if resp.status_code >= 400:
        sys.exit(1)

    if args.validate_paid:
        time.sleep(1)
        paid_payload = build_orders_paid_payload(payload)
        resp_paid = send_webhook(
            backend_url=args.backend_url,
            tenant_id=args.tenant_id,
            topic="orders/paid",
            payload=paid_payload,
            client_secret=client_secret,
        )
        print(f"<<< Status: {resp_paid.status_code}")
        print(f"<<< Body: {resp_paid.text}")

    print(f"\n✅ Done. Valida en DB con:")
    print(
        f"  SELECT id, shopify_order_id, messaging_conversation_id, validado, validated_at, status "
        f"FROM orders WHERE tenant_id = {args.tenant_id} AND shopify_order_id LIKE '%{shopify_order_id}%';"
    )


if __name__ == "__main__":
    main()
