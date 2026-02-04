"""
API Key repository - database operations for API keys.
"""

from sqlalchemy.orm import Session

from app.models.api_key import APIKey
from app.repositories.base import CRUDBase
from app.schemas.api_key import APIKeyCreate, APIKeyUpdate


class APIKeyRepository(CRUDBase[APIKey, APIKeyCreate, APIKeyUpdate]):
    """Repository for API key database operations."""

    def get_by_key_prefix(self, db: Session, key_prefix: str) -> APIKey | None:
        """
        Get API key by its prefix.

        Args:
            db: Database session
            key_prefix: First 12 characters of the key

        Returns:
            API key or None if not found
        """
        return db.query(APIKey).filter(APIKey.key_prefix == key_prefix).first()

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
    ) -> list[APIKey]:
        """
        Get all API keys across all tenants (SUPERADMIN only).

        Args:
            db: Database session
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            is_active: Optional filter by active status

        Returns:
            List of API keys
        """
        query = db.query(APIKey)

        if is_active is not None:
            query = query.filter(APIKey.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    def count_all(
        self,
        db: Session,
        is_active: bool | None = None,
    ) -> int:
        """
        Count total API keys across all tenants (SUPERADMIN only).

        Args:
            db: Database session
            is_active: Optional filter by active status

        Returns:
            Total count
        """
        query = db.query(APIKey)

        if is_active is not None:
            query = query.filter(APIKey.is_active == is_active)

        return query.count()

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
    ) -> list[APIKey]:
        """
        Get all API keys for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID to filter by
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            is_active: Optional filter by active status

        Returns:
            List of API keys
        """
        query = db.query(APIKey).filter(APIKey.tenant_id == tenant_id)

        if is_active is not None:
            query = query.filter(APIKey.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    def count_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        is_active: bool | None = None,
    ) -> int:
        """
        Count total API keys for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            is_active: Optional filter by active status

        Returns:
            Total count
        """
        query = db.query(APIKey).filter(APIKey.tenant_id == tenant_id)

        if is_active is not None:
            query = query.filter(APIKey.is_active == is_active)

        return query.count()

    def check_name_exists(
        self,
        db: Session,
        tenant_id: int,
        name: str,
        exclude_id: int | None = None,
    ) -> bool:
        """
        Check if an API key with the given name already exists in the tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            name: API key name to check
            exclude_id: Optional API key ID to exclude (for updates)

        Returns:
            True if name exists, False otherwise
        """
        query = db.query(APIKey).filter(
            APIKey.tenant_id == tenant_id,
            APIKey.name == name,
        )

        if exclude_id is not None:
            query = query.filter(APIKey.id != exclude_id)

        return query.first() is not None


# Create singleton instance
api_key_repository = APIKeyRepository(APIKey)
