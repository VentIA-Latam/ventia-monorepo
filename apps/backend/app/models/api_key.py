"""
APIKey model - represents API keys for external integrations (e.g., n8n).
"""

from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.permissions import Role
from app.models.base import Base, TimestampMixin


class APIKey(Base, TimestampMixin):
    """
    APIKey model - allows authentication via API key instead of JWT token.

    API keys are scoped to a tenant and have a specific role.
    They are useful for external integrations like n8n workflows.
    """

    __tablename__ = "api_keys"

    # Key data (hashed for security)
    key_hash = Column(
        String(255),
        nullable=False,
        comment="Hashed API key using bcrypt (never store plain text)",
    )
    key_prefix = Column(
        String(12),
        unique=True,
        index=True,
        nullable=False,
        comment="First 12 characters of the key (vnt_{uuid8}) for unique identification",
    )

    # Descriptive info
    name = Column(
        String(100),
        nullable=False,
        comment="Human-readable name for the API key (e.g., 'n8n-production')",
    )

    # Tenant association
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this API key belongs to",
    )
    tenant = relationship("Tenant", back_populates="api_keys")

    # Role and permissions
    role = Column(
        SQLEnum(Role),
        nullable=False,
        index=True,
        comment="Role associated with this API key (ADMIN, LOGISTICA, VENTAS, VIEWER)",
    )

    # Status and tracking
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether the API key is active (can be revoked)",
    )
    last_used_at = Column(
        DateTime,
        nullable=True,
        comment="Last time this API key was used",
    )
    expires_at = Column(
        DateTime,
        nullable=True,
        comment="Expiration date (optional, null means no expiration)",
    )

    # Audit trail
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who created this API key",
    )
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    # Constraint: name must be unique per tenant
    __table_args__ = (
        UniqueConstraint(
            "name",
            "tenant_id",
            name="uq_api_key_name_tenant",
        ),
    )

    def __repr__(self) -> str:
        """String representation of APIKey."""
        return f"<APIKey(id={self.id}, name='{self.name}', prefix='{self.key_prefix}', tenant_id={self.tenant_id})>"
