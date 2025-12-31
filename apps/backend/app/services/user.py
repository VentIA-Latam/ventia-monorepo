"""
User service - business logic for user management.
"""

import logging
from sqlalchemy.orm import Session

from app.core.permissions import Role
from app.models.user import User
from app.repositories.tenant import tenant_repository
from app.repositories.user import user_repository
from app.schemas.user import UserCreate, UserUpdate, UsersListResponse

logger = logging.getLogger(__name__)


class UserService:
    """Service for user-related business logic."""

    def get_user(self, db: Session, user_id: int) -> User | None:
        """Get user by ID."""
        return user_repository.get(db, user_id)

    def get_user_by_auth0_id(self, db: Session, auth0_user_id: str) -> User | None:
        """Get user by Auth0 user ID."""
        return user_repository.get_by_auth0_id(db, auth0_user_id)

    # ==================== LIST USERS ====================

    def list_users(
        self,
        db: Session,
        current_user: User,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: int | None = None,
        role: str | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> UsersListResponse | list[User]:
        """
        List users based on current user's role.

        SUPER_ADMIN: Gets all users with optional filters and metadata.
        Other roles: Gets users from their own tenant (no filters).

        Args:
            db: Database session
            current_user: Current authenticated user
            skip: Number to skip
            limit: Max results
            tenant_id: Filter by tenant (SUPER_ADMIN only)
            role: Filter by role as string (SUPER_ADMIN only, e.g., "ADMIN", "VIEWER")
            is_active: Filter by active status (SUPER_ADMIN only)
            search: Search term (SUPER_ADMIN only)

        Returns:
            For SUPER_ADMIN: UsersListResponse with metadata
            For others: list of User objects

        Raises:
            ValueError: If role string is invalid
        """
        # Parse role string to enum if provided
        parsed_role = None
        if role:
            try:
                parsed_role = Role[role.upper()]
            except KeyError:
                raise ValueError(f"Invalid role: {role}. Must be one of: {', '.join([r.name for r in Role])}")

        if current_user.role == Role.SUPER_ADMIN:
            # SUPER_ADMIN with advanced filters and metadata
            users, total = user_repository.get_all_with_filters(
                db,
                tenant_id=tenant_id,
                role=parsed_role,
                is_active=is_active,
                search=search,
                skip=skip,
                limit=limit,
            )
            return UsersListResponse(
                total=total,
                items=users,
                skip=skip,
                limit=limit,
            )
        else:
            # Other roles: only their tenant users
            return user_repository.get_by_tenant(
                db, current_user.tenant_id, skip=skip, limit=limit
            )

    # ==================== GET SINGLE USER ====================

    def get_user_for_access(self, db: Session, user_id: int, current_user: User) -> User:
        """
        Get user with access control based on role.

        SUPER_ADMIN: Can access any user.
        Other roles: Can only access users from their own tenant.

        Args:
            db: Database session
            user_id: User ID to retrieve
            current_user: Current authenticated user

        Returns:
            User object

        Raises:
            ValueError: If user not found or access denied
        """
        user = user_repository.get(db, user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # SUPER_ADMIN can access any user
        if current_user.role == Role.SUPER_ADMIN:
            return user

        # Other roles: verify same tenant
        if user.tenant_id != current_user.tenant_id:
            raise ValueError("Access denied to this user")

        return user

    # ==================== CREATE USER ====================

    def create_user_for_role(
        self,
        db: Session,
        user_in: UserCreate,
        current_user: User,
    ) -> User:
        """
        Create user with validations based on current user's role.

        SUPER_ADMIN:
        - Can create users in any tenant
        - Validates tenant exists and is active
        - Cannot create SUPER_ADMIN role users

        Other roles:
        - Can only create users in their own tenant
        - Cannot create SUPER_ADMIN role users

        Args:
            db: Database session
            user_in: User creation data
            current_user: Current authenticated user

        Returns:
            Created user

        Raises:
            ValueError: If validation fails
        """
        # === ROLE VALIDATION ===
        # No one can create SUPER_ADMIN users
        if user_in.role == Role.SUPER_ADMIN:
            raise ValueError("Cannot create users with SUPER_ADMIN role")

        # === TENANT VALIDATION ===
        if current_user.role == Role.SUPER_ADMIN:
            # SUPER_ADMIN: validate tenant exists and is active
            tenant = tenant_repository.get(db, user_in.tenant_id)
            if not tenant:
                raise ValueError(f"Tenant with ID {user_in.tenant_id} does not exist")
            if not tenant.is_active:
                raise ValueError(f"Tenant with ID {user_in.tenant_id} is not active")
        else:
            # Other roles: can only create in their own tenant
            if user_in.tenant_id != current_user.tenant_id:
                raise ValueError("Can only create users in your own tenant")

        # === UNIQUENESS VALIDATION ===
        # Email must be unique
        existing_user = user_repository.get_by_email(db, user_in.email)
        if existing_user:
            raise ValueError(f"User with email {user_in.email} already exists")

        # Auth0 ID must be unique
        existing_auth0_user = user_repository.get_by_auth0_id(db, user_in.auth0_user_id)
        if existing_auth0_user:
            raise ValueError(f"User with Auth0 ID {user_in.auth0_user_id} already exists")

        return user_repository.create(db, obj_in=user_in)

    # ==================== UPDATE USER ====================

    def update_user_for_role(
        self,
        db: Session,
        user_id: int,
        user_in: UserUpdate,
        current_user: User,
    ) -> tuple[User, str | None]:
        """
        Update user with role-based access control and validations.

        SUPER_ADMIN:
        - Can update any user from any tenant
        - Cannot deactivate themselves
        - Cannot change role to SUPER_ADMIN (already prevented in schema)

        Other roles:
        - Can only update users from their own tenant
        - Cannot deactivate users with SUPER_ADMIN or ADMIN role
        - Cannot change role to SUPER_ADMIN (already prevented in schema)

        For both:
        - Only name, role, is_active can be updated (email, auth0_user_id, tenant_id are immutable)
        - If role changes to inactive state, logs a warning and returns it

        Args:
            db: Database session
            user_id: User ID to update
            user_in: Update data (only name, role, is_active)
            current_user: Current authenticated user

        Returns:
            Tuple of (updated user, warning message or None)

        Raises:
            ValueError: If validation fails
        """
        # === VALIDATE USER EXISTS ===
        user = user_repository.get(db, user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # === VALIDATE ACCESS ===
        if current_user.role == Role.SUPER_ADMIN:
            # SUPER_ADMIN can update any user
            # But cannot deactivate themselves
            if user_in.is_active is False and user_id == current_user.id:
                raise ValueError("SUPER_ADMIN cannot deactivate themselves")
        else:
            # Other roles: only update users from their own tenant
            if user.tenant_id != current_user.tenant_id:
                raise ValueError("Can only update users in your own tenant")

            # Cannot deactivate SUPER_ADMIN users
            if user_in.is_active is False and user.role == Role.SUPER_ADMIN:
                raise ValueError("Cannot deactivate SUPER_ADMIN users")

            # Cannot deactivate ADMIN users (only other ADMINs in the tenant can)
            if user_in.is_active is False and user.role == Role.ADMIN:
                raise ValueError("Cannot deactivate ADMIN users")

            # Cannot deactivate themselves
            if user_in.is_active is False and user_id == current_user.id:
                raise ValueError("Cannot deactivate yourself")

        # === PREVENT SUPER_ADMIN ROLE ASSIGNMENT ===
        if user_in.role == Role.SUPER_ADMIN:
            raise ValueError("Cannot assign SUPER_ADMIN role to users")

        # === WARN IF ROLE CHANGED AND USER IS INACTIVE ===
        warning = None
        if user_in.role is not None and user_in.role != user.role:
            # Determine if user will be inactive after update
            will_be_inactive = user_in.is_active is False or (user_in.is_active is None and not user.is_active)
            
            if will_be_inactive:
                warning = f"User {user_id} role changed from {user.role.name} to {user_in.role.name}, but user is inactive"
                logger.warning(f"{warning} by {current_user.email}")

        # Update user with only allowed fields
        updated_user = user_repository.update(db, db_obj=user, obj_in=user_in)
        return updated_user, warning

    # ==================== DELETE USER ====================

    def delete_user_for_access(
        self,
        db: Session,
        user_id: int,
        current_user: User,
    ) -> User:
        """
        Deactivate user with access control based on role (soft delete).

        SUPER_ADMIN only: Can deactivate any user (except themselves).
        - Cannot deactivate the last active SUPER_ADMIN in the system
        - Verification ensures at least one active SUPER_ADMIN remains

        Args:
            db: Database session
            user_id: User ID to deactivate
            current_user: Current authenticated user

        Returns:
            Deactivated user (with is_active=False)

        Raises:
            ValueError: If validation fails
        """
        # === RESTRICT TO SUPER_ADMIN ONLY ===
        if current_user.role != Role.SUPER_ADMIN:
            raise ValueError("Only SUPER_ADMIN can deactivate users")

        # === PREVENT SELF-DEACTIVATION ===
        if user_id == current_user.id:
            raise ValueError("Cannot deactivate your own account")

        # === VERIFY USER EXISTS ===
        user = user_repository.get(db, user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # === PREVENT DEACTIVATING LAST ACTIVE SUPER_ADMIN ===
        if user.role == Role.SUPER_ADMIN:
            # Count active SUPER_ADMIN users (excluding the one being deactivated)
            active_superadmins = db.query(User).filter(
                User.role == Role.SUPER_ADMIN,
                User.is_active == True,
                User.id != user_id
            ).count()

            if active_superadmins == 0:
                raise ValueError("Cannot deactivate the last active SUPER_ADMIN in the system")

        # === PERFORM SOFT DELETE ===
        # Mark user as inactive instead of deleting from database
        user_in = UserUpdate(is_active=False)
        deactivated_user = user_repository.update(db, db_obj=user, obj_in=user_in)
        
        logger.info(f"User {user_id} deactivated by {current_user.email}")
        return deactivated_user

    # ==================== UTILITY METHODS ====================

    def get_users_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[User]:
        """Get all users for a tenant."""
        return user_repository.get_by_tenant(db, tenant_id, skip=skip, limit=limit)

    def get_all_users(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
    ) -> list[User]:
        """Get all users across all tenants (SUPER_ADMIN only)."""
        return user_repository.get_multi(db, skip=skip, limit=limit)

    def update_last_login(self, db: Session, user: User) -> User:
        """Update user's last login timestamp."""
        return user_repository.update_last_login(db, user=user)


# Global service instance
user_service = UserService()
