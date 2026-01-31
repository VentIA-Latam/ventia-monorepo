"""
Tests for API dependencies, specifically require_permission_dual.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import require_permission_dual, get_current_user_or_api_key
from app.core.permissions import Role
from app.models.user import User


class TestRequirePermissionDual:
    """Tests for require_permission_dual dependency factory."""

    def _create_mock_user(
        self,
        user_id: int = 1,
        role: Role = Role.ADMIN,
        tenant_id: int = 1,
        is_active: bool = True,
    ) -> User:
        """Create a mock User object for testing."""
        user = MagicMock(spec=User)
        user.id = user_id
        user.role = role
        user.tenant_id = tenant_id
        user.is_active = is_active
        user.email = f"user{user_id}@test.com"
        user.name = f"Test User {user_id}"
        user.auth0_user_id = f"auth0|{user_id}"
        return user

    def _create_mock_request(self, path: str = "/api/v1/invoices") -> MagicMock:
        """Create a mock Request object."""
        request = MagicMock()
        request.url.path = path
        request.state = MagicMock()
        return request

    @pytest.mark.asyncio
    async def test_jwt_auth_with_valid_permission(self):
        """Test JWT authentication with valid permissions returns user."""
        mock_user = self._create_mock_user(role=Role.ADMIN)
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        # Create the dependency
        dependency = require_permission_dual("GET", "/invoices")

        # Mock get_current_user_or_api_key to return our mock user
        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await dependency(
                request=mock_request,
                credentials=mock_credentials,
                x_api_key=None,
                db=mock_db,
            )

        assert result == mock_user
        assert result.role == Role.ADMIN

    @pytest.mark.asyncio
    async def test_api_key_auth_with_valid_permission(self):
        """Test API key authentication with valid permissions returns virtual user."""
        # Virtual user created from API key
        mock_user = self._create_mock_user(
            user_id=0,
            role=Role.VENTAS,
            tenant_id=1,
        )
        mock_user.auth0_user_id = "api_key_123"
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_db = MagicMock()

        dependency = require_permission_dual("GET", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await dependency(
                request=mock_request,
                credentials=None,
                x_api_key="vnt_abc12345_secretkey",
                db=mock_db,
            )

        assert result == mock_user
        assert result.role == Role.VENTAS

    @pytest.mark.asyncio
    async def test_jwt_auth_without_permission_raises_403(self):
        """Test JWT auth without required permission raises 403."""
        # VIEWER role cannot POST to /invoices
        mock_user = self._create_mock_user(role=Role.VIEWER)
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        dependency = require_permission_dual("POST", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(
                    request=mock_request,
                    credentials=mock_credentials,
                    x_api_key=None,
                    db=mock_db,
                )

        assert exc_info.value.status_code == 403
        assert "not allowed" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_api_key_auth_without_permission_raises_403(self):
        """Test API key auth without required permission raises 403."""
        # LOGISTICA role cannot POST to /invoices
        mock_user = self._create_mock_user(role=Role.LOGISTICA)
        mock_request = self._create_mock_request("/api/v1/invoices/1/invoice")
        mock_db = MagicMock()

        dependency = require_permission_dual("POST", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(
                    request=mock_request,
                    credentials=None,
                    x_api_key="vnt_abc12345_secretkey",
                    db=mock_db,
                )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_no_authentication_raises_401(self):
        """Test that missing authentication raises 401."""
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_db = MagicMock()

        dependency = require_permission_dual("GET", "/invoices")

        # Mock get_current_user_or_api_key to raise 401 (no auth provided)
        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=401, detail="Authentication required"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(
                    request=mock_request,
                    credentials=None,
                    x_api_key=None,
                    db=mock_db,
                )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_jwt_raises_401(self):
        """Test that invalid JWT raises 401."""
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "invalid_jwt_token"
        mock_db = MagicMock()

        dependency = require_permission_dual("GET", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=401, detail="Invalid token"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(
                    request=mock_request,
                    credentials=mock_credentials,
                    x_api_key=None,
                    db=mock_db,
                )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_api_key_raises_401(self):
        """Test that invalid API key raises 401."""
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_db = MagicMock()

        dependency = require_permission_dual("GET", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=401, detail="Invalid API key"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(
                    request=mock_request,
                    credentials=None,
                    x_api_key="invalid_key",
                    db=mock_db,
                )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_super_admin_has_all_permissions(self):
        """Test that SUPERADMIN role has access to all endpoints."""
        mock_user = self._create_mock_user(role=Role.SUPERADMIN)
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        # SUPERADMIN should have POST access to /invoices
        dependency = require_permission_dual("POST", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await dependency(
                request=mock_request,
                credentials=mock_credentials,
                x_api_key=None,
                db=mock_db,
            )

        assert result == mock_user
        assert result.role == Role.SUPERADMIN

    @pytest.mark.asyncio
    async def test_ventas_can_create_invoices(self):
        """Test that VENTAS role can create invoices (POST /invoices)."""
        mock_user = self._create_mock_user(role=Role.VENTAS)
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        dependency = require_permission_dual("POST", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await dependency(
                request=mock_request,
                credentials=mock_credentials,
                x_api_key=None,
                db=mock_db,
            )

        assert result == mock_user
        assert result.role == Role.VENTAS

    @pytest.mark.asyncio
    async def test_logistica_can_view_but_not_create_invoices(self):
        """Test that LOGISTICA can GET but not POST invoices."""
        mock_user = self._create_mock_user(role=Role.LOGISTICA)
        mock_request = self._create_mock_request("/api/v1/invoices")
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        # LOGISTICA should be able to GET
        get_dependency = require_permission_dual("GET", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await get_dependency(
                request=mock_request,
                credentials=mock_credentials,
                x_api_key=None,
                db=mock_db,
            )

        assert result == mock_user

        # But should NOT be able to POST
        post_dependency = require_permission_dual("POST", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await post_dependency(
                    request=mock_request,
                    credentials=mock_credentials,
                    x_api_key=None,
                    db=mock_db,
                )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_path_with_trailing_slash_normalized(self):
        """Test that paths with trailing slashes are handled correctly."""
        mock_user = self._create_mock_user(role=Role.ADMIN)
        mock_request = self._create_mock_request("/api/v1/invoices/")  # trailing slash
        mock_credentials = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_credentials.credentials = "valid_jwt_token"
        mock_db = MagicMock()

        dependency = require_permission_dual("GET", "/invoices")

        with patch(
            "app.api.deps.get_current_user_or_api_key",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            result = await dependency(
                request=mock_request,
                credentials=mock_credentials,
                x_api_key=None,
                db=mock_db,
            )

        assert result == mock_user


class TestPermissionsTableIntegrity:
    """Tests to verify PERMISSIONS table has correct entries."""

    def test_invoices_get_permissions(self):
        """Test that GET /invoices has correct permissions."""
        from app.core.permissions import can_access, Role

        # All roles should be able to GET invoices
        assert can_access(Role.SUPERADMIN, "GET", "/invoices") is True
        assert can_access(Role.ADMIN, "GET", "/invoices") is True
        assert can_access(Role.LOGISTICA, "GET", "/invoices") is True
        assert can_access(Role.VENTAS, "GET", "/invoices") is True
        assert can_access(Role.VIEWER, "GET", "/invoices") is True

    def test_invoices_post_permissions(self):
        """Test that POST /invoices has correct permissions."""
        from app.core.permissions import can_access, Role

        # Only SUPERADMIN, ADMIN, VENTAS can POST invoices
        assert can_access(Role.SUPERADMIN, "POST", "/invoices") is True
        assert can_access(Role.ADMIN, "POST", "/invoices") is True
        assert can_access(Role.VENTAS, "POST", "/invoices") is True
        assert can_access(Role.LOGISTICA, "POST", "/invoices") is False
        assert can_access(Role.VIEWER, "POST", "/invoices") is False

    def test_invoices_wildcard_permissions(self):
        """Test that /invoices/* (PDF, XML, status) has correct permissions."""
        from app.core.permissions import can_access, Role

        # All roles should be able to GET invoice details
        assert can_access(Role.SUPERADMIN, "GET", "/invoices/123/pdf") is True
        assert can_access(Role.ADMIN, "GET", "/invoices/123/xml") is True
        assert can_access(Role.LOGISTICA, "GET", "/invoices/456/status") is True
        assert can_access(Role.VENTAS, "GET", "/invoices/789/pdf") is True
        assert can_access(Role.VIEWER, "GET", "/invoices/1/xml") is True

    def test_invoice_series_permissions(self):
        """Test that invoice-series endpoints have correct permissions."""
        from app.core.permissions import can_access, Role

        # GET: All roles
        assert can_access(Role.SUPERADMIN, "GET", "/invoice-series") is True
        assert can_access(Role.VIEWER, "GET", "/invoice-series") is True

        # POST: Only SUPERADMIN, ADMIN
        assert can_access(Role.SUPERADMIN, "POST", "/invoice-series") is True
        assert can_access(Role.ADMIN, "POST", "/invoice-series") is True
        assert can_access(Role.VENTAS, "POST", "/invoice-series") is False

        # PATCH: Only SUPERADMIN, ADMIN
        assert can_access(Role.SUPERADMIN, "PATCH", "/invoice-series/1") is True
        assert can_access(Role.ADMIN, "PATCH", "/invoice-series/1") is True
        assert can_access(Role.VENTAS, "PATCH", "/invoice-series/1") is False

        # DELETE: Only SUPERADMIN, ADMIN
        assert can_access(Role.SUPERADMIN, "DELETE", "/invoice-series/1") is True
        assert can_access(Role.ADMIN, "DELETE", "/invoice-series/1") is True
        assert can_access(Role.VENTAS, "DELETE", "/invoice-series/1") is False
