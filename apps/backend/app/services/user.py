"""
User service - business logic for user management.
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user import user_repository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """Service for user-related business logic."""

    def get_user(self, db: Session, user_id: int) -> User | None:
        """Get user by ID."""
        return user_repository.get(db, user_id)

    def get_user_by_auth0_id(self, db: Session, auth0_user_id: str) -> User | None:
        """Get user by Auth0 user ID."""
        return user_repository.get_by_auth0_id(db, auth0_user_id)

    def get_users_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[User]:
        """Get all users for a tenant."""
        return user_repository.get_by_tenant(db, tenant_id, skip=skip, limit=limit)

    def create_user(self, db: Session, user_in: UserCreate) -> User:
        """
        Create a new user.

        Args:
            db: Database session
            user_in: User creation data

        Returns:
            Created user

        Raises:
            ValueError: If user with email or auth0_user_id already exists
        """
        # Check if user with email already exists
        existing_user = user_repository.get_by_email(db, user_in.email)
        if existing_user:
            raise ValueError(f"User with email {user_in.email} already exists")

        # Check if user with auth0_user_id already exists
        existing_auth0_user = user_repository.get_by_auth0_id(db, user_in.auth0_user_id)
        if existing_auth0_user:
            raise ValueError(f"User with Auth0 ID {user_in.auth0_user_id} already exists")

        return user_repository.create(db, obj_in=user_in)

    def update_user(
        self,
        db: Session,
        user_id: int,
        user_in: UserUpdate,
    ) -> User:
        """
        Update user.

        Args:
            db: Database session
            user_id: User ID to update
            user_in: Update data

        Returns:
            Updated user

        Raises:
            ValueError: If user not found or email already exists
        """
        user = user_repository.get(db, user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # If updating email, check it's not taken
        if user_in.email and user_in.email != user.email:
            existing = user_repository.get_by_email(db, user_in.email)
            if existing:
                raise ValueError(f"Email {user_in.email} already in use")

        return user_repository.update(db, db_obj=user, obj_in=user_in)

    def delete_user(self, db: Session, user_id: int) -> User:
        """
        Delete user.

        Args:
            db: Database session
            user_id: User ID to delete

        Returns:
            Deleted user

        Raises:
            ValueError: If user not found
        """
        user = user_repository.get(db, user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        return user_repository.delete(db, id=user_id)

    def update_last_login(self, db: Session, user: User) -> User:
        """Update user's last login timestamp."""
        return user_repository.update_last_login(db, user=user)


# Global service instance
user_service = UserService()
