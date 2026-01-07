"""
API Key service - business logic for API key management.
"""

import secrets
import uuid
from datetime import datetime

import bcrypt
from sqlalchemy.orm import Session

from app.core.permissions import Role
from app.models.api_key import APIKey
from app.models.tenant import Tenant
from app.repositories.api_key import api_key_repository
from app.schemas.api_key import APIKeyCreate, APIKeyUpdate


class APIKeyService:
    """Service for API key-related business logic."""

    def generate_api_key(self) -> str:
        """
        Generate a new API key with format: vnt_{uuid8}_{random}.

        The UUID ensures uniqueness of the key prefix.

        Returns:
            Complete API key string
        """
        # Generate 8-character hex UUID for unique prefix
        unique_id = uuid.uuid4().hex[:8]
        # Generate 24 random URL-safe characters for security
        random_part = secrets.token_urlsafe(24)
        return f"vnt_{unique_id}_{random_part}"

    def hash_key(self, key: str) -> str:
        """
        Hash an API key using bcrypt.

        Args:
            key: Plain text API key

        Returns:
            Hashed key
        """
        key_bytes = key.encode('utf-8')
        hashed = bcrypt.hashpw(key_bytes, bcrypt.gensalt())
        return hashed.decode('utf-8')

    def verify_key(self, plain_key: str, hashed_key: str) -> bool:
        """
        Verify a plain API key against its hash.

        Args:
            plain_key: Plain text key
            hashed_key: Hashed key from database

        Returns:
            True if key matches, False otherwise
        """
        try:
            return bcrypt.checkpw(
                plain_key.encode('utf-8'),
                hashed_key.encode('utf-8')
            )
        except Exception:
            return False

    def extract_prefix(self, key: str) -> str:
        """
        Extract first 12 characters from API key for identification.

        Args:
            key: Complete API key

        Returns:
            First 12 characters
        """
        return key[:12]

    def create_api_key(
        self,
        db: Session,
        api_key_in: APIKeyCreate,
        tenant_id: int,
        created_by_user_id: int,
    ) -> tuple[APIKey, str]:
        """
        Create a new API key.

        Args:
            db: Database session
            api_key_in: API key creation data
            tenant_id: Tenant ID this key belongs to
            created_by_user_id: ID of user creating the key

        Returns:
            Tuple of (APIKey model, plain_text_key)

        Raises:
            ValueError: If name already exists in tenant or role is SUPER_ADMIN
        """
        # Validation: Cannot create SUPER_ADMIN API keys
        if api_key_in.role == Role.SUPER_ADMIN:
            raise ValueError("Cannot create API keys with SUPER_ADMIN role")

        # Check if name already exists for this tenant
        if api_key_repository.check_name_exists(db, tenant_id, api_key_in.name):
            raise ValueError(
                f"API key with name '{api_key_in.name}' already exists for this tenant"
            )

        # Generate API key
        plain_key = self.generate_api_key()
        key_hash = self.hash_key(plain_key)
        key_prefix = self.extract_prefix(plain_key)

        # Create database object
        db_obj = APIKey(
            key_hash=key_hash,
            key_prefix=key_prefix,
            name=api_key_in.name,
            tenant_id=tenant_id,
            role=api_key_in.role,
            expires_at=api_key_in.expires_at,
            created_by_user_id=created_by_user_id,
            is_active=True,
        )

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        # Return both the database object and the plain key
        # Plain key should only be shown ONCE to the user
        return db_obj, plain_key

    def get_api_key(self, db: Session, api_key_id: int) -> APIKey | None:
        """Get API key by ID."""
        return api_key_repository.get(db, api_key_id)

    def get_api_key_by_prefix(self, db: Session, key_prefix: str) -> APIKey | None:
        """Get API key by prefix."""
        return api_key_repository.get_by_key_prefix(db, key_prefix)

    def get_api_keys_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
    ) -> list[APIKey]:
        """Get all API keys for a tenant."""
        return api_key_repository.get_by_tenant(
            db,
            tenant_id,
            skip=skip,
            limit=limit,
            is_active=is_active,
        )

    def count_api_keys_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        is_active: bool | None = None,
    ) -> int:
        """Count API keys for a tenant."""
        return api_key_repository.count_by_tenant(db, tenant_id, is_active=is_active)

    def update_api_key(
        self,
        db: Session,
        api_key: APIKey,
        api_key_update: APIKeyUpdate,
    ) -> APIKey:
        """
        Update an API key.

        Args:
            db: Database session
            api_key: Existing API key to update
            api_key_update: Update data

        Returns:
            Updated API key

        Raises:
            ValueError: If new name conflicts with existing key
        """
        # Check name conflict if name is being changed
        if api_key_update.name and api_key_update.name != api_key.name:
            if api_key_repository.check_name_exists(
                db,
                api_key.tenant_id,
                api_key_update.name,
                exclude_id=api_key.id,
            ):
                raise ValueError(
                    f"API key with name '{api_key_update.name}' already exists for this tenant"
                )

        # Update the key
        return api_key_repository.update(db, db_obj=api_key, obj_in=api_key_update)

    def revoke_api_key(self, db: Session, api_key: APIKey) -> APIKey:
        """
        Revoke (deactivate) an API key.

        Args:
            db: Database session
            api_key: API key to revoke

        Returns:
            Updated API key with is_active=False
        """
        api_key.is_active = False
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        return api_key

    def verify_and_get_api_key(
        self,
        db: Session,
        plain_key: str,
    ) -> APIKey | None:
        """
        Verify an API key and return it if valid.

        Args:
            db: Database session
            plain_key: Plain text API key from request

        Returns:
            APIKey if valid and active, None otherwise
        """
        # Extract prefix and find key
        key_prefix = self.extract_prefix(plain_key)
        api_key = self.get_api_key_by_prefix(db, key_prefix)

        if not api_key:
            return None

        # Check if key is active
        if not api_key.is_active:
            return None

        # Check if key is expired
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None

        # Verify hash
        if not self.verify_key(plain_key, api_key.key_hash):
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.utcnow()
        db.add(api_key)
        db.commit()

        return api_key


# Create singleton instance
api_key_service = APIKeyService()
