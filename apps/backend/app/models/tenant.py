"""
Tenant (Company) model - represents a client company with their own Shopify store.
"""

from typing import Optional

from sqlalchemy import Boolean, Column, JSON, String
from sqlalchemy.orm import relationship

from app.core.encryption import encryption_service
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
        nullable=True,
        comment="Company ID for Auth0 organization mapping",
    )

    # Platform identification
    is_platform = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="True if this is the VentIA platform tenant (not a client)",
    )

    # Shopify credentials (per tenant)
    shopify_store_url = Column(
        String,
        nullable=True,
        comment="Shopify store URL (e.g., 'https://my-store.myshopify.com')",
    )
    _shopify_access_token_encrypted = Column(
        String,
        nullable=True,
        comment="Encrypted Shopify Admin API access token (use shopify_access_token property)",
    )
    shopify_api_version = Column(
        String,
        default="2024-01",
        nullable=True,
        comment="Shopify API version (e.g., '2024-01')",
    )

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False, comment="Is tenant active")
    settings = Column(JSON, nullable=True, comment="Additional tenant-specific settings (JSON)")

    # Electronic invoicing (facturacion electronica)
    efact_ruc = Column(
        String(11),
        nullable=True,
        comment="RUC del tenant para facturacion electronica",
    )

    # Datos del emisor para facturacion electronica
    emisor_nombre_comercial = Column(
        String(200),
        nullable=True,
        comment="Nombre comercial del emisor para comprobantes electronicos",
    )
    emisor_ubigeo = Column(
        String(6),
        nullable=False,
        default="150101",
        server_default="150101",
        comment="Codigo UBIGEO INEI del domicilio fiscal",
    )
    emisor_departamento = Column(
        String(100),
        nullable=False,
        default="LIMA",
        server_default="LIMA",
        comment="Departamento del domicilio fiscal",
    )
    emisor_provincia = Column(
        String(100),
        nullable=False,
        default="LIMA",
        server_default="LIMA",
        comment="Provincia del domicilio fiscal",
    )
    emisor_distrito = Column(
        String(100),
        nullable=False,
        default="LIMA",
        server_default="LIMA",
        comment="Distrito del domicilio fiscal",
    )
    emisor_direccion = Column(
        String(500),
        nullable=True,
        comment="Direccion completa del domicilio fiscal",
    )

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="tenant", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="tenant", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="tenant", cascade="all, delete-orphan")
    invoice_series = relationship("InvoiceSerie", back_populates="tenant", cascade="all, delete-orphan")

    @property
    def shopify_access_token(self) -> Optional[str]:
        """
        Get decrypted Shopify access token.

        This property transparently decrypts the token when accessed.
        Returns None if token is not set.

        Returns:
            str: Decrypted access token or None
        """
        if not self._shopify_access_token_encrypted:
            return None

        try:
            return encryption_service.decrypt(self._shopify_access_token_encrypted)
        except Exception:
            # If decryption fails, return None and log warning
            # This can happen if SECRET_KEY changed or data is corrupted
            return None

    @shopify_access_token.setter
    def shopify_access_token(self, value: Optional[str]) -> None:
        """
        Set Shopify access token with automatic encryption.

        This property transparently encrypts the token before storing it.
        If value is None or empty, the encrypted field is set to None.

        Args:
            value: Plain text access token or None
        """
        if not value:
            self._shopify_access_token_encrypted = None
        else:
            self._shopify_access_token_encrypted = encryption_service.encrypt(value)

    def __repr__(self) -> str:
        """String representation of Tenant."""
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"
