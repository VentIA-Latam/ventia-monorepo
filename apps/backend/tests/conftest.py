"""
Shared fixtures for all tests.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch
from typing import Any

from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.tenant import Tenant
from app.models.invoice import Invoice
from app.models.invoice_serie import InvoiceSerie
from app.core.permissions import Role
from app.schemas.tenant_settings import (
    TenantSettings,
    EcommerceSettings,
    ShopifyCredentials,
    WooCommerceCredentials,
)


@pytest.fixture
def mock_db() -> MagicMock:
    """Create a mock database session."""
    db = MagicMock(spec=Session)
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock()
    db.rollback = MagicMock()
    return db


@pytest.fixture
def mock_tenant() -> MagicMock:
    """Create a mock tenant with default settings."""
    tenant = MagicMock(spec=Tenant)
    tenant.id = 1
    tenant.name = "Test Company SAC"
    tenant.slug = "test-company-outlet"
    tenant.company_id = "auth0|123456"
    tenant.is_platform = False
    tenant.is_active = True
    tenant.efact_ruc = "20123456789"
    tenant.emisor_nombre_comercial = "Test Company"
    tenant.emisor_ubigeo = "150101"
    tenant.emisor_departamento = "LIMA"
    tenant.emisor_provincia = "LIMA"
    tenant.emisor_distrito = "LIMA"
    tenant.emisor_direccion = "AV. TEST 123"

    # Mock get_settings() to return TenantSettings
    tenant.get_settings.return_value = TenantSettings(
        ecommerce=EcommerceSettings(
            sync_on_validation=True,
            shopify=ShopifyCredentials(
                store_url="https://test.myshopify.com",
                access_token="shpat_test_token",
                api_version="2024-01",
            ),
        )
    )

    return tenant


@pytest.fixture
def mock_tenant_woocommerce() -> MagicMock:
    """Create a mock tenant with WooCommerce settings."""
    tenant = MagicMock(spec=Tenant)
    tenant.id = 2
    tenant.name = "WooCommerce Store SAC"
    tenant.slug = "woo-store-outlet"
    tenant.company_id = "auth0|654321"
    tenant.is_platform = False
    tenant.is_active = True
    tenant.efact_ruc = "20987654321"
    tenant.emisor_nombre_comercial = "WooCommerce Store"
    tenant.emisor_ubigeo = "150101"
    tenant.emisor_departamento = "LIMA"
    tenant.emisor_provincia = "LIMA"
    tenant.emisor_distrito = "LIMA"
    tenant.emisor_direccion = "AV. WOO 456"

    tenant.get_settings.return_value = TenantSettings(
        ecommerce=EcommerceSettings(
            sync_on_validation=True,
            woocommerce=WooCommerceCredentials(
                store_url="https://test-woo.com",
                consumer_key="ck_test",
                consumer_secret="cs_test",
            ),
        )
    )

    return tenant


@pytest.fixture
def mock_order(mock_tenant: MagicMock) -> MagicMock:
    """Create a mock validated order."""
    order = MagicMock(spec=Order)
    order.id = 1
    order.tenant_id = 1
    order.tenant = mock_tenant
    order.shopify_draft_order_id = "gid://shopify/DraftOrder/123456"
    order.shopify_order_id = None
    order.woocommerce_order_id = None
    order.customer_email = "cliente@example.com"
    order.customer_name = "Juan Perez"
    order.customer_document_type = "1"  # DNI
    order.customer_document_number = "12345678"
    order.total_price = 118.00
    order.currency = "PEN"
    order.validado = True
    order.validated_at = datetime.utcnow()
    order.status = "Pagado"
    order.line_items = [
        {
            "sku": "PROD001",
            "product": "Producto Test",
            "unitPrice": 118.00,
            "quantity": 1,
            "subtotal": 118.00,
        }
    ]
    order.source_platform = "shopify"

    return order


@pytest.fixture
def mock_order_pending(mock_tenant: MagicMock) -> MagicMock:
    """Create a mock pending (not validated) order."""
    order = MagicMock(spec=Order)
    order.id = 2
    order.tenant_id = 1
    order.tenant = mock_tenant
    order.shopify_draft_order_id = "gid://shopify/DraftOrder/789"
    order.shopify_order_id = None
    order.woocommerce_order_id = None
    order.customer_email = "cliente2@example.com"
    order.customer_name = "Maria Garcia"
    order.customer_document_type = "6"  # RUC
    order.customer_document_number = "20123456789"
    order.total_price = 236.00
    order.currency = "PEN"
    order.validado = False
    order.validated_at = None
    order.status = "Pendiente"
    order.line_items = [
        {
            "sku": "PROD002",
            "product": "Producto Business",
            "unitPrice": 236.00,
            "quantity": 1,
            "subtotal": 236.00,
        }
    ]
    order.source_platform = "shopify"

    return order


@pytest.fixture
def mock_invoice() -> MagicMock:
    """Create a mock invoice."""
    invoice = MagicMock(spec=Invoice)
    invoice.id = 1
    invoice.tenant_id = 1
    invoice.order_id = 1
    invoice.invoice_type = "03"
    invoice.serie = "B001"
    invoice.correlativo = 1
    invoice.emisor_ruc = "20123456789"
    invoice.emisor_razon_social = "Test Company SAC"
    invoice.cliente_tipo_documento = "1"
    invoice.cliente_numero_documento = "12345678"
    invoice.cliente_razon_social = "Juan Perez"
    invoice.subtotal = 100.00
    invoice.igv = 18.00
    invoice.total = 118.00
    invoice.currency = "PEN"
    invoice.efact_status = "processing"
    invoice.efact_ticket = "TICKET-123456"

    return invoice


@pytest.fixture
def mock_invoice_serie() -> MagicMock:
    """Create a mock invoice serie."""
    serie = MagicMock(spec=InvoiceSerie)
    serie.id = 1
    serie.tenant_id = 1
    serie.invoice_type = "03"
    serie.serie = "B001"
    serie.next_correlative = 1
    serie.is_active = True

    return serie


@pytest.fixture
def sample_line_items() -> list[dict[str, Any]]:
    """Sample line items for testing."""
    return [
        {
            "sku": "PROD001",
            "product": "Producto A",
            "unitPrice": 59.00,
            "quantity": 2,
        },
        {
            "sku": "PROD002",
            "product": "Producto B",
            "unitPrice": 100.00,
            "quantity": 1,
        },
    ]
