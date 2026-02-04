"""
US-OC-009: Tests de cancelación de pedidos.

Cubre:
- Endpoint guards: 404 (no encontrada), 403 (otro tenant), 400 (ya cancelada)
- Flujo Shopify draft: delete_draft_order llamado con shopify_draft_order_id
- Flujo Shopify completado: cancel_order llamado con todos los parámetros
- Flujo WooCommerce: update_order_status llamado con "cancelled"
- Persistencia de staff_note en notes
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.orders import cancel_order as cancel_order_endpoint
from app.core.permissions import Role
from app.schemas.order import OrderCancel
from app.services.ecommerce import EcommerceService

# ===========================================================================
# Endpoint: guards (404, 403, 400) y SUPERADMIN bypass
# ===========================================================================


class TestCancelOrderEndpoint:
    """Tests for POST /orders/{order_id}/cancel endpoint guards."""

    def _mock_user(self, role: Role = Role.ADMIN, tenant_id: int = 1) -> MagicMock:
        user = MagicMock()
        user.role = role
        user.tenant_id = tenant_id
        return user

    @pytest.mark.asyncio
    async def test_order_not_found_returns_404(self, mock_db):
        """Test: Non-existent order returns 404."""
        with patch("app.api.v1.endpoints.orders.order_service") as mock_svc:
            mock_svc.get_order.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await cancel_order_endpoint(
                    order_id=999,
                    cancel_data=OrderCancel(reason="CUSTOMER"),
                    current_user=self._mock_user(),
                    db=mock_db,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_order_from_other_tenant_returns_403(self, mock_db):
        """Test: Non-SUPERADMIN cannot cancel order belonging to another tenant."""
        order = MagicMock()
        order.tenant_id = 2
        order.status = "Pagado"

        with patch("app.api.v1.endpoints.orders.order_service") as mock_svc:
            mock_svc.get_order.return_value = order

            with pytest.raises(HTTPException) as exc_info:
                await cancel_order_endpoint(
                    order_id=1,
                    cancel_data=OrderCancel(reason="CUSTOMER"),
                    current_user=self._mock_user(role=Role.ADMIN, tenant_id=1),
                    db=mock_db,
                )

            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_already_cancelled_order_returns_400(self, mock_db):
        """Test: Order with status Cancelado returns 400."""
        order = MagicMock()
        order.tenant_id = 1
        order.status = "Cancelado"

        with patch("app.api.v1.endpoints.orders.order_service") as mock_svc:
            mock_svc.get_order.return_value = order

            with pytest.raises(HTTPException) as exc_info:
                await cancel_order_endpoint(
                    order_id=1,
                    cancel_data=OrderCancel(reason="CUSTOMER"),
                    current_user=self._mock_user(),
                    db=mock_db,
                )

            assert exc_info.value.status_code == 400
            assert "already cancelled" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_superadmin_bypasses_tenant_check(self, mock_db):
        """Test: SUPERADMIN can cancel orders from any tenant."""
        order = MagicMock()
        order.tenant_id = 2
        order.status = "Pagado"
        cancelled_order = MagicMock()

        with patch("app.api.v1.endpoints.orders.order_service") as mock_svc, \
             patch("app.api.v1.endpoints.orders.ecommerce_service") as mock_ecom:
            mock_svc.get_order.return_value = order
            mock_ecom.cancel_order = AsyncMock(return_value=cancelled_order)

            result = await cancel_order_endpoint(
                order_id=1,
                cancel_data=OrderCancel(reason="CUSTOMER"),
                current_user=self._mock_user(role=Role.SUPERADMIN, tenant_id=1),
                db=mock_db,
            )

            assert result == cancelled_order
            mock_ecom.cancel_order.assert_called_once()


# ===========================================================================
# Service: los tres flujos de cancelación
# ===========================================================================


class TestCancelOrderService:
    """Tests for EcommerceService.cancel_order() routing and client calls."""

    @pytest.fixture
    def service(self) -> EcommerceService:
        return EcommerceService()

    @pytest.fixture
    def cancel_data(self) -> OrderCancel:
        return OrderCancel(
            reason="CUSTOMER",
            restock=True,
            notify_customer=True,
            refund_method="original",
            staff_note="Cliente solicitó cancelación",
        )

    # -----------------------------------------------------------------------
    # Fixtures de órdenes por plataforma
    # -----------------------------------------------------------------------

    @pytest.fixture
    def shopify_draft_order(self, mock_tenant) -> MagicMock:
        """Draft order en Shopify (no validada)."""
        order = MagicMock()
        order.id = 10
        order.tenant_id = 1
        order.tenant = mock_tenant
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/111"
        order.shopify_order_id = None
        order.woocommerce_order_id = None
        order.validado = False
        order.status = "Pendiente"
        order.source_platform = "shopify"
        order.notes = None
        return order

    @pytest.fixture
    def shopify_completed_order(self, mock_tenant) -> MagicMock:
        """Orden completada (validada) en Shopify."""
        order = MagicMock()
        order.id = 20
        order.tenant_id = 1
        order.tenant = mock_tenant
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/222"
        order.shopify_order_id = "gid://shopify/Order/222"
        order.woocommerce_order_id = None
        order.validado = True
        order.status = "Pagado"
        order.source_platform = "shopify"
        order.notes = None
        return order

    @pytest.fixture
    def woocommerce_order(self, mock_tenant_woocommerce) -> MagicMock:
        """Orden en WooCommerce."""
        order = MagicMock()
        order.id = 30
        order.tenant_id = 2
        order.tenant = mock_tenant_woocommerce
        order.shopify_draft_order_id = None
        order.shopify_order_id = None
        order.woocommerce_order_id = 456
        order.validado = True
        order.status = "Pagado"
        order.source_platform = "woocommerce"
        order.notes = None
        return order

    # -----------------------------------------------------------------------
    # Flujo: Shopify draft → delete_draft_order
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cancel_shopify_draft_calls_delete_draft_order(
        self, service, mock_db, shopify_draft_order, cancel_data
    ):
        """Test: Shopify draft → delete_draft_order llamado con shopify_draft_order_id."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_draft_order

            await service.cancel_order(
                db=mock_db, order=shopify_draft_order, cancel_data=cancel_data
            )

            mock_client.delete_draft_order.assert_called_once_with(
                "gid://shopify/DraftOrder/111"
            )

    @pytest.mark.asyncio
    async def test_cancel_shopify_draft_sets_status_cancelado(
        self, service, mock_db, shopify_draft_order, cancel_data
    ):
        """Test: Shopify draft cancellation updates local status to Cancelado."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_draft_order

            await service.cancel_order(
                db=mock_db, order=shopify_draft_order, cancel_data=cancel_data
            )

            update_data = mock_repo.update.call_args.kwargs["obj_in"]
            assert update_data["status"] == "Cancelado"

    # -----------------------------------------------------------------------
    # Flujo: Shopify completado → cancel_order con todos los parámetros
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cancel_shopify_completed_calls_cancel_order(
        self, service, mock_db, shopify_completed_order, cancel_data
    ):
        """Test: Shopify completado → cancel_order llamado con todos los campos de cancel_data."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_completed_order

            await service.cancel_order(
                db=mock_db, order=shopify_completed_order, cancel_data=cancel_data
            )

            mock_client.cancel_order.assert_called_once_with(
                order_id="gid://shopify/Order/222",
                reason="CUSTOMER",
                restock=True,
                notify_customer=True,
                refund_method="original",
                staff_note="Cliente solicitó cancelación",
            )

    @pytest.mark.asyncio
    async def test_cancel_shopify_completed_sets_status_cancelado(
        self, service, mock_db, shopify_completed_order, cancel_data
    ):
        """Test: Shopify completed cancellation updates local status to Cancelado."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_completed_order

            await service.cancel_order(
                db=mock_db, order=shopify_completed_order, cancel_data=cancel_data
            )

            update_data = mock_repo.update.call_args.kwargs["obj_in"]
            assert update_data["status"] == "Cancelado"

    # -----------------------------------------------------------------------
    # Flujo: WooCommerce → update_order_status("cancelled")
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cancel_woocommerce_calls_update_order_status(
        self, service, mock_db, woocommerce_order, cancel_data
    ):
        """Test: WooCommerce → update_order_status llamado con woocommerce_order_id y 'cancelled'."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.services.ecommerce.WooCommerceClient", return_value=mock_client):
            mock_repo.update.return_value = woocommerce_order

            await service.cancel_order(
                db=mock_db, order=woocommerce_order, cancel_data=cancel_data
            )

            mock_client.update_order_status.assert_called_once_with(456, "cancelled")

    @pytest.mark.asyncio
    async def test_cancel_woocommerce_sets_status_cancelado(
        self, service, mock_db, woocommerce_order, cancel_data
    ):
        """Test: WooCommerce cancellation updates local status to Cancelado."""
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.services.ecommerce.WooCommerceClient", return_value=mock_client):
            mock_repo.update.return_value = woocommerce_order

            await service.cancel_order(
                db=mock_db, order=woocommerce_order, cancel_data=cancel_data
            )

            update_data = mock_repo.update.call_args.kwargs["obj_in"]
            assert update_data["status"] == "Cancelado"

    # -----------------------------------------------------------------------
    # Guard: orden ya cancelada
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_cancel_already_cancelled_raises_valueerror(
        self, service, mock_db, shopify_draft_order
    ):
        """Test: Order with status Cancelado raises ValueError before any platform call."""
        shopify_draft_order.status = "Cancelado"

        with pytest.raises(ValueError) as exc_info:
            await service.cancel_order(
                db=mock_db,
                order=shopify_draft_order,
                cancel_data=OrderCancel(reason="CUSTOMER"),
            )

        assert "already cancelled" in str(exc_info.value)

    # -----------------------------------------------------------------------
    # staff_note: persistencia en notes
    # -----------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_staff_note_appended_to_existing_notes(
        self, service, mock_db, shopify_draft_order
    ):
        """Test: staff_note se agrega a notes existentes con prefijo [Cancelación]."""
        shopify_draft_order.notes = "Nota previa"
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_draft_order

            await service.cancel_order(
                db=mock_db,
                order=shopify_draft_order,
                cancel_data=OrderCancel(reason="CUSTOMER", staff_note="Motivo interno"),
            )

            update_data = mock_repo.update.call_args.kwargs["obj_in"]
            assert "Nota previa" in update_data["notes"]
            assert "[Cancelación] Motivo interno" in update_data["notes"]

    @pytest.mark.asyncio
    async def test_no_staff_note_does_not_modify_notes(
        self, service, mock_db, shopify_draft_order
    ):
        """Test: Sin staff_note, el campo notes no se incluye en el update."""
        shopify_draft_order.notes = "Nota previa"
        mock_client = AsyncMock()

        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch("app.integrations.shopify_token_manager.shopify_token_manager") as mock_tm, \
             patch("app.services.ecommerce.ShopifyClient", return_value=mock_client):
            mock_tm.get_valid_access_token = AsyncMock(return_value="shpat_valid")
            mock_repo.update.return_value = shopify_draft_order

            await service.cancel_order(
                db=mock_db,
                order=shopify_draft_order,
                cancel_data=OrderCancel(reason="CUSTOMER"),  # staff_note=None por default
            )

            update_data = mock_repo.update.call_args.kwargs["obj_in"]
            assert "notes" not in update_data
