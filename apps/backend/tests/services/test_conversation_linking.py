"""
US-CONV-002: Tests for automatic order-conversation linking.

Validates try_link_conversation correctly extracts phone from Shopify
webhook payloads, normalizes to E.164, searches messaging for contacts,
and links orders to conversations.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.order import Order
from app.models.tenant import Tenant
from app.services.webhook_service import try_link_conversation


class TestTryLinkConversation:
    """Tests for try_link_conversation function."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.commit = MagicMock()
        return db

    @pytest.fixture
    def mock_order(self):
        """Create a mock order without messaging_conversation_id."""
        order = MagicMock(spec=Order)
        order.id = 100
        order.messaging_conversation_id = None
        return order

    @pytest.fixture
    def mock_tenant(self):
        """Create a mock tenant."""
        tenant = MagicMock(spec=Tenant)
        tenant.id = 1
        return tenant

    @pytest.fixture
    def payload_with_shipping_phone(self):
        """Shopify payload with shipping_address.phone."""
        return {
            "shipping_address": {
                "phone": "+51987654321",
                "address1": "Av. Grau 355",
            },
            "customer": {
                "phone": "+51999999999",
                "email": "test@test.com",
            },
        }

    @pytest.fixture
    def payload_with_customer_phone_only(self):
        """Shopify payload without shipping phone, only customer.phone."""
        return {
            "shipping_address": {
                "address1": "Av. Grau 355",
            },
            "customer": {
                "phone": "+51987654321",
                "email": "test@test.com",
            },
        }

    @pytest.fixture
    def payload_no_phone(self):
        """Shopify payload without any phone."""
        return {
            "shipping_address": {
                "address1": "Av. Grau 355",
            },
            "customer": {
                "email": "test@test.com",
            },
        }

    @pytest.fixture
    def messaging_response_with_conversation(self):
        """Messaging service response with contact and conversation."""
        return {
            "success": True,
            "data": {
                "contact_id": 42,
                "phone_number": "+51987654321",
                "name": "Test Customer",
                "conversation": {
                    "id": 500,
                    "created_at": "2026-04-01T10:00:00Z",
                },
            },
        }

    @pytest.fixture
    def messaging_response_no_conversation(self):
        """Messaging service response with contact but no conversation."""
        return {
            "success": True,
            "data": {
                "contact_id": 42,
                "phone_number": "+51987654321",
                "name": "Test Customer",
                "conversation": None,
            },
        }

    @pytest.fixture
    def messaging_response_no_contact(self):
        """Messaging service response when contact not found."""
        return {
            "success": True,
            "data": {
                "contact_id": None,
                "conversation": None,
            },
        }

    # --- Happy path ---

    @pytest.mark.asyncio
    async def test_links_conversation_when_shipping_phone_found(
        self, mock_db, mock_order, mock_tenant,
        payload_with_shipping_phone, messaging_response_with_conversation,
    ):
        """Test: Links conversation when shipping_address.phone matches a contact."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value=messaging_response_with_conversation
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            mock_svc.find_contact_by_phone.assert_called_once_with(1, "+51987654321")
            assert mock_order.messaging_conversation_id == 500
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_links_by_customer_phone_fallback(
        self, mock_db, mock_order, mock_tenant,
        payload_with_customer_phone_only, messaging_response_with_conversation,
    ):
        """Test: Falls back to customer.phone when shipping_address has no phone."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value=messaging_response_with_conversation
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_customer_phone_only)

            mock_svc.find_contact_by_phone.assert_called_once_with(1, "+51987654321")
            assert mock_order.messaging_conversation_id == 500

    @pytest.mark.asyncio
    async def test_shipping_phone_takes_priority_over_customer(
        self, mock_db, mock_order, mock_tenant,
        payload_with_shipping_phone, messaging_response_with_conversation,
    ):
        """Test: shipping_address.phone is used even when customer.phone differs."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value=messaging_response_with_conversation
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            # Should use shipping phone (+51987654321), not customer phone (+51999999999)
            mock_svc.find_contact_by_phone.assert_called_once_with(1, "+51987654321")

    # --- No-ops ---

    @pytest.mark.asyncio
    async def test_skips_if_already_linked(
        self, mock_db, mock_order, mock_tenant, payload_with_shipping_phone,
    ):
        """Test: Does nothing if order already has messaging_conversation_id."""
        mock_order.messaging_conversation_id = 999

        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock()

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            mock_svc.find_contact_by_phone.assert_not_called()
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_if_no_phone_in_payload(
        self, mock_db, mock_order, mock_tenant, payload_no_phone,
    ):
        """Test: Does nothing when no phone in any payload field."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock()

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_no_phone)

            mock_svc.find_contact_by_phone.assert_not_called()
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_if_phone_invalid(
        self, mock_db, mock_order, mock_tenant,
    ):
        """Test: Does nothing when phone is too short to be valid."""
        payload = {"shipping_address": {"phone": "123"}}

        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock()

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload)

            mock_svc.find_contact_by_phone.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_if_contact_not_found(
        self, mock_db, mock_order, mock_tenant,
        payload_with_shipping_phone, messaging_response_no_contact,
    ):
        """Test: Does not link when messaging has no contact for that phone."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value=messaging_response_no_contact
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            assert mock_order.messaging_conversation_id is None
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_if_contact_has_no_conversation(
        self, mock_db, mock_order, mock_tenant,
        payload_with_shipping_phone, messaging_response_no_conversation,
    ):
        """Test: Does not link when contact exists but has no conversation."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value=messaging_response_no_conversation
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            assert mock_order.messaging_conversation_id is None
            mock_db.commit.assert_not_called()

    # --- Error handling ---

    @pytest.mark.asyncio
    async def test_messaging_service_error_does_not_crash(
        self, mock_db, mock_order, mock_tenant, payload_with_shipping_phone,
    ):
        """Test: Exception from messaging service is caught, order not modified."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                side_effect=Exception("Connection refused")
            )

            # Should not raise
            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            assert mock_order.messaging_conversation_id is None
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_messaging_service_returns_none(
        self, mock_db, mock_order, mock_tenant, payload_with_shipping_phone,
    ):
        """Test: Messaging service returning None (service down) does not crash."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(return_value=None)

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            assert mock_order.messaging_conversation_id is None
            mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_messaging_returns_non_dict_data(
        self, mock_db, mock_order, mock_tenant, payload_with_shipping_phone,
    ):
        """Test: Messaging returning non-dict data field does not crash."""
        with patch("app.services.messaging_service.messaging_service") as mock_svc:
            mock_svc.find_contact_by_phone = AsyncMock(
                return_value={"success": True, "data": []}
            )

            await try_link_conversation(mock_db, mock_order, mock_tenant, payload_with_shipping_phone)

            assert mock_order.messaging_conversation_id is None
            mock_db.commit.assert_not_called()
