"""
Tenant management endpoints.

These endpoints allow ADMIN users to manage tenant (client company) configurations,
including Shopify credentials.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_permission, require_role
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
    current_user: User = Depends(require_permission("GET", "/tenants")),
    db: Session = Depends(get_database),
) -> TenantListResponse:
    """
    List all tenants with pagination.

    SUPER_ADMIN only: Can retrieve all tenants without filters.
    Other roles: Access denied (403 Forbidden).

    Args:
        skip: Number of records to skip (default: 0)
        limit: Maximum records to return (default: 100, max: 100)
        current_user: Current authenticated user (SUPER_ADMIN role required)
        db: Database session

    Returns:
        TenantListResponse with total count, items, skip, and limit
        
    Response fields per tenant:
        - id: Tenant ID
        - name: Company name
        - slug: URL-friendly identifier
        - company_id: Auth0 organization mapping ID
        - shopify_store_url: Shopify store URL
        - is_active: Active status
        - is_platform: Platform tenant flag
        - created_at: Creation timestamp
        - updated_at: Last update timestamp
    """
    # Validate limit
    if limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 100",
        )

    try:
        tenants, total = tenant_service.get_tenants(
            db, skip=skip, limit=limit, is_active=None
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
    current_user: User = Depends(require_permission("GET", "/tenants/*")),
    db: Session = Depends(get_database),
) -> TenantDetailResponse:
    """
    Get detailed tenant information with statistics.

    Returns comprehensive tenant information including:
    - Basic tenant data: id, name, slug, company_id, shopify_store_url, is_active, is_platform
    - Timestamps: created_at, updated_at
    - Statistics: number of active users, total orders

    Args:
        tenant_id: Tenant ID
        current_user: Current authenticated user (requires GET permission on /tenants/*)
        db: Database session

    Returns:
        TenantDetailResponse with:
        - user_count: Total number of active users in this tenant
        - order_count: Total number of orders associated with this tenant
        - All fields from TenantResponse

    Raises:
        HTTPException 404: If tenant with given ID not found
    """
    tenant = tenant_service.get_tenant(db, tenant_id)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    # Get statistics
    stats = tenant_service.get_tenant_stats(db, tenant_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    # Combine tenant data with stats
    return TenantDetailResponse(
        **tenant.__dict__,
        user_count=stats["user_count"],
        order_count=stats["order_count"],
    )


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED, tags=["tenants"])
async def create_tenant(
    tenant_in: TenantCreate,
    current_user: User = Depends(require_permission("POST", "/tenants")),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Create a new tenant.

    **Request Body:**
    - name: Company name (required, max 100 chars)
    - slug: URL-friendly identifier in kebab-case (optional - auto-generated as "name-outlet" if not provided)
    - company_id: Auth0 organization mapping ID (optional)
    - shopify_store_url: Shopify store URL (required, must be valid URL starting with http:// or https://)
    - shopify_access_token: Shopify Admin API access token (required, plaintext - encrypted before storage)
    - shopify_api_version: Shopify API version (optional, defaults to "2024-01")

    **Auto-generated slug:**
    - If slug is not provided, it will be auto-generated as "{name-in-kebab-case}-outlet"
    - Examples:
      - name: "My Company" → slug: "my-company-outlet"
      - name: "Test_123" → slug: "test-123-outlet"
    - The generated slug must be unique (validated by the system)

    **Validations:**
    - name: Must be 1-100 characters
    - slug: If provided, must be unique and in kebab-case format (lowercase alphanumeric with hyphens)
    - shopify_store_url: Must start with http:// or https://
    - shopify_access_token: Required and plaintext (will be encrypted before storage)

    **Defaults:**
    - is_platform: Always False (new tenants are clients, not platform)
    - is_active: Always True
    - shopify_api_version: "2024-01" if not provided

    **Returns:**
    - 201 Created with the created tenant including its ID
    - TenantResponse includes: id, name, slug, company_id, shopify_store_url, is_active, is_platform, created_at, updated_at

    **Raises:**
    - 400: If slug already exists, validation fails, or invalid request data
    - 500: If creation fails for unexpected reasons

    **Security Note**: shopify_access_token is sent as plaintext in the request body
    but is automatically encrypted by the Tenant model before storage in the database.
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
    current_user: User = Depends(require_permission("PUT", "/tenants/*")),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Update tenant configuration.

    **Updatable fields:**
    - name: Company name (max 100 chars)
    - shopify_store_url: Shopify store URL (must start with http:// or https://)
    - shopify_access_token: Shopify Admin API access token (plaintext - will be encrypted)
    - shopify_api_version: Shopify API version
    - is_active: Active status

    **Immutable fields (cannot be changed after creation):**
    - slug: Auto-generated identifier, set at creation
    - id: Primary key, immutable
    - is_platform: Platform tenant flag, set at creation
    - company_id: Auth0 mapping, set at creation

    **Automatic field updates:**
    - updated_at: Automatically updated to current timestamp

    **Validations:**
    - shopify_store_url: If provided, must start with http:// or https://
    - name: If provided, must be 1-100 characters
    - Cannot attempt to modify immutable fields

    Args:
        tenant_id: Tenant ID to update
        tenant_in: Update data (only provided fields will be updated)
        current_user: Current authenticated user (requires PATCH permission on /tenants/*)
        db: Database session

    Returns:
        200 OK with updated tenant including ID
        - TenantResponse includes: id, name, slug, company_id, shopify_store_url, 
          is_active, is_platform, created_at, updated_at

    Raises:
        HTTPException 404: If tenant not found
        HTTPException 400: If validation fails or attempting to modify immutable fields
        HTTPException 500: If update fails for unexpected reasons

    **Security Note**: shopify_access_token is sent as plaintext in the request body
    but is automatically encrypted by the Tenant model before storage in the database.
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
    current_user: User = Depends(require_permission("DELETE", "/tenants/*")),
    db: Session = Depends(get_database),
) -> None:
    """
    Deactivate (soft delete) a tenant.

    Marks the tenant as inactive (is_active=False) without deleting the record.
    This preserves all historical data (users, orders) for audit trails and reporting.

    **Access Control:**
    - Requires DELETE permission on /tenants/* route
    - Future: Will be restricted to SUPER_ADMIN only

    **Behavior:**
    - Tenant is marked inactive but remains in database
    - Users from this tenant cannot log in
    - Historical data is preserved for auditing
    - Cannot deactivate the VentIA platform tenant (is_platform=True)

    Args:
        tenant_id: Tenant ID to deactivate
        current_user: Current authenticated user (requires DELETE permission)
        db: Database session

    Returns:
        204 No Content: Tenant successfully deactivated (empty response body)

    Raises:
        HTTPException 404: If tenant with given ID not found
        HTTPException 400: If attempting to deactivate the platform tenant
        HTTPException 500: If deactivation fails for unexpected reasons

    **Example Request:**
    ```
    DELETE /tenants/5
    ```

    **Example Response:**
    ```
    204 No Content
    ```
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
