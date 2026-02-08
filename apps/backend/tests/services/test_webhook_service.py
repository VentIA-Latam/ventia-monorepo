"""
Tests for webhook service processing functions.

Tests webhook event processing for Shopify and WooCommerce platforms.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.models.order import Order
from app.models.tenant import Tenant
from app.models.webhook import WebhookEvent
from app.schemas.order import OrderCreate


class TestShopifyDraftOrderCreate:
    """Tests for creating draft orders from Shopify webhooks."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 100
        event.platform = "shopify"
        event.event_type = "draft_orders/create"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def draft_order_payload(self):
        """Sample Shopify draft order payload."""
        return {
            "id": 123456789,
            "name": "#D1001",
            "email": "customer@example.com",
            "customer": {
                "first_name": "John",
                "last_name": "Doe",
                "email": "customer@example.com",
            },
            "total_price": "150.00",
            "currency": "PEN",
            "line_items": [
                {
                    "id": 1,
                    "sku": "SKU123",
                    "title": "Product A",
                    "variant_title": "Red",
                    "quantity": 2,
                    "price": "50.00",
                },
                {
                    "id": 2,
                    "sku": "SKU456",
                    "title": "Product B",
                    "variant_title": None,
                    "quantity": 1,
                    "price": "50.00",
                },
            ],
        }

    def test_create_draft_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, draft_order_payload
    ):
        """Test successfully creating a draft order."""
        from app.services.webhook_service import process_shopify_draft_order_create

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            # Mock the idempotency check to return None (no existing order)
            mock_repo.get_by_shopify_draft_id.return_value = None

            # Mock the create method
            created_order = MagicMock(spec=Order)
            created_order.id = 10
            created_order.tenant_id = 1
            created_order.shopify_draft_order_id = "gid://shopify/DraftOrder/123456789"
            created_order.customer_email = "customer@example.com"
            created_order.customer_name = "John Doe"
            created_order.total_price = 150.0
            created_order.currency = "PEN"
            mock_repo.create.return_value = created_order

            result = process_shopify_draft_order_create(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=draft_order_payload,
                tenant=mock_tenant,
            )

            # Verify order was created
            assert result == created_order
            mock_repo.create.assert_called_once()

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == created_order.id

            # Verify database operations
            mock_db.commit.assert_called()
            mock_db.refresh.assert_called_with(created_order)

    def test_create_draft_order_idempotent(
        self, mock_db, mock_tenant, mock_webhook_event, draft_order_payload
    ):
        """Test idempotency - existing draft order returns without creating."""
        from app.services.webhook_service import process_shopify_draft_order_create

        # Mock an existing order
        existing_order = MagicMock(spec=Order)
        existing_order.id = 10
        existing_order.shopify_draft_order_id = "gid://shopify/DraftOrder/123456789"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = existing_order

            result = process_shopify_draft_order_create(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=draft_order_payload,
                tenant=mock_tenant,
            )

            # Verify existing order was returned
            assert result == existing_order

            # Verify create was NOT called (idempotent)
            mock_repo.create.assert_not_called()

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True

    def test_create_draft_order_missing_id(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing 'id' field raises ValueError."""
        from app.services.webhook_service import process_shopify_draft_order_create

        payload = {"name": "#D1001", "email": "customer@example.com"}  # Missing 'id'

        with pytest.raises(ValueError, match="Missing 'id' field"):
            process_shopify_draft_order_create(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

        # Verify webhook event was marked with error
        assert mock_webhook_event.processed is True
        assert "Missing 'id' field" in mock_webhook_event.error

    def test_create_draft_order_missing_email(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing customer email raises ValueError."""
        from app.services.webhook_service import process_shopify_draft_order_create

        payload = {
            "id": 123456789,
            "name": "#D1001",
            # Missing email in both top-level and customer object
            "customer": {"first_name": "John", "last_name": "Doe"},
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None

            with pytest.raises(ValueError, match="Missing customer email"):
                process_shopify_draft_order_create(
                    db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
                )

            # Verify webhook event was marked with error
            assert mock_webhook_event.processed is True
            assert "Missing customer email" in mock_webhook_event.error

    def test_create_draft_order_with_line_items(
        self, mock_db, mock_tenant, mock_webhook_event, draft_order_payload
    ):
        """Test that line_items are correctly transformed."""
        from app.services.webhook_service import process_shopify_draft_order_create

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None

            created_order = MagicMock(spec=Order)
            created_order.id = 10
            mock_repo.create.return_value = created_order

            process_shopify_draft_order_create(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=draft_order_payload,
                tenant=mock_tenant,
            )

            # Get the OrderCreate object passed to create()
            call_args = mock_repo.create.call_args
            order_create: OrderCreate = call_args.kwargs["obj_in"]

            # Verify line_items were transformed correctly
            assert order_create.line_items is not None
            assert len(order_create.line_items) == 2

            # Check first item (access as attributes, not dict keys)
            # Note: Code uses only title, not title + variant_title
            item1 = order_create.line_items[0]
            assert item1.sku == "SKU123"
            assert item1.product == "Product A"
            assert item1.quantity == 2
            assert item1.unitPrice == 50.0
            assert item1.subtotal == 100.0

            # Check second item (no variant_title)
            item2 = order_create.line_items[1]
            assert item2.sku == "SKU456"
            assert item2.product == "Product B"
            assert item2.quantity == 1
            assert item2.unitPrice == 50.0
            assert item2.subtotal == 50.0

    def test_create_draft_order_database_error(
        self, mock_db, mock_tenant, mock_webhook_event, draft_order_payload
    ):
        """Test that database errors are handled gracefully."""
        from app.services.webhook_service import process_shopify_draft_order_create

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.create.side_effect = Exception("Database error")

            with pytest.raises(Exception, match="Database error"):
                process_shopify_draft_order_create(
                    db=mock_db,
                    webhook_event=mock_webhook_event,
                    payload=draft_order_payload,
                    tenant=mock_tenant,
                )

            # Verify rollback was called
            mock_db.rollback.assert_called_once()

            # Verify webhook event was marked with error
            assert mock_webhook_event.processed is True
            assert "Failed to create order" in mock_webhook_event.error

    def test_database_error_marks_webhook_as_failed(
        self, mock_db, mock_tenant, mock_webhook_event, draft_order_payload
    ):
        """Test that database errors mark webhook event as failed."""
        from app.services.webhook_service import process_shopify_draft_order_create

        # Make order_repository.create raise an exception
        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.create.side_effect = Exception("DB connection lost")

            with pytest.raises(Exception):
                process_shopify_draft_order_create(
                    db=mock_db,
                    webhook_event=mock_webhook_event,
                    payload=draft_order_payload,
                    tenant=mock_tenant,
                )

            # Webhook should be marked as processed with error
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.error is not None
            assert "Failed to create order" in mock_webhook_event.error


class TestShopifyOrdersPaid:
    """Tests for processing orders/paid webhooks from Shopify."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        db.query = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 150
        event.platform = "shopify"
        event.event_type = "orders/paid"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def orders_paid_payload(self):
        """Sample Shopify orders/paid payload."""
        return {
            "id": 987654321,
            "email": "customer@example.com",
            "total_price": "150.00",
            "currency": "USD",
            "financial_status": "paid",
            "payment_gateway_names": ["Shopify Payments"],
        }

    def test_validate_order_by_shopify_order_id(
        self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload
    ):
        """Test validating an order found by shopify_order_id."""
        from app.services.webhook_service import process_shopify_orders_paid

        # Mock an existing order with shopify_order_id
        existing_order = MagicMock(spec=Order)
        existing_order.id = 20
        existing_order.shopify_order_id = "gid://shopify/Order/987654321"
        existing_order.customer_email = "customer@example.com"
        existing_order.total_price = 150.0
        existing_order.validado = False
        existing_order.status = "Pendiente"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_orders_paid(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=orders_paid_payload,
                tenant=mock_tenant,
            )

            # Verify order was validated
            assert result == existing_order
            assert existing_order.validado is True
            assert existing_order.status == "Pagado"
            assert existing_order.shopify_order_id == "gid://shopify/Order/987654321"

            # Verify database operations
            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_validate_order_already_validated_idempotent(
        self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload
    ):
        """Test that validating an already validated order is idempotent."""
        from app.services.webhook_service import process_shopify_orders_paid

        # Mock an order that's already validated
        existing_order = MagicMock(spec=Order)
        existing_order.id = 20
        existing_order.shopify_order_id = "gid://shopify/Order/987654321"
        existing_order.customer_email = "customer@example.com"
        existing_order.total_price = 150.0
        existing_order.validado = True  # Already validated
        existing_order.status = "Pagado"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_orders_paid(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=orders_paid_payload,
                tenant=mock_tenant,
            )

            # Verify order was returned without changes
            assert result == existing_order
            assert existing_order.validado is True

            # Verify flush was NOT called (idempotent)
            mock_db.flush.assert_not_called()
            mock_db.commit.assert_called_once()

    def test_validate_order_not_found_by_id_fallback_search_succeeds(
        self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload
    ):
        """Test fallback search by email + total_price when order not found by ID."""
        from app.services.webhook_service import process_shopify_orders_paid

        # Mock: not found by shopify_order_id
        # But found by email + total fallback search
        existing_order = MagicMock(spec=Order)
        existing_order.id = 20
        existing_order.shopify_order_id = None  # No shopify_order_id set yet
        existing_order.customer_email = "customer@example.com"
        existing_order.total_price = 150.0  # Matches payload
        existing_order.validado = False
        existing_order.status = "Pendiente"
        existing_order.shopify_draft_order_id = "gid://shopify/DraftOrder/111222333"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None  # Not found by ID

            # Mock the fallback query
            mock_query = mock_db.query.return_value
            mock_filter = mock_query.filter.return_value
            mock_order_by = mock_filter.order_by.return_value
            mock_limit = mock_order_by.limit.return_value
            mock_limit.all.return_value = [existing_order]

            result = process_shopify_orders_paid(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=orders_paid_payload,
                tenant=mock_tenant,
            )

            # Verify order was found and validated
            assert result == existing_order
            assert existing_order.validado is True
            assert existing_order.status == "Pagado"
            # Verify shopify_order_id was saved
            assert existing_order.shopify_order_id == "gid://shopify/Order/987654321"

    def test_validate_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload):
        """Test handling when no order is found by ID or fallback search."""
        from app.services.webhook_service import process_shopify_orders_paid

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None

            # Mock fallback search returns no results
            mock_query = mock_db.query.return_value
            mock_filter = mock_query.filter.return_value
            mock_order_by = mock_filter.order_by.return_value
            mock_limit = mock_order_by.limit.return_value
            mock_limit.all.return_value = []

            result = process_shopify_orders_paid(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=orders_paid_payload,
                tenant=mock_tenant,
            )

            # Should return None and log warning
            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()

    def test_validate_order_missing_id(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing 'id' field raises ValueError."""
        from app.services.webhook_service import process_shopify_orders_paid

        payload = {"email": "customer@example.com", "total_price": "150.00"}  # Missing 'id'

        with pytest.raises(ValueError, match="Missing 'id' field"):
            process_shopify_orders_paid(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

        # Verify webhook event was marked with error
        assert mock_webhook_event.processed is True
        assert "Missing 'id' field" in mock_webhook_event.error

    def test_validate_order_fallback_search_wrong_total(
        self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload
    ):
        """Test that fallback search with wrong total_price still uses most recent order."""
        from app.services.webhook_service import process_shopify_orders_paid

        # Mock an order with different total_price
        existing_order = MagicMock()
        existing_order.id = 20
        existing_order.customer_email = "customer@example.com"
        existing_order.total_price = 200.0  # Different from payload (150.0)
        existing_order.validado = False
        existing_order.shopify_order_id = None

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None

            # Mock fallback search returns order with wrong total
            mock_query = mock_db.query.return_value
            mock_filter = mock_query.filter.return_value
            mock_order_by = mock_filter.order_by.return_value
            mock_limit = mock_order_by.limit.return_value
            mock_limit.all.return_value = [existing_order]

            result = process_shopify_orders_paid(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=orders_paid_payload,
                tenant=mock_tenant,
            )

            # Code uses most recent order even if price doesn't match
            assert result == existing_order
            assert existing_order.validado is True
            assert existing_order.status == "Pagado"

    def test_database_error_during_update_marks_webhook_as_failed(
        self, mock_db, mock_tenant, mock_webhook_event, orders_paid_payload
    ):
        """Test that database errors during update mark webhook event as failed."""
        from app.services.webhook_service import process_shopify_orders_paid

        # Mock successful lookup but failing update
        existing_order = MagicMock()
        existing_order.id = 25
        existing_order.validado = False
        existing_order.shopify_order_id = None

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            # Make flush() raise exception to simulate DB error during update
            mock_db.flush.side_effect = Exception("DB connection lost during update")

            with pytest.raises(Exception, match="DB connection lost"):
                process_shopify_orders_paid(
                    db=mock_db,
                    webhook_event=mock_webhook_event,
                    payload=orders_paid_payload,
                    tenant=mock_tenant,
                )

            # Webhook should be marked as processed with error
            assert mock_webhook_event.processed is True
            assert "Failed to update order" in mock_webhook_event.error


class TestWooCommerceOrderCreated:
    """Tests for creating orders from WooCommerce order.created webhooks."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 175
        event.platform = "woocommerce"
        event.event_type = "order.created"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def woo_order_payload(self):
        """Sample WooCommerce order payload."""
        return {
            "id": 789,
            "number": "1001",
            "status": "processing",
            "total": "200.00",
            "currency": "USD",
            "billing": {
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@example.com",
            },
            "line_items": [
                {
                    "id": 10,
                    "sku": "WOO-123",
                    "name": "Widget A",
                    "price": "100.00",
                    "quantity": 2,
                }
            ],
            "payment_method_title": "Credit Card",
        }

    def test_create_woo_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, woo_order_payload
    ):
        """Test successfully creating a WooCommerce order."""
        from app.services.webhook_service import process_woocommerce_order_created

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            # Mock idempotency check
            mock_repo.get_by_woocommerce_order_id.return_value = None

            # Mock create
            created_order = MagicMock(spec=Order)
            created_order.id = 30
            created_order.tenant_id = 1
            created_order.woocommerce_order_id = 789
            created_order.customer_email = "jane@example.com"
            created_order.customer_name = "Jane Smith"
            created_order.total_price = 200.0
            created_order.currency = "USD"
            created_order.status = "Pagado"
            created_order.validado = True
            mock_repo.create.return_value = created_order

            result = process_woocommerce_order_created(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=woo_order_payload,
                tenant=mock_tenant,
            )

            # Verify order was created
            assert result == created_order
            mock_repo.create.assert_called_once()

            # Verify status was mapped (processing → Pagado, True)
            assert created_order.status == "Pagado"
            assert created_order.validado is True

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == created_order.id

    def test_create_woo_order_idempotent(
        self, mock_db, mock_tenant, mock_webhook_event, woo_order_payload
    ):
        """Test idempotency - existing order returns without creating."""
        from app.services.webhook_service import process_woocommerce_order_created

        existing_order = MagicMock(spec=Order)
        existing_order.id = 30
        existing_order.woocommerce_order_id = 789

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_created(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=woo_order_payload,
                tenant=mock_tenant,
            )

            # Verify existing order was returned
            assert result == existing_order

            # Verify create was NOT called
            mock_repo.create.assert_not_called()

    def test_create_woo_order_pending_status(
        self, mock_db, mock_tenant, mock_webhook_event, woo_order_payload
    ):
        """Test that pending status maps to Pendiente, not validated."""
        from app.services.webhook_service import process_woocommerce_order_created

        # Modify payload to have pending status
        woo_order_payload["status"] = "pending"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None

            created_order = MagicMock(spec=Order)
            created_order.id = 30
            mock_repo.create.return_value = created_order

            process_woocommerce_order_created(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=woo_order_payload,
                tenant=mock_tenant,
            )

            # Verify status was mapped (pending → Pendiente, False)
            assert created_order.status == "Pendiente"
            assert created_order.validado is False

    def test_create_woo_order_missing_id(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing 'id' field raises ValueError."""
        from app.services.webhook_service import process_woocommerce_order_created

        payload = {
            "number": "1001",
            "billing": {"email": "customer@example.com"},
        }  # Missing 'id'

        with pytest.raises(ValueError, match="Missing 'id' field"):
            process_woocommerce_order_created(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

    def test_create_woo_order_missing_email(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing billing email raises ValueError."""
        from app.services.webhook_service import process_woocommerce_order_created

        payload = {
            "id": 789,
            "billing": {"first_name": "Jane"},  # Missing email
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None

            with pytest.raises(ValueError, match="Missing customer email"):
                process_woocommerce_order_created(
                    db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
                )

    def test_create_woo_order_with_line_items(
        self, mock_db, mock_tenant, mock_webhook_event, woo_order_payload
    ):
        """Test that line_items are correctly transformed."""
        from app.services.webhook_service import process_woocommerce_order_created

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None

            created_order = MagicMock(spec=Order)
            created_order.id = 30
            mock_repo.create.return_value = created_order

            process_woocommerce_order_created(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=woo_order_payload,
                tenant=mock_tenant,
            )

            # Get the OrderCreate object
            call_args = mock_repo.create.call_args
            order_create: OrderCreate = call_args.kwargs["obj_in"]

            # Verify line_items (access as attributes, not dict keys)
            assert order_create.line_items is not None
            assert len(order_create.line_items) == 1

            item = order_create.line_items[0]
            assert item.sku == "WOO-123"
            assert item.product == "Widget A"
            assert item.quantity == 2
            assert item.unitPrice == 100.0
            assert item.subtotal == 200.0

    def test_database_error_marks_webhook_as_failed(
        self, mock_db, mock_tenant, mock_webhook_event, woo_order_payload
    ):
        """Test that database errors mark webhook event as failed."""
        from app.services.webhook_service import process_woocommerce_order_created

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None
            mock_repo.create.side_effect = Exception("DB error")

            with pytest.raises(Exception):
                process_woocommerce_order_created(
                    db=mock_db,
                    webhook_event=mock_webhook_event,
                    payload=woo_order_payload,
                    tenant=mock_tenant,
                )

            # Webhook should be marked as processed with error
            assert mock_webhook_event.processed is True
            assert "Failed to create order" in mock_webhook_event.error


class TestShopifyDraftOrderUpdate:
    """Tests for updating draft orders from Shopify draft_orders/update events."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 180
        event.platform = "shopify"
        event.event_type = "draft_orders/update"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Create a mock existing order."""
        order = MagicMock(spec=Order)
        order.id = 40
        order.tenant_id = 1
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/555666777"
        order.customer_email = "old@example.com"
        order.customer_name = "Old Name"
        order.total_price = 100.0
        order.currency = "USD"
        order.line_items = []
        order.channel = "shopify"
        order.shipping_address = None
        order.shipping_city = None
        order.shipping_province = None
        order.shipping_country = None
        return order

    @pytest.fixture
    def draft_update_payload(self):
        """Shopify draft order update payload."""
        return {
            "id": 555666777,
            "email": "updated@example.com",
            "customer": {
                "first_name": "Updated",
                "last_name": "Name",
                "email": "updated@example.com",
            },
            "total_price": "250.00",
            "currency": "USD",
            "line_items": [
                {
                    "id": 1,
                    "sku": "NEW-SKU",
                    "title": "New Product",
                    "quantity": 3,
                    "price": "83.33",
                }
            ],
        }

    def test_update_draft_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, draft_update_payload
    ):
        """Test successfully updating a draft order."""
        from app.services.webhook_service import process_shopify_draft_order_update

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = existing_order

            result = process_shopify_draft_order_update(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=draft_update_payload,
                tenant=mock_tenant,
            )

            # Verify order was updated
            assert result == existing_order
            assert existing_order.customer_email == "updated@example.com"
            assert existing_order.customer_name == "Updated Name"
            assert existing_order.total_price == 250.0

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

            # Verify database operations
            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_update_draft_order_idempotent_no_changes(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test update skipped if no changes detected."""
        from app.services.webhook_service import process_shopify_draft_order_update

        # Payload with same data as existing order
        payload = {
            "id": 555666777,
            "email": "old@example.com",
            "customer": {
                "first_name": "Old",
                "last_name": "Name",
                "email": "old@example.com",
            },
            "total_price": "100.00",
            "currency": "USD",
            "line_items": [],
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = existing_order

            result = process_shopify_draft_order_update(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

            # Should return order without updating
            assert result == existing_order
            assert mock_webhook_event.processed is True

            # flush should NOT be called (no changes)
            mock_db.flush.assert_not_called()
            mock_db.commit.assert_called_once()

    def test_update_draft_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, draft_update_payload):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_shopify_draft_order_update

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None

            result = process_shopify_draft_order_update(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=draft_update_payload,
                tenant=mock_tenant,
            )

            # Should return None and log warning
            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()

    def test_update_draft_order_missing_id(self, mock_db, mock_tenant, mock_webhook_event):
        """Test that missing 'id' field raises ValueError."""
        from app.services.webhook_service import process_shopify_draft_order_update

        payload = {"email": "customer@example.com"}  # Missing 'id'

        with pytest.raises(ValueError, match="Missing 'id' field"):
            process_shopify_draft_order_update(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )


class TestShopifyDraftOrderDelete:
    """Tests for deleting draft orders from Shopify draft_orders/delete events."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 190
        event.platform = "shopify"
        event.event_type = "draft_orders/delete"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Create a mock existing order."""
        order = MagicMock(spec=Order)
        order.id = 45
        order.tenant_id = 1
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/777888999"
        order.customer_email = "customer@example.com"
        order.status = "Pendiente"
        order.validado = False
        return order

    @pytest.fixture
    def delete_payload(self):
        """Shopify draft order delete payload."""
        return {"id": 777888999}

    def test_delete_draft_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, delete_payload
    ):
        """Test successfully marking draft order as cancelled."""
        from app.services.webhook_service import process_shopify_draft_order_delete

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = existing_order

            result = process_shopify_draft_order_delete(
                db=mock_db, webhook_event=mock_webhook_event, payload=delete_payload, tenant=mock_tenant
            )

            # Verify order was marked as cancelled
            assert result == existing_order
            assert existing_order.status == "Cancelado"
            assert existing_order.validado is False

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_delete_draft_order_idempotent_already_cancelled(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, delete_payload
    ):
        """Test deletion is idempotent."""
        from app.services.webhook_service import process_shopify_draft_order_delete

        # Order already cancelled
        existing_order.status = "Cancelado"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = existing_order

            result = process_shopify_draft_order_delete(
                db=mock_db, webhook_event=mock_webhook_event, payload=delete_payload, tenant=mock_tenant
            )

            # Should return order without updating
            assert result == existing_order

            # flush should NOT be called (already cancelled)
            mock_db.flush.assert_not_called()
            mock_db.commit.assert_called_once()

    def test_delete_draft_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, delete_payload):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_shopify_draft_order_delete

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None

            result = process_shopify_draft_order_delete(
                db=mock_db, webhook_event=mock_webhook_event, payload=delete_payload, tenant=mock_tenant
            )

            # Should return None and log warning
            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()


class TestShopifyOrderUpdated:
    """Tests for updating complete orders from Shopify orders/updated events."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        db.query = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 200
        event.platform = "shopify"
        event.event_type = "orders/updated"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Create a mock existing order."""
        order = MagicMock(spec=Order)
        order.id = 70
        order.tenant_id = 1
        order.shopify_order_id = "gid://shopify/Order/888777666"
        order.customer_email = "old@example.com"
        order.total_price = 100.0
        order.currency = "USD"
        order.payment_method = None
        order.validado = False
        order.status = "Pendiente"
        order.validated_at = None
        order.channel = "shopify"
        order.shipping_address = None
        order.shipping_city = None
        order.shipping_province = None
        order.shipping_country = None
        return order

    @pytest.fixture
    def order_update_payload(self):
        """Shopify order update payload."""
        return {
            "id": 888777666,
            "email": "updated@example.com",
            "total_price": "350.00",
            "currency": "USD",
            "financial_status": "pending",
            "payment_gateway_names": ["Manual"],
        }

    def test_update_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, order_update_payload
    ):
        """Test successfully updating a complete order."""
        from app.services.webhook_service import process_shopify_order_updated

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=order_update_payload,
                tenant=mock_tenant,
            )

            # Verify order was updated
            assert result == existing_order
            assert existing_order.customer_email == "updated@example.com"
            assert existing_order.total_price == 350.0
            assert existing_order.payment_method == "Manual"

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

            # Verify database operations
            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_update_order_auto_validate_when_paid(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test auto-validation when financial_status=paid."""
        from app.services.webhook_service import process_shopify_order_updated

        payload = {
            "id": 888777666,
            "email": "old@example.com",  # Match existing_order email
            "total_price": "100.00",
            "currency": "USD",
            "financial_status": "paid",
            "payment_gateway_names": ["Shopify Payments"],
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_order_updated(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

            # Verify order was auto-validated
            assert result == existing_order
            assert existing_order.validado is True
            assert existing_order.status == "Pagado"
            assert existing_order.validated_at is not None

    def test_update_order_fallback_search_finds_order(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test fallback search by email + total finds order."""
        from app.services.webhook_service import process_shopify_order_updated

        payload = {
            "id": 999999999,  # Different ID
            "email": "old@example.com",
            "total_price": "100.00",
            "currency": "USD",
        }

        # Mock to ensure order isn't found by ID, but found by fallback
        existing_order.shopify_order_id = None

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None  # Not found by ID

            # Mock the fallback query
            mock_query = mock_db.query.return_value
            mock_filter = mock_query.filter.return_value
            mock_order_by = mock_filter.order_by.return_value
            mock_limit = mock_order_by.limit.return_value
            mock_limit.all.return_value = [existing_order]

            result = process_shopify_order_updated(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

            # Verify order was found and shopify_order_id was set
            assert result == existing_order
            assert existing_order.shopify_order_id == "gid://shopify/Order/999999999"

    def test_update_order_idempotent_no_changes(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test update skipped if no changes detected."""
        from app.services.webhook_service import process_shopify_order_updated

        # Payload with same data as existing order
        payload = {
            "id": 888777666,
            "email": "old@example.com",
            "total_price": "100.00",
            "currency": "USD",
            "financial_status": "pending",
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_order_updated(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

            # Should return order without updating
            assert result == existing_order
            assert mock_webhook_event.processed is True

            # flush should NOT be called (no changes)
            mock_db.flush.assert_not_called()
            mock_db.commit.assert_called_once()

    def test_update_order_not_found(self, mock_db, mock_tenant, mock_webhook_event):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_shopify_order_updated

        payload = {
            "id": 888777666,
            "email": "notfound@example.com",
            "total_price": "100.00",
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None

            # Mock fallback search returns no results
            mock_query = mock_db.query.return_value
            mock_filter = mock_query.filter.return_value
            mock_order_by = mock_filter.order_by.return_value
            mock_limit = mock_order_by.limit.return_value
            mock_limit.all.return_value = []

            result = process_shopify_order_updated(
                db=mock_db, webhook_event=mock_webhook_event, payload=payload, tenant=mock_tenant
            )

            # Should return None and log warning
            assert result is None
            assert "not found" in mock_webhook_event.error.lower()


class TestShopifyOrderCancelled:
    """Tests for cancelling orders from Shopify orders/cancelled events."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self):
        """Create a mock webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 210
        event.platform = "shopify"
        event.event_type = "orders/cancelled"
        event.tenant_id = 1
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Create a mock existing order."""
        order = MagicMock(spec=Order)
        order.id = 75
        order.tenant_id = 1
        order.shopify_order_id = "gid://shopify/Order/999888777"
        order.customer_email = "customer@example.com"
        order.status = "Pagado"
        order.validado = True
        order.notes = None
        return order

    @pytest.fixture
    def cancel_payload(self):
        """Shopify order cancel payload."""
        return {
            "id": 999888777,
            "cancel_reason": "customer",
        }

    def test_cancel_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, cancel_payload
    ):
        """Test successfully cancelling an order."""
        from app.services.webhook_service import process_shopify_order_cancelled

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_order_cancelled(
                db=mock_db, webhook_event=mock_webhook_event, payload=cancel_payload, tenant=mock_tenant
            )

            # Verify order was cancelled
            assert result == existing_order
            assert existing_order.status == "Cancelado"
            assert existing_order.validado is False

            # Verify webhook event was marked as processed
            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_cancel_order_with_cancel_reason(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, cancel_payload
    ):
        """Test cancel_reason stored in notes field."""
        from app.services.webhook_service import process_shopify_order_cancelled

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            process_shopify_order_cancelled(
                db=mock_db, webhook_event=mock_webhook_event, payload=cancel_payload, tenant=mock_tenant
            )

            # Verify cancel_reason was stored in notes
            assert existing_order.notes is not None
            assert "Cancelado: customer" in existing_order.notes

    def test_cancel_order_idempotent_already_cancelled(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, cancel_payload
    ):
        """Test cancellation is idempotent."""
        from app.services.webhook_service import process_shopify_order_cancelled

        # Order already cancelled
        existing_order.status = "Cancelado"

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = existing_order

            result = process_shopify_order_cancelled(
                db=mock_db, webhook_event=mock_webhook_event, payload=cancel_payload, tenant=mock_tenant
            )

            # Should return order without updating
            assert result == existing_order

            # flush should NOT be called (already cancelled)
            mock_db.flush.assert_not_called()
            mock_db.commit.assert_called_once()

    def test_cancel_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, cancel_payload):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_shopify_order_cancelled

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_shopify_order_id.return_value = None

            result = process_shopify_order_cancelled(
                db=mock_db, webhook_event=mock_webhook_event, payload=cancel_payload, tenant=mock_tenant
            )

            # Should return None and log warning
            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()


class TestMapWooStatus:
    """Tests for _map_woo_status() function with updated mappings."""

    def test_map_woo_status_paid_states(self):
        """Test that processing/completed map to Pagado."""
        from app.services.webhook_service import _map_woo_status

        assert _map_woo_status("processing") == ("Pagado", True)
        assert _map_woo_status("completed") == ("Pagado", True)
        assert _map_woo_status("PROCESSING") == ("Pagado", True)  # Case insensitive

    def test_map_woo_status_cancelled_states(self):
        """Test that cancelled/refunded/failed map to Cancelado."""
        from app.services.webhook_service import _map_woo_status

        assert _map_woo_status("cancelled") == ("Cancelado", False)
        assert _map_woo_status("refunded") == ("Cancelado", False)
        assert _map_woo_status("failed") == ("Cancelado", False)
        assert _map_woo_status("CANCELLED") == ("Cancelado", False)  # Case insensitive

    def test_map_woo_status_pending_states(self):
        """Test that pending/on-hold/unknown map to Pendiente."""
        from app.services.webhook_service import _map_woo_status

        assert _map_woo_status("pending") == ("Pendiente", False)
        assert _map_woo_status("on-hold") == ("Pendiente", False)
        assert _map_woo_status("unknown") == ("Pendiente", False)


class TestWooCommerceOrderUpdated:
    """Tests for updating WooCommerce orders from order.updated events."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Mock tenant."""
        tenant = MagicMock()
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self, mock_db):
        """Mock webhook event."""
        event = MagicMock()
        event.id = 100
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Mock existing order."""
        order = MagicMock()
        order.id = 50
        order.tenant_id = 1
        order.woocommerce_order_id = 789
        order.customer_email = "old@example.com"
        order.customer_name = "Old Name"
        order.total_price = 100.0
        order.currency = "USD"
        order.status = "Pendiente"
        order.validado = False
        order.validated_at = None
        order.payment_method = "Credit Card"
        order.channel = "woocommerce"
        order.shipping_address = None
        order.shipping_city = None
        order.shipping_province = None
        order.shipping_country = None
        order.line_items = [
            {
                "sku": "OLD-SKU",
                "product": "Old Product",
                "unitPrice": 100.0,
                "quantity": 1,
                "subtotal": 100.0,
            }
        ]
        return order

    @pytest.fixture
    def order_update_payload(self):
        """WooCommerce order.updated payload."""
        return {
            "id": 789,
            "status": "processing",
            "billing": {
                "first_name": "John",
                "last_name": "Updated",
                "email": "updated@example.com",
            },
            "total": "250.00",
            "currency": "USD",
            "payment_method_title": "PayPal",
            "line_items": [
                {
                    "id": 1,
                    "sku": "SKU123",
                    "name": "New Product",
                    "price": "125.00",
                    "quantity": 2,
                }
            ],
        }

    def test_update_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, order_update_payload
    ):
        """Test successfully updating a WooCommerce order."""
        from app.services.webhook_service import process_woocommerce_order_updated

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=order_update_payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            assert existing_order.customer_email == "updated@example.com"
            assert existing_order.customer_name == "John Updated"
            assert existing_order.total_price == 250.0
            assert existing_order.status == "Pagado"
            assert existing_order.validado is True
            assert existing_order.validated_at is not None
            assert existing_order.payment_method == "PayPal"
            assert len(existing_order.line_items) == 1
            assert existing_order.line_items[0]["sku"] == "SKU123"

            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()
            mock_db.refresh.assert_called_once_with(existing_order)

            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_update_order_status_transition_pending_to_paid(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test status transition from Pendiente to Pagado."""
        from app.services.webhook_service import process_woocommerce_order_updated

        payload = {
            "id": 789,
            "status": "processing",
            "billing": {"email": "old@example.com"},
            "total": "100.00",
            "currency": "USD",
        }

        existing_order.status = "Pendiente"
        existing_order.validado = False
        existing_order.validated_at = None

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            assert existing_order.status == "Pagado"
            assert existing_order.validado is True
            assert existing_order.validated_at is not None

            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_update_order_status_transition_to_cancelled(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test status transition to Cancelado."""
        from app.services.webhook_service import process_woocommerce_order_updated

        payload = {
            "id": 789,
            "status": "cancelled",
            "billing": {"email": "old@example.com"},
            "total": "100.00",
            "currency": "USD",
        }

        existing_order.status = "Pagado"
        existing_order.validado = True

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            assert existing_order.status == "Cancelado"
            assert existing_order.validado is False

            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_update_order_line_items(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test updating line_items triggers update."""
        from app.services.webhook_service import process_woocommerce_order_updated

        payload = {
            "id": 789,
            "status": "pending",
            "billing": {"email": "old@example.com"},
            "total": "100.00",
            "currency": "USD",
            "line_items": [
                {
                    "id": 1,
                    "sku": "NEW-SKU",
                    "name": "New Product",
                    "price": "50.00",
                    "quantity": 2,
                }
            ],
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            assert len(existing_order.line_items) == 1
            assert existing_order.line_items[0]["sku"] == "NEW-SKU"
            assert existing_order.line_items[0]["quantity"] == 2
            assert existing_order.line_items[0]["subtotal"] == 100.0

            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()

    def test_update_order_idempotent_no_changes(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order
    ):
        """Test update skipped if no changes detected."""
        from app.services.webhook_service import process_woocommerce_order_updated

        # Payload matches existing order exactly
        payload = {
            "id": 789,
            "status": "pending",
            "billing": {
                "first_name": "Old",
                "last_name": "Name",
                "email": "old@example.com",
            },
            "total": "100.00",
            "currency": "USD",
            "payment_method_title": "Credit Card",
        }

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            # Verify flush was NOT called (no changes)
            mock_db.flush.assert_not_called()
            # But commit should still be called to mark event as processed
            mock_db.commit.assert_called()

            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_update_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, order_update_payload):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_woocommerce_order_updated

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None

            result = process_woocommerce_order_updated(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=order_update_payload,
                tenant=mock_tenant,
            )

            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()

            mock_db.commit.assert_called()


class TestWooCommerceOrderDeleted:
    """Tests for deleting WooCommerce orders from order.deleted events."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        db.flush = MagicMock()
        db.refresh = MagicMock()
        return db

    @pytest.fixture
    def mock_tenant(self):
        """Mock tenant."""
        tenant = MagicMock()
        tenant.id = 1
        tenant.name = "Test Tenant"
        return tenant

    @pytest.fixture
    def mock_webhook_event(self, mock_db):
        """Mock webhook event."""
        event = MagicMock()
        event.id = 101
        event.processed = False
        event.error = None
        event.order_id = None
        return event

    @pytest.fixture
    def existing_order(self):
        """Mock existing order."""
        order = MagicMock()
        order.id = 51
        order.tenant_id = 1
        order.woocommerce_order_id = 789
        order.status = "Pagado"
        order.validado = True
        return order

    @pytest.fixture
    def delete_payload(self):
        """WooCommerce order.deleted payload."""
        return {"id": 789}

    def test_delete_order_success(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, delete_payload
    ):
        """Test successfully marking order as cancelled."""
        from app.services.webhook_service import process_woocommerce_order_deleted

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_deleted(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=delete_payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            assert existing_order.status == "Cancelado"
            assert existing_order.validado is False

            mock_db.flush.assert_called_once()
            mock_db.commit.assert_called()
            mock_db.refresh.assert_called_once_with(existing_order)

            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_delete_order_idempotent_already_cancelled(
        self, mock_db, mock_tenant, mock_webhook_event, existing_order, delete_payload
    ):
        """Test deletion is idempotent."""
        from app.services.webhook_service import process_woocommerce_order_deleted

        existing_order.status = "Cancelado"
        existing_order.validado = False

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = existing_order

            result = process_woocommerce_order_deleted(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=delete_payload,
                tenant=mock_tenant,
            )

            assert result == existing_order
            # Verify flush was NOT called (already cancelled)
            mock_db.flush.assert_not_called()
            # But commit should still be called to mark event as processed
            mock_db.commit.assert_called()

            assert mock_webhook_event.processed is True
            assert mock_webhook_event.order_id == existing_order.id

    def test_delete_order_not_found(self, mock_db, mock_tenant, mock_webhook_event, delete_payload):
        """Test handling when order doesn't exist."""
        from app.services.webhook_service import process_woocommerce_order_deleted

        with patch("app.services.webhook_service.order_repository") as mock_repo:
            mock_repo.get_by_woocommerce_order_id.return_value = None

            result = process_woocommerce_order_deleted(
                db=mock_db,
                webhook_event=mock_webhook_event,
                payload=delete_payload,
                tenant=mock_tenant,
            )

            assert result is None
            assert mock_webhook_event.processed is True
            assert "not found" in mock_webhook_event.error.lower()

            mock_db.commit.assert_called()
