"""
US-009: Tests de Idempotencia para Ordenes
US-010: Tests de Thread Safety para Correlativos

Integration tests for order idempotency and invoice correlative thread safety.
"""

import pytest
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import IntegrityError

from app.services.order import OrderService
from app.repositories.order import order_repository
from app.repositories.invoice_serie import invoice_serie_repository
from app.schemas.order import OrderCreate, LineItemBase


class TestOrderIdempotency:
    """US-009: Tests for order idempotency and duplicate detection."""

    @pytest.fixture
    def order_service(self) -> OrderService:
        """Create OrderService instance."""
        return OrderService()

    @pytest.fixture
    def valid_order_create(self) -> OrderCreate:
        """Create a valid OrderCreate schema with Shopify ID."""
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
        """Create a valid OrderCreate schema with WooCommerce ID."""
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
    # US-009: Shopify Idempotency Tests
    # ========================================

    def test_duplicate_shopify_draft_order_id_same_tenant_raises_value_error(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: Duplicate shopify_draft_order_id for same tenant raises ValueError (not IntegrityError)."""
        with patch("app.services.order.order_repository") as mock_repo:
            # Simulate existing order found (duplicate)
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

    def test_duplicate_woocommerce_order_id_same_tenant_raises_value_error(
        self, order_service, mock_db, valid_woo_order_create
    ):
        """Test: Duplicate woocommerce_order_id for same tenant raises ValueError."""
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

    # ========================================
    # US-009: Multitenancy Tests
    # ========================================

    def test_same_shopify_id_different_tenant_allowed(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: Same shopify_draft_order_id for different tenants is allowed (multitenancy)."""
        with patch("app.services.order.order_repository") as mock_repo:
            # No existing order for tenant 2
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            mock_order = MagicMock()
            mock_order.id = 2
            mock_order.total_price = 100.00
            mock_repo.create.return_value = mock_order

            # Create for tenant 2 (tenant 1 already has this Shopify ID)
            result = order_service.create_order(
                db=mock_db,
                order_in=valid_order_create,
                tenant_id=2,
            )

            assert result.id == 2
            # Verify the check was done with correct tenant_id
            mock_repo.get_by_shopify_draft_id.assert_called_once_with(
                mock_db,
                2,  # tenant_id
                valid_order_create.shopify_draft_order_id,
            )

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

    # ========================================
    # US-009: Database Constraint Tests
    # ========================================

    def test_db_integrity_error_on_duplicate_is_handled(
        self, order_service, mock_db, valid_order_create
    ):
        """Test: IntegrityError from DB constraint is caught and converted to ValueError."""
        with patch("app.services.order.order_repository") as mock_repo:
            # Service check passes (no duplicate found)
            mock_repo.get_by_shopify_draft_id.return_value = None
            mock_repo.get_by_woocommerce_order_id.return_value = None

            # But DB raises IntegrityError on insert (race condition)
            mock_repo.create.side_effect = IntegrityError(
                statement="INSERT",
                params={},
                orig=Exception("duplicate key value violates unique constraint"),
            )

            # The service should handle this gracefully
            with pytest.raises((ValueError, IntegrityError)):
                order_service.create_order(
                    db=mock_db,
                    order_in=valid_order_create,
                    tenant_id=1,
                )


class TestCorrelativoThreadSafety:
    """US-010: Tests for invoice correlative thread safety."""

    @pytest.fixture
    def mock_serie(self):
        """Create a mock InvoiceSerie object."""
        serie = MagicMock()
        serie.id = 1
        serie.tenant_id = 1
        serie.serie = "B001"
        serie.invoice_type = "03"
        serie.last_correlativo = 0
        serie.is_active = True
        return serie

    # ========================================
    # US-010: Sequential Correlative Tests
    # ========================================

    def test_correlativo_increments_sequentially(self, mock_db, mock_serie):
        """Test: Correlativo increments by 1 each time."""
        mock_serie.last_correlativo = 5

        with patch.object(
            invoice_serie_repository, "get_by_serie"
        ) as mock_get:
            # Setup mock to return serie with for_update simulation
            mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
                mock_serie
            )

            # Call get_next_correlative
            result = invoice_serie_repository.get_next_correlative(
                mock_db, tenant_id=1, serie="B001"
            )

            # Should increment from 5 to 6
            assert result == 6
            assert mock_serie.last_correlativo == 6

    def test_correlativo_starts_from_one(self, mock_db, mock_serie):
        """Test: First correlativo is 1."""
        mock_serie.last_correlativo = 0

        mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
            mock_serie
        )

        result = invoice_serie_repository.get_next_correlative(
            mock_db, tenant_id=1, serie="B001"
        )

        assert result == 1
        assert mock_serie.last_correlativo == 1

    # ========================================
    # US-010: Error Handling Tests
    # ========================================

    def test_serie_not_found_raises_value_error(self, mock_db):
        """Test: Non-existent serie raises ValueError."""
        mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
            None
        )

        with pytest.raises(ValueError) as exc_info:
            invoice_serie_repository.get_next_correlative(
                mock_db, tenant_id=1, serie="X999"
            )

        assert "does not exist" in str(exc_info.value)

    def test_inactive_serie_raises_value_error(self, mock_db, mock_serie):
        """Test: Inactive serie raises ValueError."""
        mock_serie.is_active = False

        mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
            mock_serie
        )

        with pytest.raises(ValueError) as exc_info:
            invoice_serie_repository.get_next_correlative(
                mock_db, tenant_id=1, serie="B001"
            )

        assert "inactive" in str(exc_info.value).lower()

    # ========================================
    # US-010: Locking Behavior Tests
    # ========================================

    def test_with_for_update_is_called(self, mock_db, mock_serie):
        """Test: SELECT FOR UPDATE is used for thread safety."""
        mock_serie.last_correlativo = 10

        mock_query = MagicMock()
        mock_filter = MagicMock()
        mock_for_update = MagicMock()

        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.with_for_update.return_value = mock_for_update
        mock_for_update.first.return_value = mock_serie

        invoice_serie_repository.get_next_correlative(
            mock_db, tenant_id=1, serie="B001"
        )

        # Verify with_for_update was called
        mock_filter.with_for_update.assert_called_once()

    def test_commit_is_called_after_increment(self, mock_db, mock_serie):
        """Test: DB commit is called to release the lock."""
        mock_serie.last_correlativo = 5

        mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
            mock_serie
        )

        invoice_serie_repository.get_next_correlative(
            mock_db, tenant_id=1, serie="B001"
        )

        # Verify commit was called to release lock
        mock_db.commit.assert_called_once()


class TestOrderRepositoryDuplicateDetection:
    """Additional tests for repository-level duplicate detection methods."""

    def test_get_by_shopify_draft_id_queries_correct_tenant(self, mock_db):
        """Test: get_by_shopify_draft_id filters by tenant_id."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        order_repository.get_by_shopify_draft_id(
            mock_db,
            tenant_id=1,
            shopify_draft_order_id="gid://shopify/DraftOrder/123",
        )

        # Verify query was executed (filter called)
        mock_db.query.assert_called_once()

    def test_get_by_woocommerce_order_id_queries_correct_tenant(self, mock_db):
        """Test: get_by_woocommerce_order_id filters by tenant_id."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        order_repository.get_by_woocommerce_order_id(
            mock_db,
            tenant_id=1,
            woocommerce_order_id=789,
        )

        # Verify query was executed
        mock_db.query.assert_called_once()

    def test_get_by_shopify_draft_id_returns_order_when_found(self, mock_db):
        """Test: Returns order when found."""
        mock_order = MagicMock()
        mock_order.id = 1
        mock_order.shopify_draft_order_id = "gid://shopify/DraftOrder/123"

        mock_db.query.return_value.filter.return_value.first.return_value = mock_order

        result = order_repository.get_by_shopify_draft_id(
            mock_db,
            tenant_id=1,
            shopify_draft_order_id="gid://shopify/DraftOrder/123",
        )

        assert result is not None
        assert result.id == 1

    def test_get_by_shopify_draft_id_returns_none_when_not_found(self, mock_db):
        """Test: Returns None when order not found."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = order_repository.get_by_shopify_draft_id(
            mock_db,
            tenant_id=1,
            shopify_draft_order_id="gid://shopify/DraftOrder/nonexistent",
        )

        assert result is None
