"""
Invoice model - represents electronic invoices (comprobantes electrónicos SUNAT).
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Invoice(Base, TimestampMixin):
    """
    Invoice model - represents electronic invoices for SUNAT (Facturas, Boletas, NC, ND).

    Types:
    - 01: Factura
    - 03: Boleta
    - 07: Nota de Crédito
    - 08: Nota de Débito
    """

    __tablename__ = "invoices"

    # Multitenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant (company) this invoice belongs to",
    )
    tenant = relationship("Tenant", back_populates="invoices")

    # Order reference
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Order this invoice is for",
    )
    order = relationship("Order", back_populates="invoices")

    # Invoice identification
    invoice_type = Column(
        String(2),
        nullable=False,
        comment="01=Factura, 03=Boleta, 07=NC, 08=ND",
    )
    serie = Column(
        String(4),
        nullable=False,
        comment="Serie del comprobante (ej: F001, B001)",
    )
    correlativo = Column(
        Integer,
        nullable=False,
        comment="Número correlativo del comprobante",
    )

    # Issuer (emisor)
    emisor_ruc = Column(
        String(11),
        nullable=False,
        comment="RUC del tenant emisor",
    )
    emisor_razon_social = Column(
        String(200),
        nullable=False,
        comment="Razón social del tenant",
    )

    # Customer (cliente)
    cliente_tipo_documento = Column(
        String(1),
        nullable=False,
        comment="1=DNI, 6=RUC",
    )
    cliente_numero_documento = Column(
        String(11),
        nullable=False,
        comment="DNI o RUC del cliente",
    )
    cliente_razon_social = Column(
        String(200),
        nullable=False,
        comment="Nombre o razón social del cliente",
    )

    # Amounts
    currency = Column(
        String(3),
        default="PEN",
        nullable=False,
        comment="PEN, USD",
    )
    subtotal = Column(
        Float,
        nullable=False,
        comment="Subtotal sin IGV",
    )
    igv = Column(
        Float,
        nullable=False,
        comment="IGV (18%)",
    )
    total = Column(
        Float,
        nullable=False,
        comment="Total a pagar",
    )

    # Line items
    items = Column(
        JSON,
        nullable=False,
        comment="Line items desde order.line_items",
    )

    # Reference for NC/ND (auto-reference)
    reference_invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        comment="Invoice referenciado para NC/ND",
    )
    reference_invoice = relationship(
        "Invoice",
        remote_side="Invoice.id",
        foreign_keys=[reference_invoice_id],
        backref="credit_debit_notes",
    )
    reference_type = Column(
        String(2),
        nullable=True,
        comment="Tipo de documento referenciado",
    )
    reference_serie = Column(
        String(4),
        nullable=True,
        comment="Serie del documento referenciado",
    )
    reference_correlativo = Column(
        Integer,
        nullable=True,
        comment="Correlativo del documento referenciado",
    )
    reference_reason = Column(
        String(200),
        nullable=True,
        comment="Motivo de la NC/ND",
    )

    # eFact integration
    efact_ticket = Column(
        String(100),
        unique=True,
        index=True,
        nullable=True,
        comment="UUID de eFact",
    )
    efact_status = Column(
        String(20),
        default="pending",
        index=True,
        nullable=False,
        comment="pending, processing, success, error",
    )
    efact_response = Column(
        JSON,
        nullable=True,
        comment="CDR de SUNAT",
    )
    efact_error = Column(
        String(500),
        nullable=True,
        comment="Mensaje de error si falla",
    )
    efact_sent_at = Column(
        DateTime,
        nullable=True,
        comment="Timestamp cuando se envió a eFact",
    )
    efact_processed_at = Column(
        DateTime,
        nullable=True,
        comment="Timestamp cuando eFact procesó el comprobante",
    )

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "serie",
            "correlativo",
            name="uq_tenant_serie_correlativo",
        ),
        Index("ix_invoices_order_invoice_type", "order_id", "invoice_type"),
    )

    def __repr__(self) -> str:
        """String representation of Invoice."""
        return (
            f"<Invoice(id={self.id}, type={self.invoice_type}, "
            f"serie={self.serie}, correlativo={self.correlativo}, "
            f"total={self.total}, status={self.efact_status})>"
        )
