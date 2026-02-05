"""
Invoice Series endpoints.

Endpoints for managing invoice series (series numbers for factura, boleta, NC, ND).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_permission_dual
from app.models.user import User
from app.repositories.invoice_serie import invoice_serie_repository
from app.schemas.invoice import InvoiceSerieCreate, InvoiceSerieResponse, InvoiceSerieUpdate
from app.services.invoice_serie import invoice_serie_service
from app.core.permissions import Role

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "",
    response_model=InvoiceSerieResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["invoice-series"],
)
async def create_invoice_serie(
    serie_data: InvoiceSerieCreate,
    current_user: User = Depends(require_permission_dual("POST", "/invoice-series")),
    tenant_id: int | None = None,
    db: Session = Depends(get_database),
) -> InvoiceSerieResponse:
    """
    Create a new invoice series for a tenant.

    - **ADMIN users**: Can only create series for their own tenant (tenant_id parameter ignored)
    - **SUPERADMIN users**: Can create series for any tenant (optionally specify tenant_id)

    Each series has its own correlativo counter for generating sequential invoice numbers.

    **Permissions:** Requires ADMIN or SUPERADMIN role

    **Request Body:**
    - `invoice_type`: Type of invoice (01=Factura, 03=Boleta, 07=Nota de Crédito, 08=Nota de Débito)
    - `serie`: Series code (4 characters, e.g., "F001", "B001", "NC01", "ND01")
    - `description`: (Optional) Human-readable description
    - `is_active`: (Optional) Whether series is active (defaults to True)

    **Query Parameters:**
    - `tenant_id` (optional): Target tenant ID (SUPERADMIN only)

    **Validations:**
    - Serie must be 4 alphanumeric characters
    - Serie must not already exist for target tenant
    - invoice_type must be valid (01, 03, 07, 08)
    - ADMIN cannot create for other tenants

    **Response:**
    Returns the created InvoiceSerieResponse with:
    - `id`: Serie ID
    - `tenant_id`: Tenant ID
    - `serie`: Series code
    - `invoice_type`: Invoice type
    - `last_correlativo`: Initial correlativo (0)
    - `is_active`: Active status
    - `created_at`: Creation timestamp
    - `updated_at`: Last update timestamp

    **Examples:**
    - ADMIN creates for their tenant: `POST /api/v1/invoice-series` with body
    - SUPERADMIN creates for any tenant: `POST /api/v1/invoice-series?tenant_id=3` with body

    **Error Handling:**
    - `400 Bad Request`: Invalid serie format, duplicate serie, invalid invoice_type
    - `401 Unauthorized`: User not authenticated
    - `403 Forbidden`: ADMIN trying to create for different tenant
    - `500 Internal Server Error`: Failed to create serie

    Args:
        serie_data: InvoiceSerieCreate schema
        current_user: Current authenticated user (must be ADMIN or SUPERADMIN)
        tenant_id: (Optional) Target tenant ID (SUPERADMIN only)
        db: Database session

    Returns:
        InvoiceSerieResponse: Created serie

    Raises:
        HTTPException: Various 4xx/5xx errors as detailed above
    """
    try:
        # Determine target tenant
        if current_user.role == Role.SUPERADMIN:
            # SUPERADMIN can create for any tenant
            target_tenant_id = tenant_id if tenant_id else current_user.tenant_id
        else:
            # ADMIN can only create for their own tenant
            if tenant_id is not None and tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create series for your own tenant",
                )
            target_tenant_id = current_user.tenant_id

        # Create the serie using the service
        serie = invoice_serie_service.create_serie(
            db=db,
            tenant_id=target_tenant_id,
            serie_data=serie_data,
        )

        logger.info(
            f"Invoice serie {serie.serie} (type {serie.invoice_type}) created "
            f"for tenant {target_tenant_id} by user {current_user.id} ({current_user.role})"
        )

        return InvoiceSerieResponse.from_orm(serie)

    except ValueError as e:
        logger.warning(
            f"Validation error creating serie: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            f"Error creating invoice serie: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice serie: {str(e)}",
        )


@router.get(
    "",
    response_model=list[InvoiceSerieResponse],
    tags=["invoice-series"],
)
async def list_invoice_series(
    current_user: User = Depends(get_current_user),
    tenant_id: int | None = None,
    db: Session = Depends(get_database),
) -> list[InvoiceSerieResponse]:
    """
    List invoice series for current user or specific tenant (SUPERADMIN only).

    - **Non-SUPERADMIN users**: Lists series for their own tenant (tenant_id parameter ignored)
    - **SUPERADMIN users**: Lists all series, optionally filtered by tenant_id

    This endpoint retrieves invoice series (factura, boleta, NC, ND) 
    that can be used to generate invoices.

    **Permissions:** Requires authentication (all authenticated users)

    **Query Parameters:**
    - `tenant_id` (optional): Filter series by tenant ID (SUPERADMIN only)

    **Response:**
    Returns a list of InvoiceSerieResponse objects with:
    - `id`: Serie ID
    - `tenant_id`: Tenant ID (for verification)
    - `serie`: Serie code (4 characters, e.g., "F001", "B001")
    - `invoice_type`: Type of invoice (01=Factura, 03=Boleta, 07=NC, 08=ND)
    - `last_correlativo`: Last used correlativo number
    - `is_active`: Whether the serie is active
    - `created_at`: Creation timestamp
    - `updated_at`: Last update timestamp

    **Examples:**
    - Non-SUPERADMIN: `GET /api/v1/invoice-series` → lists their tenant's series
    - SUPERADMIN (all): `GET /api/v1/invoice-series` → lists all series
    - SUPERADMIN (filtered): `GET /api/v1/invoice-series?tenant_id=2` → lists series for tenant 2

    **Error Handling:**
    - `400 Bad Request`: Invalid request (e.g., non-SUPERADMIN with tenant_id parameter)
    - `401 Unauthorized`: User not authenticated
    - `500 Internal Server Error`: Failed to retrieve series

    Args:
        current_user: Current authenticated user
        tenant_id: (Optional) Tenant ID to filter (SUPERADMIN only)
        db: Database session

    Returns:
        list[InvoiceSerieResponse]: List of invoice series

    Raises:
        HTTPException: 400 if invalid, 401 if not authenticated, 500 on server error
    """
    try:
        # Determine which tenant_id to use
        if current_user.role == Role.SUPERADMIN:
            # SUPERADMIN can filter by any tenant or see all
            filter_tenant_id = tenant_id
        else:
            # Non-SUPERADMIN can only see their own tenant
            if tenant_id is not None and tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view series for your own tenant",
                )
            filter_tenant_id = current_user.tenant_id

        # Get series based on filter
        if filter_tenant_id:
            # Get series for specific tenant
            series = invoice_serie_service.get_series_by_tenant(
                db=db,
                tenant_id=filter_tenant_id,
            )
            logger.info(
                f"Retrieved {len(series)} invoice series for tenant {filter_tenant_id} "
                f"by user {current_user.id} ({current_user.role})"
            )
        else:
            # SUPERADMIN getting all series from all tenants
            from app.repositories.invoice_serie import invoice_serie_repository
            series = invoice_serie_repository.get_all(db)
            logger.info(
                f"Retrieved {len(series)} invoice series from all tenants "
                f"by user {current_user.id} ({current_user.role})"
            )

        # Convert to response models
        return [InvoiceSerieResponse.from_orm(s) for s in series]

    except ValueError as e:
        logger.warning(
            f"Validation error retrieving series: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            f"Error retrieving invoice series: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoice series: {str(e)}",
        )


@router.get(
    "/{serie_id}",
    response_model=InvoiceSerieResponse,
    tags=["invoice-series"],
)
async def get_invoice_serie(
    serie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> InvoiceSerieResponse:
    """
    Get a specific invoice series by ID.

    - **Non-SUPERADMIN users**: Can only view series from their own tenant
    - **SUPERADMIN users**: Can view any series

    **Permissions:** Requires authentication

    **Path Parameters:**
    - `serie_id`: Invoice series ID

    **Response:**
    Returns InvoiceSerieResponse with:
    - `id`: Serie ID
    - `tenant_id`: Tenant ID
    - `serie`: Series code
    - `invoice_type`: Invoice type
    - `last_correlativo`: Current correlativo
    - `is_active`: Active status
    - `created_at`: Creation timestamp
    - `updated_at`: Last update timestamp

    **Error Handling:**
    - `401 Unauthorized`: User not authenticated
    - `403 Forbidden`: User doesn't have access to this serie's tenant
    - `404 Not Found`: Serie not found

    Args:
        serie_id: Serie ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceSerieResponse: Serie details

    Raises:
        HTTPException: 401/403/404/500 errors
    """
    try:
        # Get serie by ID
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice serie {serie_id} not found",
            )

        # Validate access: non-SUPERADMIN can only access their own tenant
        if current_user.role != Role.SUPERADMIN:
            if serie.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view series from your own tenant",
                )

        logger.info(
            f"Retrieved invoice serie {serie_id} by user {current_user.id} ({current_user.role})"
        )

        return InvoiceSerieResponse.from_orm(serie)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error retrieving invoice serie {serie_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoice serie: {str(e)}",
        )


@router.patch(
    "/{serie_id}",
    response_model=InvoiceSerieResponse,
    tags=["invoice-series"],
)
async def update_invoice_serie(
    serie_id: int,
    serie_update: InvoiceSerieUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/invoice-series/*")),
    db: Session = Depends(get_database),
) -> InvoiceSerieResponse:
    """
    Update an invoice series.

    Only `description` and `is_active` fields can be updated.
    Series code and invoice type cannot be changed after creation.

    - **ADMIN users**: Can only update series from their own tenant
    - **SUPERADMIN users**: Can update any series

    **Permissions:** Requires ADMIN or SUPERADMIN role

    **Path Parameters:**
    - `serie_id`: Invoice series ID

    **Request Body (InvoiceSerieUpdate):**
    - `description` (optional): Human-readable description
    - `is_active` (optional): Whether series is active

    **Response:**
    Returns updated InvoiceSerieResponse

    **Error Handling:**
    - `400 Bad Request`: Validation error
    - `401 Unauthorized`: User not authenticated
    - `403 Forbidden`: User doesn't have access to this serie's tenant
    - `404 Not Found`: Serie not found

    Args:
        serie_id: Serie ID
        serie_update: InvoiceSerieUpdate schema
        current_user: Current authenticated user (must be ADMIN or SUPERADMIN)
        db: Database session

    Returns:
        InvoiceSerieResponse: Updated serie

    Raises:
        HTTPException: 400/401/403/404/500 errors
    """
    try:
        # Get serie by ID
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice serie {serie_id} not found",
            )

        # Validate access: non-SUPERADMIN can only update their own tenant
        if current_user.role != Role.SUPERADMIN:
            if serie.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only update series from your own tenant",
                )

        # Use service to update (handles validation)
        updated_serie = invoice_serie_service.update_serie(
            db=db,
            serie_id=serie_id,
            tenant_id=serie.tenant_id,
            serie_data=serie_update,
        )

        logger.info(
            f"Updated invoice serie {serie_id} by user {current_user.id} ({current_user.role})"
        )

        return InvoiceSerieResponse.from_orm(updated_serie)

    except ValueError as e:
        logger.warning(f"Validation error updating serie {serie_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error updating invoice serie {serie_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update invoice serie: {str(e)}",
        )


@router.delete(
    "/{serie_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["invoice-series"],
)
async def delete_invoice_serie(
    serie_id: int,
    current_user: User = Depends(require_permission_dual("DELETE", "/invoice-series/*")),
    db: Session = Depends(get_database),
):
    """
    Delete an invoice series.

    Series can only be deleted if they have not been used (last_correlativo == 0).
    If the series has been used, it will be deactivated instead of deleted.

    - **ADMIN users**: Can only delete series from their own tenant
    - **SUPERADMIN users**: Can delete any series

    **Permissions:** Requires ADMIN or SUPERADMIN role

    **Path Parameters:**
    - `serie_id`: Invoice series ID

    **Response:**
    Returns 204 No Content on success

    **Behavior:**
    - If `last_correlativo == 0`: Hard delete (removes from database)
    - If `last_correlativo > 0`: Soft delete (sets `is_active = False`)

    **Error Handling:**
    - `401 Unauthorized`: User not authenticated
    - `403 Forbidden`: User doesn't have access to this serie's tenant
    - `404 Not Found`: Serie not found

    Args:
        serie_id: Serie ID
        current_user: Current authenticated user (must be ADMIN or SUPERADMIN)
        db: Database session

    Raises:
        HTTPException: 401/403/404/500 errors
    """
    try:
        # Get serie by ID
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice serie {serie_id} not found",
            )

        # Validate access: non-SUPERADMIN can only delete their own tenant
        if current_user.role != Role.SUPERADMIN:
            if serie.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only delete series from your own tenant",
                )

        # Check if series has been used
        if serie.last_correlativo > 0:
            # Soft delete: deactivate the series
            invoice_serie_service.deactivate_serie(
                db=db,
                serie_id=serie_id,
                tenant_id=serie.tenant_id,
            )
            logger.info(
                f"Soft-deleted (deactivated) invoice serie {serie_id} "
                f"(had {serie.last_correlativo} invoices) "
                f"by user {current_user.id} ({current_user.role})"
            )
        else:
            # Hard delete: remove from database
            invoice_serie_repository.delete(db, id=serie_id)
            logger.info(
                f"Hard-deleted invoice serie {serie_id} "
                f"by user {current_user.id} ({current_user.role})"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error deleting invoice serie {serie_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete invoice serie: {str(e)}",
        )
