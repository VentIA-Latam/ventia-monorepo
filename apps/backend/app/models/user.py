"""
User model - represents users with Auth0 authentication.
"""

from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.permissions import Role
from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """
    User model - linked to Auth0 user and belongs to a tenant.

    Users are authenticated via Auth0 and have a role that determines their permissions.
    """

    __tablename__ = "users"

    # Auth0 info
    auth0_user_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        comment="Auth0 user ID (sub claim from JWT)",
    )
    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        comment="User email address",
    )
    name = Column(String, nullable=True, comment="User full name")

    # Multitenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant (company) this user belongs to",
    )
    tenant = relationship("Tenant", back_populates="users")

    # Role and permissions
    role = Column(
        SQLEnum(Role),
        default=Role.VIEWER,
        nullable=False,
        index=True,
        comment="User role (ADMIN, LOGISTICA, VENTAS, VIEWER)",
    )

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False, comment="Is user active")
    last_login = Column(DateTime, nullable=True, comment="Last login timestamp")

    # Chatwoot integration (for SSO)
    chatwoot_user_id = Column(
        Integer,
        nullable=True,
        index=True,
        comment="Chatwoot user ID for SSO login",
    )
    chatwoot_account_id = Column(
        Integer,
        nullable=True,
        index=True,
        comment="Chatwoot account ID for SSO login",
    )

    def __repr__(self) -> str:
        """String representation of User."""
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
