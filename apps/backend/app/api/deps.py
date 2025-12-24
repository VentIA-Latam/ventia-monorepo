"""
FastAPI dependencies for authentication and database.
"""

from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.auth import get_user_id_from_token, verify_token
from app.core.database import get_db
from app.core.permissions import Role, can_access
from app.models.user import User
from app.repositories.user import user_repository
from app.services.user import user_service

# Security scheme for Bearer token
security = HTTPBearer()


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
        # Get actual path from request
        actual_path = request.url.path

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
