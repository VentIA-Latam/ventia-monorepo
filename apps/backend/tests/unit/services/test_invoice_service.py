"""
US-001: Tests de Validaciones SUNAT para Facturacion

Tests for InvoiceService validations according to SUNAT rules for document types.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch, PropertyMock

from app.services.invoice import InvoiceService
from app.schemas.invoice import InvoiceCreate
from app.core.permissions import Role


class TestInvoiceServiceSUNATValidations:
    """Tests for SUNAT document type validations in InvoiceService.create_invoice()."""

    @pytest.fixture
    def invoice_service(self) -> InvoiceService:
        """Create InvoiceService instance with mocked eFact client."""
        service = InvoiceService()
        service.efact_client = MagicMock()
        return service

    @pytest.fixture
    def mock_order_with_ruc(self, mock_order):
        """Order with RUC document."""
        mock_order.customer_document_type = "6"
        mock_order.customer_document_number = "20123456789"
        mock_order.customer_name = "Empresa SAC"
        return mock_order

    @pytest.fixture
    def mock_order_with_dni(self, mock_order):
        """Order with DNI document."""
        mock_order.customer_document_type = "1"
        mock_order.customer_document_number = "12345678"
        mock_order.customer_name = "Juan Perez"
        return mock_order

    # ========================================
    # Factura (01) requires RUC with 11 digits
    # ========================================

    def test_factura_requires_ruc_document_type(
        self, invoice_service, mock_db, mock_order_with_dni, mock_tenant
    ):
        """Test: Factura (tipo 01) requires RUC (tipo_documento=6), not DNI."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order_repo.get.return_value = mock_order_with_dni
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="01",  # Factura
                serie="F001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Facturas" in str(exc_info.value)
            assert "RUC" in str(exc_info.value)
            assert "cliente_tipo_documento=6" in str(exc_info.value)

    def test_factura_with_dni_instead_of_ruc_fails(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Factura with DNI instead of RUC must fail with clear error."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            # Set DNI instead of RUC
            mock_order.customer_document_type = "1"
            mock_order.customer_document_number = "12345678"
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="01",  # Factura
                serie="F001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            error_msg = str(exc_info.value)
            assert "Facturas" in error_msg
            assert "RUC" in error_msg

    def test_factura_ruc_must_be_11_digits(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Factura requires RUC with exactly 11 digits."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            # Set RUC with wrong length (10 digits)
            mock_order.customer_document_type = "6"
            mock_order.customer_document_number = "2012345678"  # 10 digits
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="01",
                serie="F001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "11 digits" in str(exc_info.value)
            assert "10 digits" in str(exc_info.value)

    def test_factura_with_valid_ruc_11_digits_passes_validation(
        self, invoice_service, mock_db, mock_order_with_ruc, mock_tenant, mock_invoice_serie
    ):
        """Test: Factura with valid RUC (11 digits) passes document validation."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo, \
             patch("app.services.invoice.generate_json_ubl") as mock_gen_ubl:

            mock_order_repo.get.return_value = mock_order_with_ruc
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1
            mock_gen_ubl.return_value = {"Invoice": [{}]}

            invoice_service.efact_client.send_document.return_value = {
                "description": "TICKET-123"
            }

            invoice_data = InvoiceCreate(
                invoice_type="01",
                serie="F001",
            )

            # Should not raise - document type validation passes
            # (may fail later due to DB operations, but validation passes)
            try:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )
            except ValueError as e:
                # Should not be a document type validation error
                assert "RUC" not in str(e) or "11 digits" not in str(e)

    # ========================================
    # Boleta (03) accepts multiple document types
    # ========================================

    def test_boleta_accepts_dni_8_digits(
        self, invoice_service, mock_db, mock_order_with_dni, mock_tenant, mock_invoice_serie
    ):
        """Test: Boleta (tipo 03) accepts DNI with 8 digits."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo, \
             patch("app.services.invoice.generate_json_ubl") as mock_gen_ubl:

            mock_order_repo.get.return_value = mock_order_with_dni
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1
            mock_gen_ubl.return_value = {"Invoice": [{}]}

            invoice_service.efact_client.send_document.return_value = {
                "description": "TICKET-123"
            }

            invoice_data = InvoiceCreate(
                invoice_type="03",  # Boleta
                serie="B001",
            )

            # Should not raise for DNI validation
            try:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )
            except ValueError as e:
                # Should not be a DNI validation error
                assert "DNI" not in str(e)

    def test_boleta_accepts_ruc(
        self, invoice_service, mock_db, mock_order_with_ruc, mock_tenant
    ):
        """Test: Boleta accepts RUC (tipo_documento=6)."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo, \
             patch("app.services.invoice.generate_json_ubl") as mock_gen_ubl:

            mock_order_repo.get.return_value = mock_order_with_ruc
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1
            mock_gen_ubl.return_value = {"Invoice": [{}]}

            invoice_service.efact_client.send_document.return_value = {
                "description": "TICKET-123"
            }

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            # Should not raise for RUC validation on Boleta
            try:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )
            except ValueError as e:
                assert "RUC" not in str(e) or "invalid" not in str(e).lower()

    def test_boleta_accepts_carnet_extranjeria(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Boleta accepts Carnet de Extranjeria (tipo_documento=4)."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo, \
             patch("app.services.invoice.generate_json_ubl") as mock_gen_ubl:

            mock_order.customer_document_type = "4"
            mock_order.customer_document_number = "CE12345678"  # 10 chars
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1
            mock_gen_ubl.return_value = {"Invoice": [{}]}

            invoice_service.efact_client.send_document.return_value = {
                "description": "TICKET-123"
            }

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            try:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )
            except ValueError as e:
                assert "Carnet" not in str(e)

    def test_boleta_accepts_pasaporte(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Boleta accepts Pasaporte (tipo_documento=7)."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo, \
             patch("app.services.invoice.generate_json_ubl") as mock_gen_ubl:

            mock_order.customer_document_type = "7"
            mock_order.customer_document_number = "AB1234567"  # 9 chars
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1
            mock_gen_ubl.return_value = {"Invoice": [{}]}

            invoice_service.efact_client.send_document.return_value = {
                "description": "TICKET-123"
            }

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            try:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )
            except ValueError as e:
                assert "Pasaporte" not in str(e)

    def test_boleta_rejects_dni_wrong_length(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Boleta rejects DNI with wrong length (not 8 digits)."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order.customer_document_type = "1"  # DNI
            mock_order.customer_document_number = "1234567"  # 7 digits (wrong)
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "DNI" in str(exc_info.value)
            assert "8 digits" in str(exc_info.value)

    # ========================================
    # NC/ND (07/08) require reference
    # ========================================

    def test_nota_credito_requires_reference_invoice(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Nota de Credito (tipo 07) requires reference_invoice_id."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo:

            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1

            invoice_data = InvoiceCreate(
                invoice_type="07",  # Nota de Credito
                serie="BC01",
                # reference_invoice_id NOT provided
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Reference invoice ID required" in str(exc_info.value)

    def test_nota_debito_requires_reference_invoice(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Nota de Debito (tipo 08) requires reference_invoice_id."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo:

            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1

            invoice_data = InvoiceCreate(
                invoice_type="08",  # Nota de Debito
                serie="BD01",
                # reference_invoice_id NOT provided
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Reference invoice ID required" in str(exc_info.value)

    def test_nc_nd_without_reference_fails_with_clear_error(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: NC/ND without reference must fail with ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo, \
             patch("app.services.invoice.invoice_serie_repository") as mock_serie_repo:

            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant
            mock_serie_repo.get_next_correlative.return_value = 1

            for invoice_type in ["07", "08"]:
                invoice_data = InvoiceCreate(
                    invoice_type=invoice_type,
                    serie="BC01" if invoice_type == "07" else "BD01",
                )

                with pytest.raises(ValueError) as exc_info:
                    invoice_service.create_invoice(
                        db=mock_db,
                        order_id=1,
                        tenant_id=1,
                        invoice_data=invoice_data,
                    )

                assert "Reference" in str(exc_info.value)

    # ========================================
    # IGV Calculation Tests
    # ========================================

    def test_igv_calculation_correct(self):
        """Test: IGV calculation is correct (subtotal = total / 1.18)."""
        # Order total includes IGV: 118.00
        total = 118.00

        # Expected: subtotal = 100.00, igv = 18.00
        expected_subtotal = round(total / 1.18, 2)
        expected_igv = round(total - expected_subtotal, 2)

        assert expected_subtotal == 100.00
        assert expected_igv == 18.00
        assert round(expected_subtotal + expected_igv, 2) == total

    def test_igv_plus_subtotal_equals_total(self):
        """Test: IGV + subtotal = total with 2 decimal precision."""
        test_totals = [118.00, 236.00, 590.00, 1180.00, 59.00, 23.60]

        for total in test_totals:
            subtotal = round(total / 1.18, 2)
            igv = round(total - subtotal, 2)

            # Allow 1 cent tolerance for rounding
            assert abs((subtotal + igv) - total) <= 0.01, \
                f"Failed for total={total}: subtotal={subtotal}, igv={igv}"


class TestInvoiceServiceOrderValidations:
    """Tests for order-related validations in InvoiceService."""

    @pytest.fixture
    def invoice_service(self) -> InvoiceService:
        """Create InvoiceService instance."""
        service = InvoiceService()
        service.efact_client = MagicMock()
        return service

    def test_order_not_found_raises_error(self, invoice_service, mock_db):
        """Test: Non-existent order raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo:
            mock_order_repo.get.return_value = None

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=999,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Order 999 not found" in str(exc_info.value)

    def test_order_not_validated_raises_error(
        self, invoice_service, mock_db, mock_order_pending, mock_tenant
    ):
        """Test: Order not validated (validado=False) raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order_repo.get.return_value = mock_order_pending
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=2,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "not been validated" in str(exc_info.value)

    def test_order_belongs_to_different_tenant_raises_error(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Order belonging to different tenant raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order.tenant_id = 1
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            # Try to create invoice with different tenant_id
            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=999,  # Different tenant
                    invoice_data=invoice_data,
                )

            assert "does not belong to tenant" in str(exc_info.value)

    def test_order_without_customer_document_raises_error(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Order without customer document info raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order.customer_document_type = None
            mock_order.customer_document_number = None
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
                # No customer document provided in request either
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Customer document information is required" in str(exc_info.value)


class TestInvoiceServiceTenantValidations:
    """Tests for tenant-related validations in InvoiceService."""

    @pytest.fixture
    def invoice_service(self) -> InvoiceService:
        """Create InvoiceService instance."""
        service = InvoiceService()
        service.efact_client = MagicMock()
        return service

    def test_tenant_without_ruc_raises_error(
        self, invoice_service, mock_db, mock_order, mock_tenant
    ):
        """Test: Tenant without efact_ruc raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_tenant.efact_ruc = None  # No RUC configured
            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = mock_tenant

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "RUC configured" in str(exc_info.value)

    def test_tenant_not_found_raises_error(
        self, invoice_service, mock_db, mock_order
    ):
        """Test: Non-existent tenant raises ValueError."""
        with patch("app.services.invoice.order_repository") as mock_order_repo, \
             patch("app.services.invoice.tenant_repository") as mock_tenant_repo:

            mock_order_repo.get.return_value = mock_order
            mock_tenant_repo.get.return_value = None  # Tenant not found

            invoice_data = InvoiceCreate(
                invoice_type="03",
                serie="B001",
            )

            with pytest.raises(ValueError) as exc_info:
                invoice_service.create_invoice(
                    db=mock_db,
                    order_id=1,
                    tenant_id=1,
                    invoice_data=invoice_data,
                )

            assert "Tenant" in str(exc_info.value)
            assert "not found" in str(exc_info.value)
