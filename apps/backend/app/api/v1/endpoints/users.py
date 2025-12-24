"""
User management endpoints (ADMIN only).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_database, require_role
from app.core.permissions import Role
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user import user_service

router = APIRouter()


@router.get("/", response_model=list[UserResponse], tags=["users"])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> list[UserResponse]:
    """
    List all users for current user's tenant.

    Only ADMIN can access this endpoint.
    Results are automatically filtered by tenant.

    Args:
        skip: Number of records to skip
        limit: Maximum records to return
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Returns:
        List of users
    """
    users = user_service.get_users_by_tenant(
        db,
        current_user.tenant_id,
        skip=skip,
        limit=limit,
    )
    return users


@router.get("/{user_id}", response_model=UserResponse, tags=["users"])
async def get_user(
    user_id: int,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> UserResponse:
    """
    Get user by ID.

    Only ADMIN can access this endpoint.
    Can only view users from their own tenant.

    Args:
        user_id: User ID
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Returns:
        User details

    Raises:
        HTTPException: If user not found or access denied
    """
    user = user_service.get_user(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    # Verify user belongs to same tenant
    if user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user",
        )

    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["users"])
async def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> UserResponse:
    """
    Create a new user.

    Only ADMIN can create users.
    New user will be created in the same tenant as the admin.

    Args:
        user_in: User creation data
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Returns:
        Created user

    Raises:
        HTTPException: If user already exists or validation fails
    """
    # Ensure user is created in admin's tenant
    if user_in.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only create users in your own tenant",
        )

    try:
        user = user_service.create_user(db, user_in)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{user_id}", response_model=UserResponse, tags=["users"])
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> UserResponse:
    """
    Update user.

    Only ADMIN can update users.
    Can only update users from their own tenant.

    Args:
        user_id: User ID to update
        user_in: Update data
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Returns:
        Updated user

    Raises:
        HTTPException: If user not found or access denied
    """
    # Get user to verify tenant
    user = user_service.get_user(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    # Verify user belongs to same tenant
    if user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user",
        )

    try:
        updated_user = user_service.update_user(db, user_id, user_in)
        return updated_user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> None:
    """
    Delete user.

    Only ADMIN can delete users.
    Can only delete users from their own tenant.

    Args:
        user_id: User ID to delete
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Raises:
        HTTPException: If user not found or access denied
    """
    # Get user to verify tenant
    user = user_service.get_user(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    # Verify user belongs to same tenant
    if user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user",
        )

    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    try:
        user_service.delete_user(db, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
