"""
Tenant (Company) model - represents a client company with their own Shopify store.
"""

from sqlalchemy import Boolean, Column, JSON, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Tenant(Base, TimestampMixin):
    """
    Tenant model - represents a client company.

    Each tenant has their own Shopify credentials and users.
    This enables multitenant architecture where each company is isolated.
    """

    __tablename__ = "tenants"

    # Company info
    name = Column(String, nullable=False, comment="Company name")
    slug = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        comment="URL-friendly identifier (e.g., 'acme-corp')",
    )
    company_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        comment="Company ID for Auth0 organization mapping",
    )

    # Shopify credentials (per tenant)
    shopify_store_url = Column(
        String,
        nullable=False,
        comment="Shopify store URL (e.g., 'https://my-store.myshopify.com')",
    )
    shopify_access_token = Column(
        String,
        nullable=False,
        comment="Shopify Admin API access token (should be encrypted in production)",
    )
    shopify_api_version = Column(
        String,
        default="2024-01",
        nullable=False,
        comment="Shopify API version (e.g., '2024-01')",
    )

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False, comment="Is tenant active")
    settings = Column(JSON, nullable=True, comment="Additional tenant-specific settings (JSON)")

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        """String representation of Tenant."""
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"
