"""
Tenant (Company) model - represents a client company with their own e-commerce store.

Supports multiple e-commerce platforms (Shopify, WooCommerce) with credentials
stored encrypted in the `settings` JSON field.
"""

import logging
from typing import Any

from sqlalchemy import JSON, Boolean, Column, String
from sqlalchemy.orm import attributes, relationship

from app.core.encryption import encryption_service
from app.models.base import Base, TimestampMixin
from app.schemas.tenant_settings import (
    EcommerceSettings,
    ShopifyCredentials,
    TenantSettings,
    WooCommerceCredentials,
)

logger = logging.getLogger(__name__)


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

    def get_settings(self) -> TenantSettings:
        """
        Get tenant settings with decrypted credentials.

        Reads the `settings` JSON field and decrypts any encrypted credentials.

        Returns:
            TenantSettings: Typed settings object with decrypted credentials.
                           Returns empty TenantSettings if no configuration exists.

        Note:
            Decryption errors are handled gracefully (credentials set to None).
        """
        if not self.settings:
            return TenantSettings()

        settings_dict: dict[str, Any] = self.settings
        ecommerce_dict = settings_dict.get("ecommerce")

        if not ecommerce_dict:
            return TenantSettings()

        ecommerce_settings = self._decrypt_ecommerce_settings(ecommerce_dict)
        return TenantSettings(ecommerce=ecommerce_settings)

    def _decrypt_ecommerce_settings(
        self, ecommerce_dict: dict[str, Any]
    ) -> EcommerceSettings:
        """
        Decrypt credentials in ecommerce settings dictionary.

        Args:
            ecommerce_dict: Raw ecommerce settings from JSON with encrypted fields.

        Returns:
            EcommerceSettings: Settings object with decrypted credentials.
        """
        sync_on_validation = ecommerce_dict.get("sync_on_validation", True)
        shopify_dict = ecommerce_dict.get("shopify")
        woocommerce_dict = ecommerce_dict.get("woocommerce")

        shopify_creds = None
        woocommerce_creds = None

        # Decrypt Shopify credentials
        if shopify_dict:
            access_token = self._safe_decrypt(
                shopify_dict.get("access_token_encrypted")
            )
            shopify_creds = ShopifyCredentials(
                store_url=shopify_dict.get("store_url", ""),
                access_token=access_token,
                api_version=shopify_dict.get("api_version", "2024-01"),
            )

        # Decrypt WooCommerce credentials
        if woocommerce_dict:
            consumer_key = self._safe_decrypt(
                woocommerce_dict.get("consumer_key_encrypted")
            )
            consumer_secret = self._safe_decrypt(
                woocommerce_dict.get("consumer_secret_encrypted")
            )
            woocommerce_creds = WooCommerceCredentials(
                store_url=woocommerce_dict.get("store_url", ""),
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
            )

        return EcommerceSettings(
            sync_on_validation=sync_on_validation,
            shopify=shopify_creds,
            woocommerce=woocommerce_creds,
        )

    def _safe_decrypt(self, encrypted_value: str | None) -> str | None:
        """
        Safely decrypt a value, returning None on any error.

        Args:
            encrypted_value: The encrypted string to decrypt.

        Returns:
            Decrypted string or None if decryption fails or value is empty.
        """
        if not encrypted_value:
            return None

        try:
            return encryption_service.decrypt(encrypted_value)
        except Exception as e:
            logger.warning(f"Failed to decrypt credential for tenant {self.id}: {e}")
            return None

    def set_ecommerce_settings(self, ecommerce: EcommerceSettings) -> None:
        """
        Set e-commerce settings with automatic encryption of credentials.

        Takes an EcommerceSettings object with plaintext credentials and stores
        them encrypted in the `settings` JSON field.

        Args:
            ecommerce: EcommerceSettings with plaintext credentials.

        Note:
            - Sensitive fields are stored with `_encrypted` suffix
            - Plaintext credentials are NEVER stored in the database
        """
        if self.settings is None:
            self.settings = {}

        # Handle None or empty ecommerce settings
        if ecommerce is None or not ecommerce.has_ecommerce:
            self.settings["ecommerce"] = {
                "sync_on_validation": ecommerce.sync_on_validation if ecommerce else True
            }
            attributes.flag_modified(self, "settings")
            return

        ecommerce_dict: dict[str, Any] = {
            "sync_on_validation": ecommerce.sync_on_validation,
        }

        # Encrypt and store Shopify credentials
        if ecommerce.shopify:
            ecommerce_dict["shopify"] = {
                "store_url": ecommerce.shopify.store_url,
                "api_version": ecommerce.shopify.api_version,
            }
            if ecommerce.shopify.access_token:
                ecommerce_dict["shopify"]["access_token_encrypted"] = (
                    encryption_service.encrypt(ecommerce.shopify.access_token)
                )

        # Encrypt and store WooCommerce credentials
        if ecommerce.woocommerce:
            ecommerce_dict["woocommerce"] = {
                "store_url": ecommerce.woocommerce.store_url,
            }
            if ecommerce.woocommerce.consumer_key:
                ecommerce_dict["woocommerce"]["consumer_key_encrypted"] = (
                    encryption_service.encrypt(ecommerce.woocommerce.consumer_key)
                )
            if ecommerce.woocommerce.consumer_secret:
                ecommerce_dict["woocommerce"]["consumer_secret_encrypted"] = (
                    encryption_service.encrypt(ecommerce.woocommerce.consumer_secret)
                )

        self.settings["ecommerce"] = ecommerce_dict

        # Mark settings as modified so SQLAlchemy detects the change
        attributes.flag_modified(self, "settings")

    def __repr__(self) -> str:
        """String representation of Tenant."""
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"
