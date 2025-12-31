"""
FastAPI dependencies for authentication and database.
"""

from typing import Callable

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.auth import get_user_id_from_token, verify_token
from app.core.database import get_db
from app.core.permissions import Role, can_access
from app.models.user import User
from app.repositories.user import user_repository
from app.services.api_key import api_key_service
from app.services.user import user_service

# Security scheme for Bearer token
security = HTTPBearer(auto_error=False)  # auto_error=False to allow API key fallback


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to get current authenticated user from Auth0 JWT.

    Validates JWT token using Auth0 public keys and retrieves user from database.

    Args:
        credentials: HTTP Authorization header with Bearer token
        db: Database session

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Get token from Authorization header
    token = credentials.credentials

    try:
        # Verify JWT with Auth0
        payload = await verify_token(token)

        # Extract Auth0 user ID (sub claim)
        auth0_user_id = get_user_id_from_token(payload)

        # Get user from database
        user = user_repository.get_by_auth0_id(db, auth0_user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found in database. Please contact administrator.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        # Update last login
        user_service.update_last_login(db, user)

        return user

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_or_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency for dual authentication: JWT token OR API key.

    This dependency accepts either:
    1. Authorization: Bearer <jwt_token> (Auth0)
    2. X-API-Key: <api_key> (for external integrations like n8n)

    If JWT token is present, it validates via Auth0 and returns the actual User.
    If API key is present, it validates the key and returns a virtual User with
    tenant_id and role from the API key.

    Args:
        request: FastAPI request object
        credentials: Optional Bearer token credentials
        x_api_key: Optional API key from X-API-Key header
        db: Database session

    Returns:
        User: Authenticated user (real or virtual from API key)

    Raises:
        HTTPException: If neither authentication method is valid
    """
    # Try JWT authentication first (if Authorization header is present)
    if credentials and credentials.credentials:
        token = credentials.credentials

        try:
            # Verify JWT with Auth0
            payload = await verify_token(token)
            auth0_user_id = get_user_id_from_token(payload)

            # Get user from database
            user = user_repository.get_by_auth0_id(db, auth0_user_id)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found in database",
                )

            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is inactive",
                )

            # Update last login
            user_service.update_last_login(db, user)

            return user

        except HTTPException:
            raise
        except Exception as e:
            # JWT validation failed, try API key fallback if available
            if not x_api_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"JWT authentication failed: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    # Try API key authentication (if X-API-Key header is present)
    if x_api_key:
        # Verify and get API key
        api_key = api_key_service.verify_and_get_api_key(db, x_api_key)

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired API key",
                headers={"WWW-Authenticate": "API-Key"},
            )

        # Create a virtual User object with API key's tenant and role
        # This allows the API key to act as a user with specific permissions
        virtual_user = User(
            id=0,  # Virtual user has no real ID
            auth0_user_id=f"api_key_{api_key.id}",
            email=f"api_key_{api_key.id}@internal",
            name=f"API Key: {api_key.name}",
            tenant_id=api_key.tenant_id,
            role=api_key.role,
            is_active=True,
        )

        # Store API key info in request state for logging
        request.state.api_key_id = api_key.id
        request.state.auth_method = "api_key"

        return virtual_user

    # Neither JWT nor API key was provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide either Bearer token or X-API-Key header.",
        headers={"WWW-Authenticate": "Bearer, API-Key"},
    )


def require_permission(method: str, path_pattern: str) -> Callable:
    """
    Dependency factory to check if user has permission for an endpoint.

    Args:
        method: HTTP method (GET, POST, PUT, DELETE)
        path_pattern: Path pattern (e.g., "/orders", "/orders/*")

    Returns:
        Callable: Dependency function that checks permissions

    Usage:
        ```python
        @router.post("/orders/{order_id}/validate")
        async def validate_order(
            order_id: int,
            current_user: User = Depends(require_permission("POST", "/orders/*/validate"))
        ):
            # Only ADMIN and LOGISTICA can access this
            ...
        ```
    """

    async def permission_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
    ) -> User:
        """Check if user's role has permission to access this endpoint."""
        # Get actual path from request and normalize (remove trailing slash)
        actual_path = request.url.path.rstrip("/") or "/"

        # Check permission
        if not can_access(current_user.role, method, actual_path):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not allowed to {method} {actual_path}",
            )

        return current_user

    return permission_checker


def require_role(*allowed_roles: Role) -> Callable:
    """
    Dependency factory to require specific roles.

    Simpler alternative to require_permission for role-based checks.

    Args:
        allowed_roles: Roles that are allowed to access the endpoint

    Returns:
        Callable: Dependency function that checks role

    Usage:
        ```python
        @router.get("/admin")
        async def admin_endpoint(
            current_user: User = Depends(require_role(Role.ADMIN))
        ):
            # Only ADMIN can access
            ...
        ```
    """

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if user has one of the allowed roles."""
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires one of these roles: {', '.join(r.value for r in allowed_roles)}",
            )
        return current_user

    return role_checker


# Alias for get_db to use in API endpoints
get_database = get_db
