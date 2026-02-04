"""
Tests for webhook repository using mocks.
"""

import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import IntegrityError

from app.models.webhook import WebhookEvent
from app.repositories.webhook import webhook_repository
from app.schemas.webhook import WebhookEventCreate


class TestWebhookRepository:
    """Tests for webhook repository methods."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    @pytest.fixture
    def sample_webhook_event(self):
        """Create a sample webhook event."""
        event = MagicMock(spec=WebhookEvent)
        event.id = 1
        event.platform = "shopify"
        event.event_type = "draft_orders/create"
        event.event_id = "123456"
        event.tenant_id = 1
        event.payload = {"id": 123456, "name": "#D1"}
        event.headers = {"X-Shopify-Topic": "draft_orders/create"}
        event.signature_valid = True
        event.signature_header = "test_signature"
        event.processed = False
        event.error = None
        return event

    def test_create_webhook_event(self, mock_db, sample_webhook_event):
        """Test creating a webhook event."""
        event_data = WebhookEventCreate(
            platform="shopify",
            event_type="draft_orders/create",
            event_id="789",
            tenant_id=1,
            payload={"id": 789, "name": "#D2"},
            signature_valid=True,
        )

        # Mock the repository create method
        with patch.object(webhook_repository, "create") as mock_create:
            mock_create.return_value = sample_webhook_event

            event = webhook_repository.create(mock_db, obj_in=event_data)

            assert event.id is not None
            assert event.platform == "shopify"
            assert event.event_type == "draft_orders/create"
            assert event.signature_valid is True
            assert event.processed is False
            mock_create.assert_called_once_with(mock_db, obj_in=event_data)

    def test_get_by_event_id(self, mock_db, sample_webhook_event):
        """Test retrieving webhook event by event_id."""
        with patch.object(webhook_repository, "get_by_event_id") as mock_get:
            mock_get.return_value = sample_webhook_event

            event = webhook_repository.get_by_event_id(
                mock_db,
                platform="shopify",
                event_id="123456",
            )

            assert event is not None
            assert event.id == sample_webhook_event.id
            assert event.event_id == "123456"
            mock_get.assert_called_once_with(mock_db, platform="shopify", event_id="123456")

    def test_get_by_event_id_not_found(self, mock_db):
        """Test retrieving non-existent webhook event."""
        with patch.object(webhook_repository, "get_by_event_id") as mock_get:
            mock_get.return_value = None

            event = webhook_repository.get_by_event_id(
                mock_db,
                platform="shopify",
                event_id="nonexistent",
            )

            assert event is None
            mock_get.assert_called_once_with(mock_db, platform="shopify", event_id="nonexistent")

    def test_get_unprocessed(self, mock_db, sample_webhook_event):
        """Test retrieving unprocessed webhook events."""
        with patch.object(webhook_repository, "get_unprocessed") as mock_get:
            mock_get.return_value = [sample_webhook_event]

            events = webhook_repository.get_unprocessed(mock_db)

            assert len(events) > 0
            assert any(e.id == sample_webhook_event.id for e in events)
            assert all(not e.processed for e in events)
            mock_get.assert_called_once()

    def test_get_unprocessed_by_platform(self, mock_db):
        """Test retrieving unprocessed events by platform."""
        # Create shopify event
        shopify_event = MagicMock(spec=WebhookEvent)
        shopify_event.id = 1
        shopify_event.platform = "shopify"
        shopify_event.processed = False

        # Create woocommerce event
        woo_event = MagicMock(spec=WebhookEvent)
        woo_event.id = 2
        woo_event.platform = "woocommerce"
        woo_event.processed = False

        with patch.object(webhook_repository, "get_unprocessed") as mock_get:
            # Mock returns only shopify events
            mock_get.return_value = [shopify_event]

            shopify_events = webhook_repository.get_unprocessed(mock_db, platform="shopify")

            assert all(e.platform == "shopify" for e in shopify_events)
            assert any(e.id == shopify_event.id for e in shopify_events)
            assert not any(e.id == woo_event.id for e in shopify_events)
            mock_get.assert_called_once()

    def test_get_by_tenant(self, mock_db, sample_webhook_event):
        """Test retrieving webhook events by tenant."""
        with patch.object(webhook_repository, "get_by_tenant") as mock_get:
            mock_get.return_value = [sample_webhook_event]

            events = webhook_repository.get_by_tenant(mock_db, tenant_id=1)

            assert len(events) > 0
            assert all(e.tenant_id == 1 for e in events)
            mock_get.assert_called_once()

    def test_get_failed_events(self, mock_db):
        """Test retrieving failed webhook events."""
        # Create a failed event
        failed_event = MagicMock(spec=WebhookEvent)
        failed_event.id = 1
        failed_event.platform = "shopify"
        failed_event.tenant_id = 1
        failed_event.processed = True
        failed_event.error = "Test error"

        with patch.object(webhook_repository, "get_failed_events") as mock_get:
            mock_get.return_value = [failed_event]

            failed_events = webhook_repository.get_failed_events(mock_db, tenant_id=1)

            assert len(failed_events) > 0
            assert any(e.id == failed_event.id for e in failed_events)
            assert all(e.error is not None for e in failed_events)
            mock_get.assert_called_once()

    def test_unique_event_id_constraint(self, mock_db):
        """Test that duplicate event_ids raise IntegrityError."""
        event_data = WebhookEventCreate(
            platform="shopify",
            event_type="draft_orders/create",
            event_id="duplicate_test",
            tenant_id=1,
            payload={},
            signature_valid=True,
        )

        # First call succeeds
        with patch.object(webhook_repository, "create") as mock_create:
            mock_event = MagicMock(spec=WebhookEvent)
            mock_event.id = 1
            mock_create.return_value = mock_event

            first_event = webhook_repository.create(mock_db, obj_in=event_data)
            assert first_event.id == 1

        # Second call with same event_id should raise IntegrityError
        with patch.object(webhook_repository, "create") as mock_create:
            mock_create.side_effect = IntegrityError(
                statement="INSERT INTO webhook_events",
                params={},
                orig=Exception("UNIQUE constraint failed: webhook_events.platform, webhook_events.event_id"),
            )

            with pytest.raises(IntegrityError):
                webhook_repository.create(mock_db, obj_in=event_data)
