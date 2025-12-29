"""
Tenant management endpoints.

These endpoints allow ADMIN users to manage tenant (client company) configurations,
including Shopify credentials.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_role
from app.core.permissions import Role
from app.models.user import User
from app.schemas.tenant import (
    TenantCreate,
    TenantDetailResponse,
    TenantListResponse,
    TenantResponse,
    TenantUpdate,
)
from app.services.tenant import tenant_service

router = APIRouter()


@router.get("/", response_model=TenantListResponse, tags=["tenants"])
async def list_tenants(
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = None,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> TenantListResponse:
    """
    List all tenants with pagination.

    Only ADMIN users can access this endpoint.
    Future: Will be restricted to SUPER_ADMIN when that role is implemented.

    Args:
        skip: Number of records to skip
        limit: Maximum records to return (max 100)
        is_active: Filter by active status (None = all tenants)
        current_user: Current authenticated user (ADMIN role required)
        db: Database session

    Returns:
        TenantListResponse with total count and items
    """
    # Validate limit
    if limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 100",
        )

    try:
        tenants, total = tenant_service.get_tenants(
            db, skip=skip, limit=limit, is_active=is_active
        )

        return TenantListResponse(
            total=total,
            items=tenants,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tenants: {str(e)}",
        )


@router.get("/{tenant_id}", response_model=TenantDetailResponse, tags=["tenants"])
async def get_tenant(
    tenant_id: int,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> TenantDetailResponse:
    """
    Get tenant details with statistics.

    Only ADMIN users can access this endpoint.
    Future: Will be restricted to SUPER_ADMIN when that role is implemented.

    Args:
        tenant_id: Tenant ID
        current_user: Current authenticated user (ADMIN role required)
        db: Database session

    Returns:
        TenantDetailResponse with tenant info and stats

    Raises:
        HTTPException: If tenant not found
    """
    tenant = tenant_service.get_tenant(db, tenant_id)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    # Get statistics
    stats = tenant_service.get_tenant_stats(db, tenant_id)

    # Combine tenant data with stats
    return TenantDetailResponse(
        **tenant.__dict__,
        user_count=stats["user_count"],
        order_count=stats["order_count"],
    )


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED, tags=["tenants"])
async def create_tenant(
    tenant_in: TenantCreate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Create a new tenant.

    Only ADMIN users can create tenants.
    Future: Will be restricted to SUPER_ADMIN when that role is implemented.

    **Shopify Credentials**: The shopify_access_token is sent as plaintext in the
    request body but is automatically encrypted before storage in the database.

    Args:
        tenant_in: Tenant creation data
        current_user: Current authenticated user (ADMIN role required)
        db: Database session

    Returns:
        Created tenant (without access token)

    Raises:
        HTTPException: If creation fails (e.g., slug already exists)
    """
    try:
        created_tenant = tenant_service.create_tenant(db, tenant_in)
        return created_tenant
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tenant: {str(e)}",
        )


@router.patch("/{tenant_id}", response_model=TenantResponse, tags=["tenants"])
async def update_tenant(
    tenant_id: int,
    tenant_in: TenantUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Update tenant configuration.

    Only ADMIN users can update tenants.
    Future: Will be restricted to SUPER_ADMIN when that role is implemented.

    **Common Use Case**: Adding or updating Shopify credentials for a tenant.

    **Shopify Credentials**: The shopify_access_token is sent as plaintext in the
    request body but is automatically encrypted before storage in the database.

    Args:
        tenant_id: Tenant ID to update
        tenant_in: Update data (only provided fields will be updated)
        current_user: Current authenticated user (ADMIN role required)
        db: Database session

    Returns:
        Updated tenant (without access token)

    Raises:
        HTTPException: If tenant not found or update fails
    """
    try:
        updated_tenant = tenant_service.update_tenant(db, tenant_id, tenant_in)

        if not updated_tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant {tenant_id} not found",
            )

        return updated_tenant
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tenant: {str(e)}",
        )


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tenants"])
async def deactivate_tenant(
    tenant_id: int,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> None:
    """
    Deactivate (soft delete) a tenant.

    Only ADMIN users can deactivate tenants.
    Future: Will be restricted to SUPER_ADMIN when that role is implemented.

    The tenant is not deleted from the database, just marked as inactive.
    Users from this tenant will not be able to log in, but historical data is preserved.

    **Note**: Cannot deactivate the VentIA platform tenant (is_platform=True).

    Args:
        tenant_id: Tenant ID to deactivate
        current_user: Current authenticated user (ADMIN role required)
        db: Database session

    Raises:
        HTTPException: If tenant not found or is the platform tenant
    """
    try:
        success = tenant_service.deactivate_tenant(db, tenant_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant {tenant_id} not found",
            )
    except ValueError as e:
        # This catches the "cannot deactivate platform tenant" error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deactivate tenant: {str(e)}",
        )
