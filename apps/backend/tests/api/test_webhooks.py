"""
Integration tests for webhook endpoints.

Tests webhook reception, signature validation, and error handling
for both Shopify and WooCommerce platforms using mocks.
"""

import base64
import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.api.deps import get_database
from app.main import app
from app.models.order import Order
from app.models.tenant import Tenant
from app.models.webhook import WebhookEvent
from app.schemas.tenant_settings import (
    EcommerceSettings,
    ShopifyCredentials,
    TenantSettings,
    WooCommerceCredentials,
)


def compute_shopify_hmac(payload: dict, secret: str) -> str:
    """Compute HMAC-SHA256 signature for Shopify webhook."""
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    computed_hmac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256)
    return base64.b64encode(computed_hmac.digest()).decode("utf-8")


def compute_woocommerce_hmac(payload: dict, secret: str) -> str:
    """Compute HMAC-SHA256 signature for WooCommerce webhook."""
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    computed_hmac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256)
    return base64.b64encode(computed_hmac.digest()).decode("utf-8")


class TestShopifyWebhooks:
    """Tests for Shopify webhook endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_shopify_tenant(self) -> Tenant:
        """Create a mock tenant with Shopify credentials."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Shopify Tenant"
        tenant.slug = "test-shopify"
        tenant.is_active = True
        tenant.settings = {
            "ecommerce": {
                "shopify": {
                    "store_url": "https://test-store.myshopify.com",
                    "api_version": "2025-10",
                    "client_secret": "test_client_secret_123",
                }
            }
        }
        tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                shopify=ShopifyCredentials(
                    store_url="https://test-store.myshopify.com",
                    api_version="2025-10",
                    client_secret="test_client_secret_123",
                )
            )
        )
        return tenant

    def test_shopify_webhook_valid_signature(self, client, mock_shopify_tenant, mock_db):
        """Test Shopify webhook with valid signature is accepted."""
        payload = {
            "id": 123456789,
            "name": "#D1001",
            "email": "customer@example.com",
            "total_price": "150.00",
            "currency": "PEN",
        }

        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None  # No existing event

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 1
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock order creation in service
                mock_order_repo.get_by_shopify_draft_id.return_value = None
                created_order = MagicMock(spec=Order)
                created_order.id = 42
                mock_order_repo.create.return_value = created_order

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "draft_orders/create",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True
                assert data["webhook_event_id"] == 1
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_invalid_signature(self, client, mock_shopify_tenant, mock_db):
        """Test Shopify webhook with invalid signature is rejected."""
        payload = {"id": 123456789, "name": "#D1001"}
        invalid_signature = "invalid_signature_base64"

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:

                mock_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None  # No existing event

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 2
                mock_webhook_repo.create.return_value = mock_webhook_event

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": invalid_signature,
                        "X-Shopify-Topic": "draft_orders/create",
                    },
                )

                assert response.status_code == status.HTTP_401_UNAUTHORIZED
                assert "Invalid webhook signature" in response.json()["detail"]
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_missing_hmac_header(self, client, mock_shopify_tenant):
        """Test Shopify webhook without HMAC header is rejected."""
        payload = {"id": 123456789}

        response = client.post(
            f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
            json=payload,
            headers={"X-Shopify-Topic": "draft_orders/create"},
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Missing X-Shopify-Hmac-Sha256 header" in response.json()["detail"]

    def test_shopify_webhook_missing_topic_header(self, client, mock_shopify_tenant):
        """Test Shopify webhook without topic header is rejected."""
        payload = {"id": 123456789}
        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        response = client.post(
            f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
            json=payload,
            headers={"X-Shopify-Hmac-Sha256": signature},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing X-Shopify-Topic header" in response.json()["detail"]

    def test_shopify_webhook_tenant_not_found(self, client):
        """Test Shopify webhook for non-existent tenant is rejected."""
        payload = {"id": 123456789}
        signature = compute_shopify_hmac(payload, "any_secret")

        with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
             patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:
            mock_repo.get.return_value = None
            mock_webhook_repo.get_by_event_id.return_value = None

            response = client.post(
                "/api/v1/webhooks/shopify/999999",
                json=payload,
                headers={
                    "X-Shopify-Hmac-Sha256": signature,
                    "X-Shopify-Topic": "draft_orders/create",
                },
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "not found" in response.json()["detail"]

    def test_shopify_webhook_inactive_tenant(self, client, mock_shopify_tenant):
        """Test Shopify webhook for inactive tenant is rejected."""
        mock_shopify_tenant.is_active = False
        payload = {"id": 123456789}
        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
             patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:
            mock_repo.get.return_value = mock_shopify_tenant
            mock_webhook_repo.get_by_event_id.return_value = None

            response = client.post(
                f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                json=payload,
                headers={
                    "X-Shopify-Hmac-Sha256": signature,
                    "X-Shopify-Topic": "draft_orders/create",
                },
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "not active" in response.json()["detail"]

    def test_shopify_webhook_no_credentials(self, client):
        """Test Shopify webhook for tenant without Shopify credentials is rejected."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.is_active = True
        tenant.settings = {}

        payload = {"id": 123456789}
        signature = compute_shopify_hmac(payload, "any_secret")

        with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
             patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:
            mock_repo.get.return_value = tenant
            mock_webhook_repo.get_by_event_id.return_value = None

            response = client.post(
                f"/api/v1/webhooks/shopify/{tenant.id}",
                json=payload,
                headers={
                    "X-Shopify-Hmac-Sha256": signature,
                    "X-Shopify-Topic": "draft_orders/create",
                },
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "no e-commerce settings" in response.json()["detail"]

    def test_shopify_webhook_idempotency(self, client, mock_shopify_tenant, mock_db):
        """Test that duplicate Shopify webhooks are handled idempotently."""
        payload = {
            "id": 999888777,
            "name": "#D2001",
            "email": "customer@example.com",
        }

        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_shopify_tenant

                # First call - no existing event
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 100
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock order creation in service
                mock_order_repo.get_by_shopify_draft_id.return_value = None
                created_order = MagicMock(spec=Order)
                created_order.id = 42
                mock_order_repo.create.return_value = created_order

                response1 = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "draft_orders/create",
                    },
                )

                assert response1.status_code == status.HTTP_200_OK
                assert response1.json()["success"] is True
                assert "idempotent" not in response1.json()

                # Second call - event already exists (returns before signature check)
                existing_event = MagicMock(spec=WebhookEvent)
                existing_event.id = 100
                existing_event.processed = False
                mock_webhook_repo.get_by_event_id.return_value = existing_event

                response2 = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "draft_orders/create",
                    },
                )

                assert response2.status_code == status.HTTP_200_OK
                data = response2.json()
                assert data["success"] is True
                assert data["message"] == "Event already processed (idempotent)"
                assert data["idempotent"] is True
                assert data["webhook_event_id"] == 100
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_draft_orders_update(self, client, mock_shopify_tenant, mock_db):
        """Test that draft_orders/update webhook properly updates existing order."""
        payload = {
            "id": 123456789,
            "name": "#D1001",
            "email": "updated@example.com",
            "customer": {
                "first_name": "Updated",
                "last_name": "Customer",
                "email": "updated@example.com",
            },
            "total_price": "250.00",
            "currency": "USD",
        }

        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_tenant_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_tenant_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 300
                mock_webhook_event.processed = False
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order to be updated
                existing_order = MagicMock(spec=Order)
                existing_order.id = 99
                existing_order.customer_email = "old@example.com"
                existing_order.total_price = 100.0
                existing_order.currency = "USD"
                existing_order.line_items = []
                mock_order_repo.get_by_shopify_draft_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "draft_orders/update",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True

                # Verify order was updated
                assert existing_order.customer_email == "updated@example.com"
                assert existing_order.customer_name == "Updated Customer"
                assert existing_order.total_price == 250.0
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_draft_orders_delete(self, client, mock_shopify_tenant, mock_db):
        """Test that draft_orders/delete webhook properly cancels existing order."""
        payload = {
            "id": 123456789,
        }

        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_tenant_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_tenant_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 301
                mock_webhook_event.processed = False
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order to be cancelled
                existing_order = MagicMock(spec=Order)
                existing_order.id = 88
                existing_order.status = "Pendiente"
                existing_order.validado = False
                existing_order.shopify_draft_order_id = "gid://shopify/DraftOrder/123456789"
                mock_order_repo.get_by_shopify_draft_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "draft_orders/delete",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True

                # Verify order was cancelled
                assert existing_order.status == "Cancelado"
                assert existing_order.validado is False
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_all_stub_topics(self, client, mock_shopify_tenant, mock_db):
        """Test that all stub topics are handled correctly."""
        stub_topics = [
            "orders/create",
        ]

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            for topic in stub_topics:
                payload = {"id": 111222333, "test_topic": topic}
                signature = compute_shopify_hmac(payload, "test_client_secret_123")

                with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                     patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:

                    mock_repo.get.return_value = mock_shopify_tenant
                    mock_webhook_repo.get_by_event_id.return_value = None

                    mock_webhook_event = MagicMock(spec=WebhookEvent)
                    mock_webhook_event.id = 400
                    mock_webhook_event.processed = False
                    mock_webhook_repo.create.return_value = mock_webhook_event

                    response = client.post(
                        f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                        json=payload,
                        headers={
                            "X-Shopify-Hmac-Sha256": signature,
                            "X-Shopify-Topic": topic,
                        },
                    )

                    assert response.status_code == status.HTTP_200_OK, f"Failed for topic: {topic}"
                    data = response.json()
                    assert data["success"] is True
                    assert "not implemented yet" in data["message"]
                    assert topic in data["message"]
                    assert data["action"] == "ignored"
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_orders_updated(self, client, mock_shopify_tenant, mock_db):
        """Test processing Shopify orders/updated event."""
        payload = {
            "id": 888777666,
            "email": "updated@example.com",
            "total_price": "350.00",
            "currency": "USD",
            "financial_status": "paid",
            "payment_gateway_names": ["Shopify Payments"],
        }
        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 500
                mock_webhook_event.processed = False
                mock_webhook_event.order_id = None
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order
                existing_order = MagicMock(spec=Order)
                existing_order.id = 50
                existing_order.tenant_id = 1
                existing_order.shopify_order_id = "gid://shopify/Order/888777666"
                existing_order.customer_email = "old@example.com"
                existing_order.total_price = 100.0
                existing_order.currency = "USD"
                existing_order.payment_method = None
                existing_order.validado = False
                existing_order.status = "Pendiente"
                existing_order.validated_at = None
                existing_order.notes = None
                mock_order_repo.get_by_shopify_order_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "orders/updated",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True

                # Verify order was updated and auto-validated
                assert existing_order.customer_email == "updated@example.com"
                assert existing_order.total_price == 350.0
                assert existing_order.validado is True
                assert existing_order.status == "Pagado"
                assert existing_order.validated_at is not None
                assert existing_order.payment_method == "Shopify Payments"
        finally:
            app.dependency_overrides.clear()

    def test_shopify_webhook_orders_cancelled(self, client, mock_shopify_tenant, mock_db):
        """Test processing Shopify orders/cancelled event."""
        payload = {
            "id": 888777666,
            "cancel_reason": "customer",
        }
        signature = compute_shopify_hmac(payload, "test_client_secret_123")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_shopify_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 501
                mock_webhook_event.processed = False
                mock_webhook_event.order_id = None
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order
                existing_order = MagicMock(spec=Order)
                existing_order.id = 51
                existing_order.tenant_id = 1
                existing_order.shopify_order_id = "gid://shopify/Order/888777666"
                existing_order.customer_email = "customer@example.com"
                existing_order.total_price = 100.0
                existing_order.currency = "USD"
                existing_order.validado = True
                existing_order.status = "Pagado"
                existing_order.notes = None
                mock_order_repo.get_by_shopify_order_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/shopify/{mock_shopify_tenant.id}",
                    json=payload,
                    headers={
                        "X-Shopify-Hmac-Sha256": signature,
                        "X-Shopify-Topic": "orders/cancelled",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True

                # Verify order was cancelled
                assert existing_order.status == "Cancelado"
                assert existing_order.validado is False
                assert "Cancelado: customer" in existing_order.notes
        finally:
            app.dependency_overrides.clear()


class TestWooCommerceWebhooks:
    """Tests for WooCommerce webhook endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_woocommerce_tenant(self) -> Tenant:
        """Create a mock tenant with WooCommerce credentials."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 2
        tenant.name = "Test WooCommerce Tenant"
        tenant.slug = "test-woocommerce"
        tenant.is_active = True
        tenant.settings = {
            "ecommerce": {
                "woocommerce": {
                    "store_url": "https://test-store.com",
                    "consumer_key": "ck_test_key",
                    "consumer_secret": "cs_test_secret",
                    "webhook_secret": "woo_webhook_secret_456",
                }
            }
        }
        tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                woocommerce=WooCommerceCredentials(
                    store_url="https://test-store.com",
                    consumer_key="ck_test_key",
                    consumer_secret="cs_test_secret",
                    webhook_secret="woo_webhook_secret_456",
                )
            )
        )
        return tenant

    def test_woocommerce_webhook_valid_signature(self, client, mock_woocommerce_tenant, mock_db):
        """Test WooCommerce webhook with valid signature is accepted."""
        payload = {
            "id": 789,
            "number": "1001",
            "status": "processing",
            "total": "200.00",
            "billing": {"email": "customer@example.com"},
        }

        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant
                mock_webhook_repo.get_by_event_id.return_value = None  # No existing event

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 1
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock order creation in service
                mock_order_repo.get_by_woocommerce_order_id.return_value = None
                created_order = MagicMock(spec=Order)
                created_order.id = 1
                mock_order_repo.create.return_value = created_order

                response = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.created",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True
                assert data["webhook_event_id"] == 1
        finally:
            app.dependency_overrides.clear()

    def test_woocommerce_webhook_invalid_signature(self, client, mock_woocommerce_tenant, mock_db):
        """Test WooCommerce webhook with invalid signature is rejected."""
        payload = {"id": 789, "number": "1001"}
        invalid_signature = "invalid_signature"

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant
                mock_webhook_repo.get_by_event_id.return_value = None  # No existing event

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 2
                mock_webhook_repo.create.return_value = mock_webhook_event

                response = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": invalid_signature,
                        "X-WC-Webhook-Topic": "order.created",
                    },
                )

                assert response.status_code == status.HTTP_401_UNAUTHORIZED
                assert "Invalid webhook signature" in response.json()["detail"]
        finally:
            app.dependency_overrides.clear()

    def test_woocommerce_webhook_missing_signature_header(self, client, mock_woocommerce_tenant):
        """Test WooCommerce test delivery (no firma, topic presente) retorna 200.

        WooCommerce envía un test delivery sin firma cada vez que crea un webhook via REST API.
        Es un ping de conectividad que debe ser ACKed sin procesar.
        """
        payload = {"id": 789}

        response = client.post(
            f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
            json=payload,
            headers={"X-WC-Webhook-Topic": "order.created"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Test delivery acknowledged"

    def test_woocommerce_webhook_missing_both_headers(self, client, mock_woocommerce_tenant):
        """Test WooCommerce webhook sin firma ni topic es rechazado."""
        payload = {"id": 789}

        response = client.post(
            f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
            json=payload,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Missing X-WC-Webhook-Signature header" in response.json()["detail"]

    def test_woocommerce_webhook_missing_topic_header(self, client, mock_woocommerce_tenant):
        """Test WooCommerce webhook without topic header is rejected."""
        payload = {"id": 789}
        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        response = client.post(
            f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
            json=payload,
            headers={"X-WC-Webhook-Signature": signature},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing X-WC-Webhook-Topic header" in response.json()["detail"]

    def test_woocommerce_webhook_tenant_not_found(self, client):
        """Test WooCommerce webhook for non-existent tenant is rejected."""
        payload = {"id": 789}
        signature = compute_woocommerce_hmac(payload, "any_secret")

        with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
             patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:
            mock_repo.get.return_value = None
            mock_webhook_repo.get_by_event_id.return_value = None

            response = client.post(
                "/api/v1/webhooks/woocommerce/999999",
                json=payload,
                headers={
                    "X-WC-Webhook-Signature": signature,
                    "X-WC-Webhook-Topic": "order.created",
                },
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "not found" in response.json()["detail"]

    def test_woocommerce_webhook_no_credentials(self, client):
        """Test WooCommerce webhook for tenant without WooCommerce credentials is rejected."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 2
        tenant.is_active = True
        tenant.settings = {
            "ecommerce": {
                "shopify": {
                    "store_url": "https://test-store.myshopify.com",
                    "client_secret": "test_secret",
                }
            }
        }
        tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                shopify=ShopifyCredentials(
                    store_url="https://test-store.myshopify.com",
                    client_secret="test_secret",
                )
            )
        )

        payload = {"id": 789}
        signature = compute_woocommerce_hmac(payload, "any_secret")

        with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
             patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo:
            mock_repo.get.return_value = tenant
            mock_webhook_repo.get_by_event_id.return_value = None

            response = client.post(
                f"/api/v1/webhooks/woocommerce/{tenant.id}",
                json=payload,
                headers={
                    "X-WC-Webhook-Signature": signature,
                    "X-WC-Webhook-Topic": "order.created",
                },
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "no WooCommerce credentials" in response.json()["detail"]

    def test_woocommerce_webhook_idempotency(self, client, mock_woocommerce_tenant, mock_db):
        """Test that duplicate WooCommerce webhooks are handled idempotently."""
        payload = {
            "id": 555444333,
            "number": "2001",
            "status": "processing",
            "billing": {"email": "customer@example.com"},
        }

        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant

                # First call - no existing event
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 200
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock order creation in service
                mock_order_repo.get_by_woocommerce_order_id.return_value = None
                created_order = MagicMock(spec=Order)
                created_order.id = 200
                mock_order_repo.create.return_value = created_order

                response1 = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.created",
                    },
                )

                assert response1.status_code == status.HTTP_200_OK
                assert response1.json()["success"] is True
                assert "idempotent" not in response1.json()

                # Second call - event already exists (returns before signature check)
                existing_event = MagicMock(spec=WebhookEvent)
                existing_event.id = 200
                existing_event.processed = True
                mock_webhook_repo.get_by_event_id.return_value = existing_event

                response2 = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.created",
                    },
                )

                assert response2.status_code == status.HTTP_200_OK
                data = response2.json()
                assert data["success"] is True
                assert data["message"] == "Event already processed (idempotent)"
                assert data["idempotent"] is True
                assert data["webhook_event_id"] == 200
        finally:
            app.dependency_overrides.clear()

    def test_woocommerce_order_created_processing(
        self, client, mock_woocommerce_tenant, mock_db
    ):
        """Test WooCommerce order.created with processing status creates order as Pagado."""
        payload = {
            "id": 999,
            "status": "processing",
            "total": "150.00",
            "currency": "PEN",
            "billing": {
                "email": "customer@example.com",
                "first_name": "Juan",
                "last_name": "Perez",
            },
        }

        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 999
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock order repository
                mock_order_repo.get_by_woocommerce_order_id.return_value = None
                created_order = MagicMock(spec=Order)
                created_order.id = 1
                created_order.status = "Pagado"
                created_order.validado = True
                mock_order_repo.create.return_value = created_order

                response = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.created",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True
                assert data["order_id"] == 1

                # Verify order was created with correct status
                assert created_order.status == "Pagado"
                assert created_order.validado is True
        finally:
            app.dependency_overrides.clear()

    def test_woocommerce_webhook_order_updated(self, client, mock_woocommerce_tenant, mock_db):
        """Test processing WooCommerce order.updated event."""
        payload = {
            "id": 789,
            "status": "processing",
            "billing": {
                "first_name": "John",
                "last_name": "Updated",
                "email": "updated@example.com"
            },
            "total": "250.00",
            "currency": "USD",
            "payment_method_title": "PayPal",
        }
        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 600
                mock_webhook_event.processed = False
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order
                existing_order = MagicMock()
                existing_order.id = 60
                existing_order.woocommerce_order_id = 789
                existing_order.customer_email = "old@example.com"
                existing_order.customer_name = "Old Name"
                existing_order.total_price = 100.0
                existing_order.currency = "USD"
                existing_order.status = "Pendiente"
                existing_order.validado = False
                existing_order.validated_at = None
                existing_order.payment_method = "Credit Card"
                existing_order.line_items = []
                mock_order_repo.get_by_woocommerce_order_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.updated",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True
                assert existing_order.customer_email == "updated@example.com"
                assert existing_order.customer_name == "John Updated"
                assert existing_order.total_price == 250.0
                assert existing_order.status == "Pagado"
                assert existing_order.validado is True
                assert existing_order.validated_at is not None
        finally:
            app.dependency_overrides.clear()

    def test_woocommerce_webhook_order_deleted(self, client, mock_woocommerce_tenant, mock_db):
        """Test processing WooCommerce order.deleted event."""
        payload = {"id": 789}
        signature = compute_woocommerce_hmac(payload, "woo_webhook_secret_456")

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_database] = override_get_db

        try:
            with patch("app.api.v1.endpoints.webhooks.tenant_repository") as mock_repo, \
                 patch("app.api.v1.endpoints.webhooks.webhook_repository") as mock_webhook_repo, \
                 patch("app.services.webhook_service.order_repository") as mock_order_repo:

                mock_repo.get.return_value = mock_woocommerce_tenant
                mock_webhook_repo.get_by_event_id.return_value = None

                mock_webhook_event = MagicMock(spec=WebhookEvent)
                mock_webhook_event.id = 601
                mock_webhook_event.processed = False
                mock_webhook_repo.create.return_value = mock_webhook_event

                # Mock existing order
                existing_order = MagicMock()
                existing_order.id = 61
                existing_order.woocommerce_order_id = 789
                existing_order.status = "Pagado"
                existing_order.validado = True
                mock_order_repo.get_by_woocommerce_order_id.return_value = existing_order

                response = client.post(
                    f"/api/v1/webhooks/woocommerce/{mock_woocommerce_tenant.id}",
                    json=payload,
                    headers={
                        "X-WC-Webhook-Signature": signature,
                        "X-WC-Webhook-Topic": "order.deleted",
                    },
                )

                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True
                assert existing_order.status == "Cancelado"
                assert existing_order.validado is False
        finally:
            app.dependency_overrides.clear()
