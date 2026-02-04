"""
Tenant management endpoints.

These endpoints allow ADMIN users to manage tenant (client company) configurations,
including unified e-commerce settings (Shopify/WooCommerce).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_permission_dual
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


@router.get("", response_model=TenantListResponse, tags=["tenants"])
async def list_tenants(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_permission_dual("GET", "/tenants")),
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
        - ecommerce_settings: E-commerce configuration (platform, store_url, sync_on_validation, has_credentials)
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
            items=[TenantResponse.from_tenant(t) for t in tenants],
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
    current_user: User = Depends(require_permission_dual("GET", "/tenants/*")),
    db: Session = Depends(get_database),
) -> TenantDetailResponse:
    """
    Get detailed tenant information with statistics.

    Returns comprehensive tenant information including:
    - Basic tenant data: id, name, slug, company_id, is_active, is_platform
    - E-commerce settings: platform, store_url, sync_on_validation, has_credentials
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

    # Build response with sanitized ecommerce_settings
    base_response = TenantResponse.from_tenant(tenant)
    return TenantDetailResponse(
        **base_response.model_dump(),
        user_count=stats["user_count"],
        order_count=stats["order_count"],
    )


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED, tags=["tenants"])
async def create_tenant(
    tenant_in: TenantCreate,
    current_user: User = Depends(require_permission_dual("POST", "/tenants")),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Create a new tenant.

    **Request Body:**
    - name: Company name (required, max 100 chars)
    - slug: URL-friendly identifier in kebab-case (optional - auto-generated as "name-outlet" if not provided)
    - company_id: Auth0 organization mapping ID (optional)
    
    **E-commerce Configuration (optional):**
    - ecommerce_platform: "shopify" | "woocommerce" | None
    - ecommerce_store_url: Store URL (required if platform is set)
    - shopify_client_id: Shopify OAuth2 client ID (only for Shopify, will be encrypted)
    - shopify_client_secret: Shopify OAuth2 client secret (only for Shopify, will be encrypted)
    - shopify_api_version: Shopify API version (default: '2025-10')
    - ecommerce_consumer_key: WooCommerce consumer key (only for WooCommerce, will be encrypted)
    - ecommerce_consumer_secret: WooCommerce consumer secret (only for WooCommerce, will be encrypted)
    - sync_on_validation: Whether to sync to e-commerce when validating payment (default: True)

    **Auto-generated slug:**
    - If slug is not provided, it will be auto-generated as "{name-in-kebab-case}-outlet"
    - Examples:
      - name: "My Company" → slug: "my-company-outlet"
      - name: "Test_123" → slug: "test-123-outlet"
    - The generated slug must be unique (validated by the system)

    **Validations:**
    - name: Must be 1-100 characters
    - slug: If provided, must be unique and in kebab-case format (lowercase alphanumeric with hyphens)
    - ecommerce_store_url: Must start with http:// or https:// (required if platform is set)
    - Cannot mix Shopify and WooCommerce credentials

    **Defaults:**
    - is_platform: Always False (new tenants are clients, not platform)
    - is_active: Always True
    - sync_on_validation: True if not provided

    **Returns:**
    - 201 Created with the created tenant including its ID
    - TenantResponse includes: id, name, slug, company_id, is_active, is_platform, 
      ecommerce_settings, created_at, updated_at

    **Raises:**
    - 400: If slug already exists, validation fails, or invalid request data
    - 500: If creation fails for unexpected reasons

    **Security Note**: All e-commerce credentials are sent as plaintext in the request body
    but are automatically encrypted before storage in the settings JSON field.
    """
    try:
        created_tenant = await tenant_service.create_tenant(db, tenant_in)
        return TenantResponse.from_tenant(created_tenant)
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
    current_user: User = Depends(require_permission_dual("PUT", "/tenants/*")),
    db: Session = Depends(get_database),
) -> TenantResponse:
    """
    Update tenant configuration.

    **Updatable fields:**
    - name: Company name (max 100 chars)
    - is_active: Active status
    
    **E-commerce Configuration:**
    - ecommerce_platform: "shopify" | "woocommerce" | None (change platform)
    - ecommerce_store_url: Store URL
    - shopify_client_id: Shopify OAuth2 client ID (will be encrypted)
    - shopify_client_secret: Shopify OAuth2 client secret (will be encrypted)
    - shopify_api_version: Shopify API version
    - ecommerce_consumer_key: WooCommerce consumer key (will be encrypted)
    - ecommerce_consumer_secret: WooCommerce consumer secret (will be encrypted)
    - sync_on_validation: Sync to e-commerce on payment validation

    **Immutable fields (cannot be changed after creation):**
    - slug: Auto-generated identifier, set at creation
    - id: Primary key, immutable
    - is_platform: Platform tenant flag, set at creation
    - company_id: Auth0 mapping, set at creation

    **Automatic field updates:**
    - updated_at: Automatically updated to current timestamp

    **Validations:**
    - ecommerce_store_url: If provided, must start with http:// or https://
    - name: If provided, must be 1-100 characters
    - Cannot mix Shopify and WooCommerce credentials

    Args:
        tenant_id: Tenant ID to update
        tenant_in: Update data (only provided fields will be updated)
        current_user: Current authenticated user (requires PATCH permission on /tenants/*)
        db: Database session

    Returns:
        200 OK with updated tenant including ID
        - TenantResponse includes: id, name, slug, company_id, 
          is_active, is_platform, ecommerce_settings, created_at, updated_at

    Raises:
        HTTPException 404: If tenant not found
        HTTPException 400: If validation fails or attempting to modify immutable fields
        HTTPException 500: If update fails for unexpected reasons

    **Security Note**: E-commerce credentials are sent as plaintext in the request body
    but are automatically encrypted before storage in the settings JSON field.
    """
    try:
        updated_tenant = await tenant_service.update_tenant(db, tenant_id, tenant_in)

        if not updated_tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant {tenant_id} not found",
            )

        return TenantResponse.from_tenant(updated_tenant)
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
    current_user: User = Depends(require_permission_dual("DELETE", "/tenants/*")),
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
