"""
User repository.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.permissions import Role
from app.models.user import User
from app.repositories.base import CRUDBase
from app.schemas.user import UserCreate, UserUpdate


class UserRepository(CRUDBase[User, UserCreate, UserUpdate]):
    """Repository for User model."""

    def get_by_auth0_id(self, db: Session, auth0_user_id: str) -> User | None:
        """
        Get user by Auth0 user ID (sub claim).

        Args:
            db: Database session
            auth0_user_id: Auth0 user ID (sub from JWT)

        Returns:
            User or None
        """
        return db.query(User).filter(User.auth0_user_id == auth0_user_id).first()

    def get_by_email(self, db: Session, email: str) -> User | None:
        """
        Get user by email.

        Args:
            db: Database session
            email: User email

        Returns:
            User or None
        """
        return db.query(User).filter(User.email == email).first()

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[User]:
        """
        Get all users for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results

        Returns:
            List of users
        """
        return (
            db.query(User)
            .filter(User.tenant_id == tenant_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_tenant_and_role(
        self,
        db: Session,
        tenant_id: int,
        role: Role,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[User]:
        """
        Get users by tenant and role.

        Args:
            db: Database session
            tenant_id: Tenant ID
            role: User role
            skip: Number to skip
            limit: Max results

        Returns:
            List of users
        """
        return (
            db.query(User)
            .filter(User.tenant_id == tenant_id, User.role == role)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_all_with_filters(
        self,
        db: Session,
        *,
        tenant_id: int | None = None,
        role: Role | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[User], int]:
        """
        Get all users with optional filters and tenant joins.

        Args:
            db: Database session
            tenant_id: Filter by specific tenant
            role: Filter by user role
            is_active: Filter by active status
            search: Search in name or email
            skip: Number to skip
            limit: Max results

        Returns:
            Tuple of (users list, total count)
        """
        query = db.query(User)

        # Apply filters
        if tenant_id is not None:
            query = query.filter(User.tenant_id == tenant_id)
        if role is not None:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                db.func.or_(
                    User.name.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                )
            )

        # Get total count before pagination
        total = query.count()

        # Apply ordering and pagination
        users = (
            query.order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return users, total

    def update_last_login(self, db: Session, *, user: User) -> User:
        """
        Update user's last login timestamp.

        Args:
            db: Database session
            user: User instance

        Returns:
            Updated user
        """
        user.last_login = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


# Global repository instance
user_repository = UserRepository(User)
