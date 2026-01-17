"""
User management endpoints (ADMIN only).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_permission_dual
from app.core.permissions import Role
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UsersListResponse, UserUpdateResponse
from app.services.user import user_service

router = APIRouter()


@router.get("/", response_model=UsersListResponse | list[UserResponse], tags=["users"])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    tenant_id: int | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    current_user: User = Depends(require_permission_dual("GET", "/users")),
    db: Session = Depends(get_database),
) -> UsersListResponse | list[UserResponse]:
    """
    List all users.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPER_ADMIN: All users with advanced filters and metadata.
    - tenant_id: Filter by specific tenant
    - role: Filter by user role (SUPER_ADMIN, ADMIN, LOGISTICA, VENTAS, VIEWER)
    - is_active: Filter by active status (true/false)
    - search: Search in user name or email
    - skip/limit: Pagination
    Returns: UsersListResponse with total, items, skip, limit

    Other roles: Only users from their own tenant.
    Returns: list of UserResponse
    """
    try:
        return user_service.list_users(
            db,
            current_user,
            skip=skip,
            limit=limit,
            tenant_id=tenant_id,
            role=role,  # Pass as string, service will parse
            is_active=is_active,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/me", response_model=UserResponse, tags=["users"])
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Get current authenticated user information.

    Returns the complete user profile including:
    - id, email, name, role
    - tenant_id (which tenant the user belongs to)
    - is_active status
    - created_at, updated_at timestamps

    This endpoint is useful for the frontend to:
    - Display user info in the UI
    - Check user role for conditional rendering
    - Validate tenant membership
    """
    return current_user


@router.get("/{user_id}", response_model=UserResponse, tags=["users"])
async def get_user(
    user_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/users/*")),
    db: Session = Depends(get_database),
) -> UserResponse:
    """
    Get user by ID.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPER_ADMIN: Can access any user.
    Other roles: Can only access users from their own tenant.
    """
    try:
        return user_service.get_user_for_access(db, user_id, current_user)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e),
            )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["users"])
async def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_permission_dual("POST", "/users")),
    db: Session = Depends(get_database),
) -> UserResponse:
    """
    Create a new user.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPER_ADMIN: Can create users in any tenant. Validates tenant exists and is active.
    Other roles: Can only create users in their own tenant.

    Both: Cannot create SUPER_ADMIN role users.
    Request body: email, name, role, auth0_user_id, tenant_id
    """
    try:
        return user_service.create_user_for_role(db, user_in, current_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{user_id}", response_model=UserUpdateResponse, tags=["users"])
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_permission_dual("PUT", "/users/*")),
    db: Session = Depends(get_database),
) -> UserUpdateResponse:
    """
    Update user.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPER_ADMIN: Can update any user. Cannot deactivate themselves.
    Other roles: Can only update users from their own tenant.
    - Cannot deactivate SUPER_ADMIN or ADMIN users
    - Cannot deactivate themselves

    Updatable fields: name, role, is_active
    Immutable fields: email, auth0_user_id, tenant_id

    Returns: 200 with updated user and optional warning message
    """
    try:
        updated_user, warning = user_service.update_user_for_role(db, user_id, user_in, current_user)
        return UserUpdateResponse(user=updated_user, warning=warning)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN if "Access denied" in str(e) or "Cannot" in str(e) else status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_permission_dual("DELETE", "/users/*")),
    db: Session = Depends(get_database),
) -> None:
    """
    Deactivate user (soft delete).

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPER_ADMIN only: Can deactivate any user (except themselves).
    - Cannot deactivate the last active SUPER_ADMIN in the system
    - User is marked as inactive (is_active=False) instead of deleted
    """
    try:
        user_service.delete_user_for_access(db, user_id, current_user)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        elif "Only SUPER_ADMIN" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
