"""
Tests for export/download endpoints:
- GET  /orders/export
- GET  /invoices/export
- POST /invoices/bulk-download
- GET  /invoices/{invoice_id}/cdr
"""

import json
from datetime import date, datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.invoices import (
    bulk_download_invoices,
    download_invoice_cdr,
    export_invoices,
)
from app.api.v1.endpoints.orders import export_orders
from app.core.permissions import Role
from app.schemas.invoice import BulkDownloadRequest


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _mock_user(role: Role = Role.ADMIN, tenant_id: int = 1) -> MagicMock:
    user = MagicMock()
    user.id = 10
    user.role = role
    user.tenant_id = tenant_id
    return user


def _mock_db_with_tenant_tz(tz_name: str | None = "America/Lima") -> MagicMock:
    """Mock db that returns tenant timezone from query."""
    db = MagicMock()
    # db.query(Tenant.timezone).filter(...).first() → (tz_name,) or None
    mock_row = (tz_name,) if tz_name else None
    db.query.return_value.filter.return_value.first.return_value = mock_row
    return db


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Export Orders Endpoint
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExportOrdersEndpoint:

    @pytest.mark.asyncio
    async def test_export_csv_returns_correct_headers(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b"csv-data"
            mock_export.export_orders_csv.return_value = mock_buf

            resp = await export_orders(
                format="csv",
                start_date=None,
                end_date=None,
                validado=None,
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "text/csv"
            assert "pedidos.csv" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_export_excel_returns_xlsx_headers(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b"xlsx-data"
            mock_export.export_orders_excel.return_value = mock_buf

            resp = await export_orders(
                format="excel",
                start_date=None,
                end_date=None,
                validado=None,
                current_user=_mock_user(),
                db=db,
            )

            assert "spreadsheetml" in resp.media_type
            assert "pedidos.xlsx" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_regular_user_tenant_scoped(self):
        """Non-SUPERADMIN uses get_by_tenant, not get_all."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=None,
                current_user=_mock_user(role=Role.ADMIN, tenant_id=5),
                db=db,
            )

            mock_repo.get_by_tenant.assert_called_once()
            mock_repo.get_all.assert_not_called()
            call_kwargs = mock_repo.get_by_tenant.call_args
            assert call_kwargs[0][1] == 5  # tenant_id positional arg

    @pytest.mark.asyncio
    async def test_superadmin_uses_get_all(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_all.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=None,
                current_user=_mock_user(role=Role.SUPERADMIN),
                db=db,
            )

            mock_repo.get_all.assert_called_once()
            mock_repo.get_by_tenant.assert_not_called()

    @pytest.mark.asyncio
    async def test_date_range_converts_to_utc(self):
        """When dates are provided, get_date_range_utc is called."""
        db = _mock_db_with_tenant_tz("America/Lima")
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
            patch("app.api.v1.endpoints.orders.get_date_range_utc") as mock_tz,
        ):
            mock_tz.return_value = (datetime(2024, 1, 1, 5), datetime(2024, 1, 31, 5))
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                validado=None,
                current_user=_mock_user(),
                db=db,
            )

            mock_tz.assert_called_once_with(
                date(2024, 1, 1), date(2024, 1, 31), "America/Lima"
            )

    @pytest.mark.asyncio
    async def test_without_dates_passes_none(self):
        """When no dates, repo receives start_date=None, end_date=None."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=None,
                current_user=_mock_user(),
                db=db,
            )

            kwargs = mock_repo.get_by_tenant.call_args.kwargs
            assert kwargs["start_date"] is None
            assert kwargs["end_date"] is None

    @pytest.mark.asyncio
    async def test_with_validado_filter(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=True,
                current_user=_mock_user(),
                db=db,
            )

            kwargs = mock_repo.get_by_tenant.call_args.kwargs
            assert kwargs["validado"] is True

    @pytest.mark.asyncio
    async def test_tenant_timezone_lookup(self):
        """Reads timezone from tenant table in DB."""
        db = _mock_db_with_tenant_tz("Asia/Tokyo")
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=None,
                current_user=_mock_user(),
                db=db,
            )

            mock_export.export_orders_csv.assert_called_once_with([], "Asia/Tokyo")

    @pytest.mark.asyncio
    async def test_no_timezone_defaults_lima(self):
        """When tenant has no timezone, defaults to America/Lima."""
        db = _mock_db_with_tenant_tz(None)
        with (
            patch("app.api.v1.endpoints.orders.order_repository") as mock_repo,
            patch("app.api.v1.endpoints.orders.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_orders_csv.return_value = mock_buf

            await export_orders(
                format="csv", start_date=None, end_date=None, validado=None,
                current_user=_mock_user(),
                db=db,
            )

            mock_export.export_orders_csv.assert_called_once_with([], "America/Lima")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Export Invoices Endpoint
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExportInvoicesEndpoint:

    @pytest.mark.asyncio
    async def test_export_csv_response(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b"csv"
            mock_export.export_invoices_csv.return_value = mock_buf

            resp = await export_invoices(
                format="csv", start_date=None, end_date=None, tenant_id=None,
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "text/csv"
            assert "comprobantes.csv" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_export_excel_response(self):
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b"xlsx"
            mock_export.export_invoices_excel.return_value = mock_buf

            resp = await export_invoices(
                format="excel", start_date=None, end_date=None, tenant_id=None,
                current_user=_mock_user(),
                db=db,
            )

            assert "spreadsheetml" in resp.media_type
            assert "comprobantes.xlsx" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_regular_user_own_tenant(self):
        """Non-SUPERADMIN uses get_by_tenant with own tenant_id."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_invoices_csv.return_value = mock_buf

            await export_invoices(
                format="csv", start_date=None, end_date=None, tenant_id=None,
                current_user=_mock_user(role=Role.ADMIN, tenant_id=3),
                db=db,
            )

            mock_repo.get_by_tenant.assert_called_once()
            call_args = mock_repo.get_by_tenant.call_args
            assert call_args[0][1] == 3

    @pytest.mark.asyncio
    async def test_superadmin_with_tenant_id(self):
        """SUPERADMIN with tenant_id uses get_by_tenant for that tenant."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_invoices_csv.return_value = mock_buf

            await export_invoices(
                format="csv", start_date=None, end_date=None, tenant_id=7,
                current_user=_mock_user(role=Role.SUPERADMIN),
                db=db,
            )

            mock_repo.get_by_tenant.assert_called_once()
            call_args = mock_repo.get_by_tenant.call_args
            assert call_args[0][1] == 7

    @pytest.mark.asyncio
    async def test_superadmin_without_tenant_id_gets_all(self):
        """SUPERADMIN without tenant_id uses get_all."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_all.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_invoices_csv.return_value = mock_buf

            await export_invoices(
                format="csv", start_date=None, end_date=None, tenant_id=None,
                current_user=_mock_user(role=Role.SUPERADMIN),
                db=db,
            )

            mock_repo.get_all.assert_called_once()

    @pytest.mark.asyncio
    async def test_date_range_conversion(self):
        db = _mock_db_with_tenant_tz("America/Lima")
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
            patch("app.api.v1.endpoints.invoices.get_date_range_utc") as mock_tz,
        ):
            mock_tz.return_value = (datetime(2024, 1, 1, 5), datetime(2024, 1, 31, 5))
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_invoices_csv.return_value = mock_buf

            await export_invoices(
                format="csv",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                tenant_id=None,
                current_user=_mock_user(),
                db=db,
            )

            mock_tz.assert_called_once_with(
                date(2024, 1, 1), date(2024, 1, 31), "America/Lima"
            )

    @pytest.mark.asyncio
    async def test_without_dates_passes_none(self):
        """When no dates, repo receives start_date=None, end_date=None."""
        db = _mock_db_with_tenant_tz()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.api.v1.endpoints.invoices.export_service") as mock_export,
        ):
            mock_repo.get_by_tenant.return_value = []
            mock_buf = MagicMock()
            mock_buf.read.return_value = b""
            mock_export.export_invoices_csv.return_value = mock_buf

            await export_invoices(
                format="csv", start_date=None, end_date=None, tenant_id=None,
                current_user=_mock_user(),
                db=db,
            )

            kwargs = mock_repo.get_by_tenant.call_args.kwargs
            assert kwargs["start_date"] is None
            assert kwargs["end_date"] is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Bulk Download Endpoint
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _make_invoice(
    inv_id: int = 1,
    tenant_id: int = 1,
    efact_status: str = "success",
    efact_response: dict | None = None,
    serie: str = "F001",
    correlativo: int = 1,
    efact_ticket: str = "TICKET-1",
) -> MagicMock:
    inv = MagicMock()
    inv.id = inv_id
    inv.tenant_id = tenant_id
    inv.efact_status = efact_status
    inv.efact_response = efact_response or {"code": "0", "description": "Aceptado"}
    inv.serie = serie
    inv.correlativo = correlativo
    inv.efact_ticket = efact_ticket
    return inv


class TestBulkDownloadEndpoint:

    @pytest.mark.asyncio
    async def test_pdf_returns_zip(self):
        db = MagicMock()
        inv = _make_invoice()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.integrations.efact_client.EFactClient") as MockEFact,
        ):
            mock_repo.get.return_value = inv
            MockEFact.return_value.download_pdf.return_value = b"%PDF-fake"

            resp = await bulk_download_invoices(
                request_data=BulkDownloadRequest(invoice_ids=[1], file_type="pdf"),
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "application/zip"
            assert "comprobantes-pdf.zip" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_xml_returns_zip(self):
        db = MagicMock()
        inv = _make_invoice()
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.integrations.efact_client.EFactClient") as MockEFact,
        ):
            mock_repo.get.return_value = inv
            MockEFact.return_value.download_xml.return_value = b"<xml/>"

            resp = await bulk_download_invoices(
                request_data=BulkDownloadRequest(invoice_ids=[1], file_type="xml"),
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "application/zip"
            assert "comprobantes-xml.zip" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_cdr_returns_zip_with_json(self):
        """CDR uses stored efact_response, no external API call."""
        db = MagicMock()
        cdr_data = {"code": "0", "description": "Aceptado por SUNAT"}
        inv = _make_invoice(efact_response=cdr_data)
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            resp = await bulk_download_invoices(
                request_data=BulkDownloadRequest(invoice_ids=[1], file_type="cdr"),
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "application/zip"
            assert resp.body is not None

    @pytest.mark.asyncio
    async def test_invoice_not_found_404(self):
        db = MagicMock()
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await bulk_download_invoices(
                    request_data=BulkDownloadRequest(invoice_ids=[999], file_type="pdf"),
                    current_user=_mock_user(),
                    db=db,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_wrong_tenant_403(self):
        db = MagicMock()
        inv = _make_invoice(tenant_id=2)
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            with pytest.raises(HTTPException) as exc_info:
                await bulk_download_invoices(
                    request_data=BulkDownloadRequest(invoice_ids=[1], file_type="pdf"),
                    current_user=_mock_user(role=Role.ADMIN, tenant_id=1),
                    db=db,
                )

            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_not_validated_400(self):
        """Invoice with efact_status != 'success' returns 400."""
        db = MagicMock()
        inv = _make_invoice(efact_status="processing")
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            with pytest.raises(HTTPException) as exc_info:
                await bulk_download_invoices(
                    request_data=BulkDownloadRequest(invoice_ids=[1], file_type="pdf"),
                    current_user=_mock_user(),
                    db=db,
                )

            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_superadmin_any_tenant(self):
        """SUPERADMIN bypasses tenant check."""
        db = MagicMock()
        inv = _make_invoice(tenant_id=99)
        with (
            patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo,
            patch("app.integrations.efact_client.EFactClient") as MockEFact,
        ):
            mock_repo.get.return_value = inv
            MockEFact.return_value.download_pdf.return_value = b"%PDF"

            resp = await bulk_download_invoices(
                request_data=BulkDownloadRequest(invoice_ids=[1], file_type="pdf"),
                current_user=_mock_user(role=Role.SUPERADMIN, tenant_id=1),
                db=db,
            )

            assert resp.media_type == "application/zip"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Download CDR Endpoint
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestDownloadCdrEndpoint:

    @pytest.mark.asyncio
    async def test_cdr_success(self):
        db = MagicMock()
        cdr = {"code": "0", "description": "Aceptado"}
        inv = _make_invoice(efact_response=cdr, serie="F001", correlativo=5)
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            resp = await download_invoice_cdr(
                invoice_id=1,
                current_user=_mock_user(),
                db=db,
            )

            assert resp.media_type == "application/json"

    @pytest.mark.asyncio
    async def test_filename_format(self):
        """Filename: {serie}-{correlativo:08d}-CDR.json."""
        db = MagicMock()
        inv = _make_invoice(serie="B001", correlativo=42, efact_response={"ok": True})
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            resp = await download_invoice_cdr(
                invoice_id=1, current_user=_mock_user(), db=db,
            )

            assert "B001-00000042-CDR.json" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_not_found_404(self):
        db = MagicMock()
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await download_invoice_cdr(
                    invoice_id=999, current_user=_mock_user(), db=db,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_wrong_tenant_403(self):
        db = MagicMock()
        inv = _make_invoice(tenant_id=2)
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            with pytest.raises(HTTPException) as exc_info:
                await download_invoice_cdr(
                    invoice_id=1,
                    current_user=_mock_user(role=Role.ADMIN, tenant_id=1),
                    db=db,
                )

            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_not_success_400(self):
        db = MagicMock()
        inv = _make_invoice(efact_status="processing")
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            with pytest.raises(HTTPException) as exc_info:
                await download_invoice_cdr(
                    invoice_id=1, current_user=_mock_user(), db=db,
                )

            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_no_efact_response_400(self):
        db = MagicMock()
        inv = _make_invoice(efact_response=None)
        inv.efact_response = None  # Override default
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            with pytest.raises(HTTPException) as exc_info:
                await download_invoice_cdr(
                    invoice_id=1, current_user=_mock_user(), db=db,
                )

            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_superadmin_any_tenant(self):
        """SUPERADMIN can download CDR from any tenant."""
        db = MagicMock()
        inv = _make_invoice(tenant_id=99, efact_response={"ok": True})
        with patch("app.api.v1.endpoints.invoices.invoice_repository") as mock_repo:
            mock_repo.get.return_value = inv

            resp = await download_invoice_cdr(
                invoice_id=1,
                current_user=_mock_user(role=Role.SUPERADMIN, tenant_id=1),
                db=db,
            )

            assert resp.media_type == "application/json"
