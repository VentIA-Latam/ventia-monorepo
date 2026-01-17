"""
Invoice and InvoiceSerie schemas for electronic invoicing (eFact-OSE).
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


# ============================================================================
# INVOICE SCHEMAS
# ============================================================================


class InvoiceBase(BaseModel):
    """Base schema for Invoice with common fields."""

    invoice_type: str = Field(
        ...,
        pattern=r"^(01|03|07|08)$",
        description="Invoice type: 01=Factura, 03=Boleta, 07=Nota de Crédito, 08=Nota de Débito"
    )
    currency: str = Field(
        default="PEN",
        pattern=r"^(PEN|USD)$",
        description="Currency code"
    )


class InvoiceCreate(InvoiceBase):
    """
    Schema for creating a new Invoice.

    Required fields:
    - invoice_type: Type of invoice (01, 03, 07, 08)
    - serie: Invoice series (4 characters, e.g., "F001", "B001")

    Optional fields (for Credit/Debit Notes):
    - reference_invoice_id: ID of the referenced invoice (for NC/ND)
    - reference_reason: Reason for the credit/debit note

    Optional fields (customer data override):
    - cliente_tipo_documento: Customer document type (1=DNI, 6=RUC). If not provided, uses order data
    - cliente_numero_documento: Customer document number. If not provided, uses order data
    - cliente_razon_social: Customer name/business name. If not provided, uses order data
    """

    serie: str = Field(
        ...,
        pattern=r"^[A-Z0-9]{4}$",
        description="Invoice series (4 characters, e.g., 'F001', 'B001')"
    )
    reference_invoice_id: Optional[int] = Field(
        None,
        description="Referenced invoice ID (required for NC/ND)"
    )
    reference_reason: Optional[str] = Field(
        None,
        max_length=200,
        description="Reason for credit/debit note"
    )
    
    # Customer data override (optional)
    cliente_tipo_documento: Optional[str] = Field(
        None,
        pattern=r"^[0-9A]{1}$",
        description=(
            "Customer document type (SUNAT catálogo 06): "
            "0=Sin documento, 1=DNI, 4=Carnet extranjería, 6=RUC, 7=Pasaporte, A=Cédula diplomática. "
            "Note: Factura (01) requires tipo_documento=6 (RUC). "
            "(overrides order customer_document_type)"
        )
    )
    cliente_numero_documento: Optional[str] = Field(
        None,
        min_length=8,
        max_length=11,
        description="Customer document number: DNI (8 digits) or RUC (11 digits) (overrides order customer_document_number)"
    )
    cliente_razon_social: Optional[str] = Field(
        None,
        max_length=200,
        description="Customer name or business name (overrides order customer_name)"
    )
    cliente_email: Optional[str] = Field(
        None,
        max_length=255,
        description="Customer email for invoice delivery (overrides order customer_email)"
    )


class InvoiceUpdate(BaseModel):
    """Schema for updating an Invoice (typically internal status updates)."""

    efact_status: Optional[str] = Field(
        None,
        pattern=r"^(pending|processing|success|error)$",
        description="eFact processing status"
    )
    efact_error: Optional[str] = Field(
        None,
        max_length=500,
        description="Error message from eFact"
    )


class InvoiceResponse(InvoiceBase):
    """
    Schema for Invoice response.

    Contains all invoice information including eFact integration status.
    The `full_number` computed field returns the formatted invoice number.
    """

    id: int
    tenant_id: int
    order_id: int

    # Invoice details
    serie: str
    correlativo: int

    # Emisor (Tenant)
    emisor_ruc: str
    emisor_razon_social: str

    # Cliente
    cliente_tipo_documento: str
    cliente_numero_documento: str
    cliente_razon_social: str
    cliente_email: Optional[str]

    # Totals
    subtotal: float
    igv: float
    total: float

    # Line items
    items: list[dict[str, Any]]

    # Reference fields (for NC/ND)
    reference_invoice_id: Optional[int]
    reference_type: Optional[str]
    reference_serie: Optional[str]
    reference_correlativo: Optional[int]
    reference_reason: Optional[str]

    # eFact integration
    efact_ticket: Optional[str]
    efact_status: str
    efact_response: Optional[dict[str, Any]]
    efact_error: Optional[str]
    efact_sent_at: Optional[datetime]
    efact_processed_at: Optional[datetime]

    # Timestamps
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def full_number(self) -> str:
        """Returns formatted invoice number: {serie}-{correlativo:08d}"""
        return f"{self.serie}-{self.correlativo:08d}"

    model_config = ConfigDict(from_attributes=True)


class InvoiceListResponse(BaseModel):
    """Schema for paginated invoice list response."""

    total: int = Field(..., description="Total number of invoices")
    items: list[InvoiceResponse] = Field(..., description="List of invoices")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")

    model_config = ConfigDict(from_attributes=True)


class TicketStatusResponse(BaseModel):
    """Schema for eFact ticket status check response."""

    ticket: str = Field(..., description="eFact ticket UUID")
    status: str = Field(
        ...,
        pattern=r"^(pending|processing|success|error)$",
        description="Current status"
    )
    message: Optional[str] = Field(None, description="Status message")
    cdr_response: Optional[dict[str, Any]] = Field(
        None,
        description="SUNAT CDR response (only on success)"
    )

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# INVOICE SERIE SCHEMAS
# ============================================================================


class InvoiceSerieBase(BaseModel):
    """Base schema for InvoiceSerie with common fields."""

    invoice_type: str = Field(
        ...,
        pattern=r"^(01|03|07|08)$",
        description="Invoice type: 01=Factura, 03=Boleta, 07=NC, 08=ND"
    )
    serie: str = Field(
        ...,
        pattern=r"^[A-Z0-9]{4}$",
        description="Series code (4 characters, e.g., 'F001', 'B001')"
    )
    description: Optional[str] = Field(
        None,
        max_length=100,
        description="Optional description of the series"
    )


class InvoiceSerieCreate(InvoiceSerieBase):
    """
    Schema for creating a new InvoiceSerie.

    Required fields:
    - invoice_type: Type of invoice (01, 03, 07, 08)
    - serie: Series code (4 characters)

    Optional fields:
    - description: Human-readable description
    - is_active: Whether series is active (defaults to True)
    """

    is_active: bool = Field(
        default=True,
        description="Whether the series is active"
    )


class InvoiceSerieUpdate(BaseModel):
    """Schema for updating an InvoiceSerie."""

    is_active: Optional[bool] = Field(
        None,
        description="Whether the series is active"
    )
    description: Optional[str] = Field(
        None,
        max_length=100,
        description="Optional description"
    )


class InvoiceSerieResponse(InvoiceSerieBase):
    """Schema for InvoiceSerie response."""

    id: int
    tenant_id: int
    last_correlativo: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceSerieListResponse(BaseModel):
    """Schema for invoice series list response."""

    items: list[InvoiceSerieResponse] = Field(..., description="List of invoice series")

    model_config = ConfigDict(from_attributes=True)
