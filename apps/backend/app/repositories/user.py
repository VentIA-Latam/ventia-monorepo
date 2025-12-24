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
