"""
InvoiceSerie model - manages invoice series and correlatives per tenant.
"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class InvoiceSerie(Base, TimestampMixin):
    """
    InvoiceSerie model - manages series and correlatives for invoices.

    This model ensures thread-safe correlative generation using SELECT FOR UPDATE.
    """

    __tablename__ = "invoice_series"

    # Multitenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant (company) this series belongs to",
    )
    tenant = relationship("Tenant", back_populates="invoice_series")

    # Series configuration
    invoice_type = Column(
        String(2),
        nullable=False,
        comment="01=Factura, 03=Boleta, 07=NC, 08=ND",
    )
    serie = Column(
        String(4),
        nullable=False,
        comment="Código de serie (ej: F001, B001)",
    )
    last_correlativo = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Último número correlativo usado",
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Serie activa o inactiva",
    )
    description = Column(
        String(100),
        nullable=True,
        comment="Descripción opcional de la serie",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "serie",
            name="uq_tenant_serie",
        ),
    )

    def __repr__(self) -> str:
        """String representation of InvoiceSerie."""
        return (
            f"<InvoiceSerie(id={self.id}, tenant_id={self.tenant_id}, "
            f"type={self.invoice_type}, serie={self.serie}, "
            f"last_correlativo={self.last_correlativo}, active={self.is_active})>"
        )
