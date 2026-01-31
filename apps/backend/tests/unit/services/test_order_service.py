"""
US-002: Tests de Deteccion de Ordenes Duplicadas

Tests for OrderService duplicate detection and line item calculations.
"""

import pytest
from unittest.mock import MagicMock, patch

from app.services.order import OrderService
from app.schemas.order import OrderCreate, LineItemBase


class TestOrderServiceDuplicateDetection:
    """Tests for duplicate order detection in OrderService.create_order()."""

    @pytest.fixture
    def order_service(self) -> OrderService:
        """Create OrderService instance."""
        return OrderService()

    @pytest.fixture
    def valid_order_create(self) -> OrderCreate:
        """Create a valid OrderCreate schema."""
        return OrderCreate(
            customer_email="cliente@example.com",
            customer_name="Juan Perez",
            customer_document_type="1",
            customer_document_number="12345678",
            shopify_draft_order_id="gid://shopify/DraftOrder/123456",
            line_items=[
                LineItemBase(
                    sku="PROD001",
                    product="Producto Test",
                    unitPrice=100.00,
                    quantity=1,
                )
            ],
            currency="PEN",
        )

    @pytest.fixture
    def valid_woo_order_create(self) -> OrderCreate:
        """Create a valid OrderCreate schema for WooCommerce."""
        return OrderCreate(
            customer_email="cliente@example.com",
            customer_name="Juan Perez",
            customer_document_type="1",
            customer_document_number="12345678",
            woocommerce_order_id=789,
            line_items=[
                LineItemBase(
                    sku="PROD001",
                    product="Producto Test",
                    unitPrice=100.00,
                    quantity=1,
                )
            ],
            currency="PEN",
        )

    # ========================================
    # Shopify Duplicate Detection
    # ========================================

    def test_duplicate_shopify_order_same_tenant_raises_error(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: Create order with existing shopify_draft_order_id for same tenant fails."""
        with patch("app.services.order.order_repository") as mock_repo:
            # Simulate existing order found
            mock_repo.get_by_shopify_draft_id.return_value = MagicMock(id=1)

            with pytest.raises(ValueError) as exc_info:
                order_service.create_order(
                    db=mock_db,
                    order_in=valid_order_create,
                    tenant_id=1,
                )

            error_msg = str(exc_info.value)
            assert "already exists" in error_msg
            assert "Shopify" in error_msg
            assert valid_order_create.shopify_draft_order_id in error_msg

    def test_new_shopify_order_same_tenant_succeeds(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: Create order with new shopify_draft_order_id succeeds."""
        with patch("app.services.order.order_repository") as mock_repo:
            # No existing order found
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            # Mock create to return an order
            mock_order = MagicMock()
            mock_order.id = 1
            mock_order.total_price = 100.00
            mock_repo.create.return_value = mock_order

            result = order_service.create_order(
                db=mock_db,
                order_in=valid_order_create,
                tenant_id=1,
            )

            assert result.id == 1
            mock_repo.create.assert_called_once()

    def test_same_shopify_id_different_tenant_allowed(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: Same shopify_draft_order_id for different tenants is allowed (multitenancy)."""
        with patch("app.services.order.order_repository") as mock_repo:
            # No existing order for tenant 2 (even though tenant 1 has one)
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            mock_order = MagicMock()
            mock_order.id = 2
            mock_order.total_price = 100.00
            mock_repo.create.return_value = mock_order

            # Create for tenant 2
            result = order_service.create_order(
                db=mock_db,
                order_in=valid_order_create,
                tenant_id=2,  # Different tenant
            )

            assert result.id == 2
            # Verify the check was done with correct tenant_id
            mock_repo.get_by_shopify_draft_id.assert_called_once_with(
                mock_db,
                2,  # tenant_id
                valid_order_create.shopify_draft_order_id,
            )

    # ========================================
    # WooCommerce Duplicate Detection
    # ========================================

    def test_duplicate_woocommerce_order_same_tenant_raises_error(
        self, order_service, mock_db, valid_woo_order_create
    ):
        """Test: Create order with existing woocommerce_order_id for same tenant fails."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = MagicMock(id=1)

            with pytest.raises(ValueError) as exc_info:
                order_service.create_order(
                    db=mock_db,
                    order_in=valid_woo_order_create,
                    tenant_id=1,
                )

            error_msg = str(exc_info.value)
            assert "already exists" in error_msg
            assert "WooCommerce" in error_msg

    def test_same_woocommerce_id_different_tenant_allowed(
        self, order_service, mock_db, valid_woo_order_create
    ):
        """Test: Same woocommerce_order_id for different tenants is allowed."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            mock_order = MagicMock()
            mock_order.id = 2
            mock_order.total_price = 100.00
            mock_repo.create.return_value = mock_order

            result = order_service.create_order(
                db=mock_db,
                order_in=valid_woo_order_create,
                tenant_id=2,
            )

            assert result.id == 2
            mock_repo.get_by_woocommerce_order_id.assert_called_once_with(
                mock_db,
                2,
                valid_woo_order_create.woocommerce_order_id,
            )


class TestOrderServiceLineItemCalculations:
    """Tests for line item calculations in OrderService."""

    @pytest.fixture
    def order_service(self) -> OrderService:
        """Create OrderService instance."""
        return OrderService()

    def test_calculate_total_from_line_items(self, order_service):
        """Test: Total is calculated correctly from line items."""
        line_items = [
            {"unitPrice": 100.00, "quantity": 2},  # 200.00
            {"unitPrice": 50.00, "quantity": 1},   # 50.00
        ]

        processed_items, total = order_service._calculate_line_items_and_total(line_items)

        assert total == 250.00
        assert len(processed_items) == 2
        assert processed_items[0]["subtotal"] == 200.00
        assert processed_items[1]["subtotal"] == 50.00

    def test_calculate_subtotal_per_item(self, order_service):
        """Test: Subtotal is calculated for each line item."""
        line_items = [
            {"sku": "A", "unitPrice": 59.00, "quantity": 2},
            {"sku": "B", "unitPrice": 100.00, "quantity": 3},
        ]

        processed_items, total = order_service._calculate_line_items_and_total(line_items)

        assert processed_items[0]["subtotal"] == 118.00
        assert processed_items[1]["subtotal"] == 300.00
        assert total == 418.00

    def test_empty_line_items_returns_zero(self, order_service):
        """Test: Empty line items returns total of 0."""
        processed_items, total = order_service._calculate_line_items_and_total([])

        assert processed_items == []
        assert total == 0.0

    def test_none_line_items_returns_zero(self, order_service):
        """Test: None line items returns total of 0."""
        processed_items, total = order_service._calculate_line_items_and_total(None)

        assert processed_items == []
        assert total == 0.0

    def test_missing_unit_price_defaults_to_zero(self, order_service):
        """Test: Line item without unitPrice defaults to 0."""
        line_items = [
            {"sku": "A", "quantity": 2},  # No unitPrice
        ]

        processed_items, total = order_service._calculate_line_items_and_total(line_items)

        assert processed_items[0]["subtotal"] == 0.0
        assert total == 0.0

    def test_missing_quantity_defaults_to_one(self, order_service):
        """Test: Line item without quantity defaults to 1."""
        line_items = [
            {"sku": "A", "unitPrice": 100.00},  # No quantity
        ]

        processed_items, total = order_service._calculate_line_items_and_total(line_items)

        assert processed_items[0]["subtotal"] == 100.00
        assert total == 100.00


class TestOrderServiceTotalValidation:
    """Tests for total price validation in OrderService."""

    @pytest.fixture
    def order_service(self) -> OrderService:
        """Create OrderService instance."""
        return OrderService()

    def test_order_with_empty_line_items_raises_error(self, order_service, mock_db):
        """Test: Order with no line items is rejected."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            order_create = OrderCreate(
                customer_email="test@example.com",
                customer_name="Test",
                shopify_draft_order_id="gid://shopify/DraftOrder/999",
                line_items=[],  # Empty
                currency="PEN",
            )

            with pytest.raises(ValueError) as exc_info:
                order_service.create_order(
                    db=mock_db,
                    order_in=order_create,
                    tenant_id=1,
                )

            assert "positive price" in str(exc_info.value).lower()

    def test_order_with_positive_total_succeeds(self, order_service, mock_db):
        """Test: Order with positive total succeeds."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            mock_order = MagicMock()
            mock_order.id = 1
            mock_order.total_price = 100.00
            mock_repo.create.return_value = mock_order

            order_create = OrderCreate(
                customer_email="test@example.com",
                customer_name="Test",
                shopify_draft_order_id="gid://shopify/DraftOrder/999",
                line_items=[
                    LineItemBase(
                        sku="PROD",
                        product="Product",
                        unitPrice=100.00,
                        quantity=1,
                    )
                ],
                currency="PEN",
            )

            result = order_service.create_order(
                db=mock_db,
                order_in=order_create,
                tenant_id=1,
            )

            assert result.id == 1
            mock_repo.create.assert_called_once()


class TestOrderServiceCRUD:
    """Tests for basic CRUD operations in OrderService."""

    @pytest.fixture
    def order_service(self) -> OrderService:
        """Create OrderService instance."""
        return OrderService()

    def test_get_order_returns_order(self, order_service, mock_db):
        """Test: get_order returns order when found."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_order = MagicMock()
            mock_order.id = 1
            mock_repo.get.return_value = mock_order

            result = order_service.get_order(mock_db, 1)

            assert result.id == 1
            mock_repo.get.assert_called_once_with(mock_db, 1)

    def test_get_order_returns_none_when_not_found(self, order_service, mock_db):
        """Test: get_order returns None when order not found."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get.return_value = None

            result = order_service.get_order(mock_db, 999)

            assert result is None

    def test_update_order_not_found_raises_error(self, order_service, mock_db):
        """Test: update_order raises ValueError when order not found."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get.return_value = None

            from app.schemas.order import OrderUpdate
            update_data = OrderUpdate(status="Enviado")

            with pytest.raises(ValueError) as exc_info:
                order_service.update_order(mock_db, 999, update_data)

            assert "not found" in str(exc_info.value)

    def test_delete_order_not_found_raises_error(self, order_service, mock_db):
        """Test: delete_order raises ValueError when order not found."""
        with patch("app.services.order.order_repository") as mock_repo:
            mock_repo.get.return_value = None

            with pytest.raises(ValueError) as exc_info:
                order_service.delete_order(mock_db, 999)

            assert "not found" in str(exc_info.value)
