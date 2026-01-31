"""
US-004: Tests de Generacion JSON-UBL

Tests for generate_json_ubl function and numero_a_letras helper.
"""

import pytest
from datetime import datetime

from app.integrations.efact_client import (
    generate_json_ubl,
    numero_a_letras,
    validar_ruc,
    validar_dni,
)


class TestGenerateJsonUBL:
    """Tests for generate_json_ubl function structure and validation."""

    @pytest.fixture
    def valid_items(self):
        """Sample valid items list."""
        return [
            {
                "sku": "PROD001",
                "description": "Producto de Prueba",
                "quantity": 2,
                "unit_price": 50.00,  # Without IGV
                "unit": "NIU",
            }
        ]

    @pytest.fixture
    def valid_params(self, valid_items):
        """Valid parameters for generate_json_ubl."""
        return {
            "invoice_type": "03",
            "serie": "B001",
            "correlativo": 1,
            "fecha_emision": datetime(2024, 1, 15, 10, 30, 0),
            "emisor_ruc": "20123456789",
            "emisor_razon_social": "MI EMPRESA SAC",
            "cliente_tipo_doc": "1",
            "cliente_numero_doc": "12345678",
            "cliente_razon_social": "JUAN PEREZ",
            "currency": "PEN",
            "items": valid_items,
            "subtotal": 100.00,
            "igv": 18.00,
            "total": 118.00,
        }

    # ========================================
    # JSON-UBL Structure Tests
    # ========================================

    def test_json_ubl_has_required_root_keys(self, valid_params):
        """Test: JSON-UBL has required root keys (_D, _S, _B, _E, Invoice)."""
        result = generate_json_ubl(**valid_params)

        assert "_D" in result
        assert "_S" in result
        assert "_B" in result
        assert "_E" in result
        assert "Invoice" in result

    def test_json_ubl_namespaces_are_correct(self, valid_params):
        """Test: JSON-UBL has correct UBL 2.1 namespace URNs."""
        result = generate_json_ubl(**valid_params)

        assert result["_D"] == "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        assert result["_S"] == "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
        assert result["_B"] == "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
        assert result["_E"] == "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"

    def test_invoice_has_required_fields(self, valid_params):
        """Test: Invoice contains required SUNAT fields."""
        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]

        # Required fields
        assert "UBLVersionID" in invoice
        assert "CustomizationID" in invoice
        assert "ID" in invoice  # Document number
        assert "IssueDate" in invoice
        assert "IssueTime" in invoice
        assert "InvoiceTypeCode" in invoice
        assert "DocumentCurrencyCode" in invoice
        assert "AccountingSupplierParty" in invoice  # Emisor
        assert "AccountingCustomerParty" in invoice  # Cliente
        assert "TaxTotal" in invoice
        assert "LegalMonetaryTotal" in invoice
        assert "InvoiceLine" in invoice

    def test_document_number_format(self, valid_params):
        """Test: Document ID format is SERIE-CORRELATIVO (8 digits)."""
        valid_params["serie"] = "B001"
        valid_params["correlativo"] = 123

        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]
        doc_id = invoice["ID"][0]["IdentifierContent"]

        assert doc_id == "B001-00000123"

    def test_ubl_version_is_21(self, valid_params):
        """Test: UBL version is 2.1."""
        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]
        version = invoice["UBLVersionID"][0]["IdentifierContent"]

        assert version == "2.1"

    def test_invoice_lines_count_matches_items(self, valid_params):
        """Test: Number of InvoiceLine matches items count."""
        valid_params["items"] = [
            {"sku": "A", "description": "Item A", "quantity": 1, "unit_price": 50.00, "unit": "NIU"},
            {"sku": "B", "description": "Item B", "quantity": 2, "unit_price": 25.00, "unit": "NIU"},
        ]
        valid_params["subtotal"] = 100.00
        valid_params["igv"] = 18.00
        valid_params["total"] = 118.00

        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]
        lines = invoice["InvoiceLine"]

        assert len(lines) == 2
        assert invoice["LineCountNumeric"][0]["NumericContent"] == 2

    # ========================================
    # Validation Tests
    # ========================================

    def test_empty_items_raises_error(self, valid_params):
        """Test: Empty items list raises ValueError."""
        valid_params["items"] = []

        with pytest.raises(ValueError) as exc_info:
            generate_json_ubl(**valid_params)

        assert "Items list cannot be empty" in str(exc_info.value)

    def test_total_mismatch_raises_error(self, valid_params):
        """Test: Total != subtotal + igv raises ValueError."""
        valid_params["subtotal"] = 100.00
        valid_params["igv"] = 18.00
        valid_params["total"] = 200.00  # Wrong total

        with pytest.raises(ValueError) as exc_info:
            generate_json_ubl(**valid_params)

        assert "Total mismatch" in str(exc_info.value)

    def test_total_with_rounding_tolerance(self, valid_params):
        """Test: Total with 1 cent difference is accepted."""
        valid_params["subtotal"] = 100.00
        valid_params["igv"] = 18.00
        valid_params["total"] = 118.01  # 1 cent tolerance

        # Should not raise
        result = generate_json_ubl(**valid_params)
        assert result is not None

    # ========================================
    # NC/ND Reference Tests
    # ========================================

    def test_nc_requires_all_reference_fields(self, valid_params):
        """Test: Nota de Credito requires all reference fields."""
        valid_params["invoice_type"] = "07"  # NC
        valid_params["reference_type"] = "03"
        valid_params["reference_serie"] = "B001"
        # Missing reference_correlativo and reference_reason

        with pytest.raises(ValueError) as exc_info:
            generate_json_ubl(**valid_params)

        assert "reference" in str(exc_info.value).lower()

    def test_nd_requires_all_reference_fields(self, valid_params):
        """Test: Nota de Debito requires all reference fields."""
        valid_params["invoice_type"] = "08"  # ND
        # Missing all reference fields

        with pytest.raises(ValueError) as exc_info:
            generate_json_ubl(**valid_params)

        assert "reference" in str(exc_info.value).lower()

    def test_nc_with_valid_references_succeeds(self, valid_params):
        """Test: NC with all reference fields succeeds."""
        valid_params["invoice_type"] = "07"
        valid_params["reference_type"] = "03"
        valid_params["reference_serie"] = "B001"
        valid_params["reference_correlativo"] = 1
        valid_params["reference_reason"] = "Anulacion de venta"

        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]
        assert "BillingReference" in invoice
        assert "DiscrepancyResponse" in invoice

    # ========================================
    # Price Calculation Tests
    # ========================================

    def test_line_item_igv_calculation(self, valid_params):
        """Test: Line item IGV is calculated correctly (18%)."""
        valid_params["items"] = [
            {"sku": "A", "description": "Item", "quantity": 1, "unit_price": 100.00, "unit": "NIU"}
        ]
        valid_params["subtotal"] = 100.00
        valid_params["igv"] = 18.00
        valid_params["total"] = 118.00

        result = generate_json_ubl(**valid_params)

        invoice = result["Invoice"][0]
        line = invoice["InvoiceLine"][0]

        # Check line extension amount (without IGV)
        line_amount = line["LineExtensionAmount"][0]["AmountContent"]
        assert line_amount == "100.00"

        # Check IGV on line
        line_igv = line["TaxTotal"][0]["TaxAmount"][0]["AmountContent"]
        assert line_igv == "18.00"


class TestNumeroALetras:
    """Tests for numero_a_letras function."""

    def test_basic_numbers_pen(self):
        """Test: Basic number conversions in PEN."""
        assert "CIEN" in numero_a_letras(100.00, "PEN")
        assert "SOLES" in numero_a_letras(100.00, "PEN")

    def test_one_sol(self):
        """Test: 1 SOL (singular)."""
        result = numero_a_letras(1.00, "PEN")
        assert "UNO" in result
        assert "SOL" in result

    def test_multiple_soles(self):
        """Test: Multiple SOLES (plural)."""
        result = numero_a_letras(100.00, "PEN")
        assert "SOLES" in result

    def test_usd_currency(self):
        """Test: USD currency conversion."""
        result = numero_a_letras(1000.00, "USD")
        assert "DÓLARES AMERICANOS" in result or "DOLARES AMERICANOS" in result

    def test_decimal_part_format(self):
        """Test: Decimal part is formatted as XX/100."""
        result = numero_a_letras(150.50, "PEN")
        assert "50/100" in result

    def test_zero_decimals(self):
        """Test: Zero decimals as 00/100."""
        result = numero_a_letras(100.00, "PEN")
        assert "00/100" in result

    def test_common_amounts(self):
        """Test: Common invoice amounts."""
        # 118.00 (100 + IGV)
        result = numero_a_letras(118.00, "PEN")
        assert "CIENTO DIECIOCHO" in result
        assert "00/100" in result
        assert "SOLES" in result

    def test_thousands(self):
        """Test: Thousands conversion."""
        result = numero_a_letras(1000.00, "PEN")
        assert "UN MIL" in result

    def test_millions(self):
        """Test: Millions conversion."""
        result = numero_a_letras(1000000.00, "PEN")
        assert "MILLÓN" in result or "MILLON" in result


class TestValidarRUC:
    """Tests for validar_ruc function."""

    def test_valid_ruc_11_digits(self):
        """Test: Valid RUC with 11 digits."""
        assert validar_ruc("20123456789") is True

    def test_invalid_ruc_10_digits(self):
        """Test: Invalid RUC with 10 digits."""
        assert validar_ruc("2012345678") is False

    def test_invalid_ruc_12_digits(self):
        """Test: Invalid RUC with 12 digits."""
        assert validar_ruc("201234567890") is False

    def test_invalid_ruc_non_numeric(self):
        """Test: Invalid RUC with non-numeric characters."""
        assert validar_ruc("2012345678A") is False

    def test_invalid_ruc_empty(self):
        """Test: Invalid empty RUC."""
        assert validar_ruc("") is False

    def test_invalid_ruc_none(self):
        """Test: Invalid None RUC."""
        assert validar_ruc(None) is False


class TestValidarDNI:
    """Tests for validar_dni function."""

    def test_valid_dni_8_digits(self):
        """Test: Valid DNI with 8 digits."""
        assert validar_dni("12345678") is True

    def test_invalid_dni_7_digits(self):
        """Test: Invalid DNI with 7 digits."""
        assert validar_dni("1234567") is False

    def test_invalid_dni_9_digits(self):
        """Test: Invalid DNI with 9 digits."""
        assert validar_dni("123456789") is False

    def test_invalid_dni_non_numeric(self):
        """Test: Invalid DNI with non-numeric characters."""
        assert validar_dni("1234567A") is False

    def test_invalid_dni_empty(self):
        """Test: Invalid empty DNI."""
        assert validar_dni("") is False

    def test_invalid_dni_none(self):
        """Test: Invalid None DNI."""
        assert validar_dni(None) is False
