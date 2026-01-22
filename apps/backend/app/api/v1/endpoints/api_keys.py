"""
API Key management endpoints (ADMIN only).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_database, require_permission_dual
from app.core.permissions import Role
from app.models.user import User
from app.schemas.api_key import (
    APIKeyCreate,
    APIKeyCreateResponse,
    APIKeyListResponse,
    APIKeyResponse,
    APIKeyUpdate,
)
from app.services.api_key import api_key_service
from app.services.user import user_service

router = APIRouter()


@router.post(
    "",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["api-keys"],
)
async def create_api_key(
    api_key_in: APIKeyCreate,
    current_user: User = Depends(require_permission_dual("POST", "/api-keys")),
    db: Session = Depends(get_database),
) -> APIKeyCreateResponse:
    """
    Create a new API key.

    **SUPER_ADMIN and ADMIN users can create API keys.**
    - SUPER_ADMIN: Can create API keys for any tenant
    - ADMIN: Can create API keys for their own tenant

    ⚠️ **IMPORTANT**: The complete API key is returned ONLY ONCE.
    Save it securely - you won't be able to see it again!

    API keys allow authentication for external integrations like n8n workflows.
    Each key is scoped to a tenant and has a specific role.

    Args:
        api_key_in: API key creation data
        current_user: Current authenticated user (SUPER_ADMIN or ADMIN)
        db: Database session

    Returns:
        Created API key with the complete key value

    Raises:
        HTTPException: If name already exists or role is SUPER_ADMIN
    """
    try:
        # Create API key
        api_key, plain_key = api_key_service.create_api_key(
            db=db,
            api_key_in=api_key_in,
            tenant_id=current_user.tenant_id,
            created_by_user_id=current_user.id,
        )

        # Build response with complete key
        return APIKeyCreateResponse(
            id=api_key.id,
            name=api_key.name,
            key=plain_key,  # Plain key - shown ONLY this once
            key_prefix=api_key.key_prefix,
            role=api_key.role,
            tenant_id=api_key.tenant_id,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=APIKeyListResponse, tags=["api-keys"])
async def list_api_keys(
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = None,
    tenant_id: int | None = None,
    current_user: User = Depends(require_permission_dual("GET", "/api-keys")),
    db: Session = Depends(get_database),
) -> APIKeyListResponse:
    """
    List API keys.

    **SUPER_ADMIN and ADMIN users can list API keys.**

    SUPER_ADMIN behavior:
    - If no tenant_id specified: Returns API keys from ALL tenants
    - If tenant_id specified: Returns API keys from that specific tenant only

    ADMIN behavior:
    - Always returns API keys from their own tenant only (cannot specify tenant_id)

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum records to return (max 100)
        is_active: Filter by active status (optional)
        tenant_id: Tenant ID to filter by (SUPER_ADMIN only, optional)
        current_user: Current authenticated user (SUPER_ADMIN or ADMIN)
        db: Database session

    Returns:
        Paginated list of API keys (without complete key, only prefix)
    """
    # Determine which tenant to query
    if current_user.role == Role.SUPER_ADMIN:
        # SuperAdmin can query all tenants or a specific tenant
        query_tenant_id = tenant_id  # None means all tenants
    else:
        # Regular admin can only query their own tenant
        query_tenant_id = current_user.tenant_id

    # Get API keys
    if query_tenant_id is None:
        # SUPER_ADMIN querying all tenants
        api_keys = api_key_service.get_all_api_keys(
            db,
            skip=skip,
            limit=limit,
            is_active=is_active,
        )
        total = api_key_service.count_all_api_keys(db, is_active=is_active)
    else:
        # Query specific tenant
        api_keys = api_key_service.get_api_keys_by_tenant(
            db,
            query_tenant_id,
            skip=skip,
            limit=limit,
            is_active=is_active,
        )
        total = api_key_service.count_api_keys_by_tenant(
            db,
            query_tenant_id,
            is_active=is_active,
        )

    return APIKeyListResponse(
        total=total,
        items=[APIKeyResponse.model_validate(key) for key in api_keys],
        skip=skip,
        limit=limit,
    )


@router.get("/{api_key_id}", response_model=APIKeyResponse, tags=["api-keys"])
async def get_api_key(
    api_key_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/api-keys/*")),
    db: Session = Depends(get_database),
) -> APIKeyResponse:
    """
    Get API key details by ID.

    **SUPER_ADMIN and ADMIN users can access this endpoint.**

    Regular admins can only view API keys from their own tenant.
    SuperAdmins can view API keys from any tenant.

    Args:
        api_key_id: API key ID
        current_user: Current authenticated user (SUPER_ADMIN or ADMIN)
        db: Database session

    Returns:
        API key details (without complete key, only prefix)

    Raises:
        HTTPException: If API key not found or access denied
    """
    api_key = api_key_service.get_api_key(db, api_key_id)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key {api_key_id} not found",
        )

    # Verify access: user must be from same tenant OR be SuperAdmin
    if (
        current_user.role != Role.SUPER_ADMIN
        and api_key.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this API key",
        )

    return APIKeyResponse.model_validate(api_key)


@router.patch("/{api_key_id}", response_model=APIKeyResponse, tags=["api-keys"])
async def update_api_key(
    api_key_id: int,
    api_key_update: APIKeyUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/api-keys/*")),
    db: Session = Depends(get_database),
) -> APIKeyResponse:
    """
    Update an API key.

    **SUPER_ADMIN and ADMIN users can update API keys.**

    You can update the name, active status, and expiration date.
    You cannot change the role or regenerate the key itself.

    Regular admins can only update API keys from their own tenant.
    SuperAdmins can update API keys from any tenant.

    Args:
        api_key_id: API key ID
        api_key_update: Update data
        current_user: Current authenticated user (SUPER_ADMIN or ADMIN)
        db: Database session

    Returns:
        Updated API key

    Raises:
        HTTPException: If API key not found, access denied, or name conflict
    """
    api_key = api_key_service.get_api_key(db, api_key_id)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key {api_key_id} not found",
        )

    # Verify access
    if (
        current_user.role != Role.SUPER_ADMIN
        and api_key.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this API key",
        )

    try:
        updated_key = api_key_service.update_api_key(db, api_key, api_key_update)
        return APIKeyResponse.model_validate(updated_key)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{api_key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["api-keys"],
)
async def revoke_api_key(
    api_key_id: int,
    current_user: User = Depends(require_permission_dual("DELETE", "/api-keys/*")),
    db: Session = Depends(get_database),
) -> None:
    """
    Revoke (deactivate) an API key.

    **SUPER_ADMIN and ADMIN users can revoke API keys.**

    This marks the API key as inactive. It cannot be reactivated -
    you must create a new key if needed.

    The key is not deleted from the database to preserve audit history.

    Regular admins can only revoke API keys from their own tenant.
    SuperAdmins can revoke API keys from any tenant.

    Args:
        api_key_id: API key ID to revoke
        current_user: Current authenticated user (SUPER_ADMIN or ADMIN)
        db: Database session

    Raises:
        HTTPException: If API key not found or access denied
    """
    api_key = api_key_service.get_api_key(db, api_key_id)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API key {api_key_id} not found",
        )

    # Verify access
    if (
        current_user.role != Role.SUPER_ADMIN
        and api_key.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this API key",
        )

    api_key_service.revoke_api_key(db, api_key)
