"""
Email service using Resend API for sending invoices.

This service handles:
- Sending invoice emails with PDF attachments
- Generating HTML email templates
- Managing email subjects and formatting
"""
import base64
import resend
from typing import Optional
from datetime import datetime

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.tenant import Tenant


class EmailError(Exception):
    """Base exception for email sending errors."""
    pass


class EmailService:
    """Service for sending emails via Resend API."""

    def __init__(self):
        """Initialize Resend client with API key from settings."""
        if not settings.RESEND_API_KEY:
            raise EmailError("RESEND_API_KEY not configured in environment variables")
        resend.api_key = settings.RESEND_API_KEY

    async def send_invoice_email(
        self,
        to_email: str,
        invoice: Invoice,
        pdf_bytes: bytes,
        tenant: Tenant,
        include_xml: bool = False,
        xml_bytes: Optional[bytes] = None,
    ) -> dict:
        """
        Send invoice email with PDF attachment.

        Args:
            to_email: Recipient email address
            invoice: Invoice object with all details
            pdf_bytes: PDF file bytes from eFact
            tenant: Tenant object for company info
            include_xml: Whether to include XML attachment
            xml_bytes: XML file bytes (if include_xml is True)

        Returns:
            dict: Resend API response with email_id

        Raises:
            EmailError: If sending fails

        Example:
            >>> response = await email_service.send_invoice_email(
            ...     to_email="cliente@example.com",
            ...     invoice=invoice_obj,
            ...     pdf_bytes=pdf_data,
            ...     tenant=tenant_obj
            ... )
            >>> print(response['id'])  # Resend email ID
        """
        try:
            # Build email subject
            subject = self._build_invoice_subject(invoice, tenant)

            # Build HTML body
            html_body = self._build_invoice_html(invoice, tenant)

            # Prepare PDF attachment (convert to base64)
            pdf_filename = f"{invoice.serie}-{invoice.correlativo:08d}.pdf"
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            attachments = [
                {
                    "filename": pdf_filename,
                    "content": pdf_base64,
                }
            ]

            # Add XML if requested (convert to base64)
            if include_xml and xml_bytes:
                xml_filename = f"{invoice.serie}-{invoice.correlativo:08d}.xml"
                xml_base64 = base64.b64encode(xml_bytes).decode('utf-8')
                attachments.append({
                    "filename": xml_filename,
                    "content": xml_base64,
                })

            # Send email via Resend
            response = resend.Emails.send({
                "from": f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>",
                "to": to_email,
                "subject": subject,
                "html": html_body,
                "attachments": attachments,
            })

            return response

        except Exception as e:
            raise EmailError(f"Failed to send email: {str(e)}")

    def _build_invoice_subject(self, invoice: Invoice, tenant: Tenant) -> str:
        """
        Generate email subject line.

        Args:
            invoice: Invoice object
            tenant: Tenant object

        Returns:
            str: Formatted email subject

        Example:
            >>> subject = service._build_invoice_subject(invoice, tenant)
            >>> print(subject)
            [VentIA] Tu Factura F001-00000123 - ACME Corp
        """
        tipo_doc = {
            "01": "Factura",
            "03": "Boleta",
            "07": "Nota de Crédito",
            "08": "Nota de Débito",
        }.get(invoice.invoice_type, "Comprobante")

        return f"[VentIA] Tu {tipo_doc} {invoice.serie}-{invoice.correlativo:08d} - {tenant.name}"

    def _build_invoice_html(self, invoice: Invoice, tenant: Tenant) -> str:
        """
        Generate HTML email body with invoice details.

        Creates a responsive, email-safe HTML template with inline CSS
        that works across Gmail, Outlook, Apple Mail, and other clients.

        Args:
            invoice: Invoice object with all financial details
            tenant: Tenant object for company information

        Returns:
            str: Complete HTML email body

        Template Features:
            - Success icon (green checkmark)
            - Invoice number and validation date
            - Financial summary (subtotal, IGV, total)
            - Professional styling with inline CSS
            - Mobile-responsive design
        """
        tipo_doc = {
            "01": "Factura Electrónica",
            "03": "Boleta de Venta Electrónica",
            "07": "Nota de Crédito Electrónica",
            "08": "Nota de Débito Electrónica",
        }.get(invoice.invoice_type, "Comprobante Electrónico")

        tipo_doc_short = {
            "01": "Factura",
            "03": "Boleta",
            "07": "Nota de Crédito",
            "08": "Nota de Débito",
        }.get(invoice.invoice_type, "Comprobante")

        currency_symbol = "S/" if invoice.currency == "PEN" else "$"

        # Format date
        if isinstance(invoice.created_at, str):
            fecha = datetime.fromisoformat(invoice.created_at).strftime("%d %b %Y")
        else:
            fecha = invoice.created_at.strftime("%d %b %Y")

        # HTML template - Modern and clean design (email-safe with inline CSS)
        html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{tipo_doc}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f6f8; min-height: 100vh;">

    <!-- Main Content -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f8; padding: 32px 16px;">
        <tr>
            <td align="center">
                <!-- Card Container -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; max-width: 600px;">

                    <!-- Success Header -->
                    <tr>
                        <td style="padding: 48px 24px 32px; text-align: center;">
                            <!-- Success Icon -->
                            <table width="64" height="64" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 24px;">
                                <tr>
                                    <td style="background-color: #d1fae5; width: 64px; height: 64px; border-radius: 50%; text-align: center; vertical-align: middle;">
                                        <span style="color: #059669; font-size: 36px; font-weight: bold;">✓</span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Title -->
                            <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 30px; font-weight: 700; letter-spacing: -0.5px;">
                                ¡Tu {tipo_doc_short} ha sido emitida!
                            </h1>
                            <p style="margin: 0; color: #6b7280; font-size: 16px;">
                                El comprobante ha sido enviado a tu correo.
                            </p>
                        </td>
                    </tr>

                    <!-- Transaction Info -->
                    <tr>
                        <td style="padding: 0 32px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                            <a href="#" style="color: #135bec; font-weight: 500; text-decoration: none; font-size: 14px; display: block; margin-bottom: 4px;">
                                {tipo_doc_short} #{invoice.serie}-{invoice.correlativo:08d}
                            </a>
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                Validado por SUNAT · {fecha}
                            </p>
                        </td>
                    </tr>

                    <!-- Order Summary -->
                    <tr>
                        <td style="padding: 32px;">
                            <h3 style="margin: 0 0 24px 0; color: #111827; font-weight: 600; font-size: 16px;">
                                Resumen del Comprobante
                            </h3>

                            <!-- Items -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6b7280; font-size: 14px;">Cliente</span>
                                    </td>
                                    <td align="right" style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 500; font-size: 14px;">{invoice.cliente_razon_social}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6b7280; font-size: 14px;">Tipo de Documento</span>
                                    </td>
                                    <td align="right" style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 500; font-size: 14px;">{tipo_doc}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6b7280; font-size: 14px;">Subtotal</span>
                                    </td>
                                    <td align="right" style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 500; font-size: 14px;">{currency_symbol} {invoice.subtotal:.2f}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6b7280; font-size: 14px;">IGV (18%)</span>
                                    </td>
                                    <td align="right" style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 500; font-size: 14px;">{currency_symbol} {invoice.igv:.2f}</span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 16px;">
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 700; font-size: 18px;">Total</span>
                                    </td>
                                    <td align="right" style="padding: 8px 0;">
                                        <span style="color: #111827; font-weight: 700; font-size: 18px;">{currency_symbol} {invoice.total:.2f}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer Info -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: #f9fafb;">
                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.6; text-align: center;">
                                El archivo PDF adjunto tiene validez tributaria ante SUNAT.
                                Este comprobante ha sido emitido por <span style="font-weight: 600;">{tenant.name}</span>{f" (RUC: {invoice.emisor_ruc})" if invoice.emisor_ruc else ""}.
                            </p>
                            <p style="margin: 0; font-size: 12px; text-align: center;">
                                <span style="color: #6b7280;">¿Necesitas ayuda? </span>
                                <a href="mailto:soporte@ventia.pe" style="color: #135bec; font-weight: 500; text-decoration: none;">Contacta a soporte</a>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

    <!-- Page Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 0;">
        <tr>
            <td align="center">
                <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                    © 2026 VentIA - Sistema de Facturación Electrónica. Todos los derechos reservados.
                </p>
            </td>
        </tr>
    </table>

</body>
</html>
        """

        return html.strip()


# Singleton instance
email_service = EmailService()
