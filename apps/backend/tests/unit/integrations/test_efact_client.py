"""
US-006: Tests de Cliente eFact con Mocks

Tests for EFactClient OAuth2 authentication, document submission,
status checking, and error handling with mocked HTTP responses.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, PropertyMock
import json

import httpx

from app.integrations.efact_client import (
    EFactClient,
    EFactError,
    EFactAuthError,
    _token_cache,
)


class TestEFactClientAuthentication:
    """Tests for OAuth2 authentication in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset global token cache before each test."""
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_successful_authentication_returns_token(self, efact_client):
        """Test: Successful OAuth2 authentication returns access_token."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_token_abc123",
            "token_type": "Bearer",
            "expires_in": 43200,
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            token = efact_client._get_token()

            assert token == "test_token_abc123"
            mock_client.post.assert_called_once()

    def test_authentication_failure_401_raises_auth_error(self, efact_client):
        """Test: Authentication failure (HTTP 401) raises EFactAuthError."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid credentials"

        http_error = httpx.HTTPStatusError(
            message="401 Unauthorized",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactAuthError) as exc_info:
                efact_client._get_token()

            assert "401" in str(exc_info.value)

    def test_authentication_network_error_raises_auth_error(self, efact_client):
        """Test: Network error during authentication raises EFactAuthError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.RequestError(
                "Connection refused",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactAuthError) as exc_info:
                efact_client._get_token()

            assert "Network error" in str(exc_info.value)

    def test_missing_access_token_in_response_raises_error(self, efact_client):
        """Test: Response without access_token raises EFactAuthError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "token_type": "Bearer",
            # Missing access_token
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactAuthError) as exc_info:
                efact_client._get_token()

            assert "No access_token" in str(exc_info.value)


class TestEFactClientTokenCache:
    """Tests for token caching behavior in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset global token cache before each test."""
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_cached_token_is_reused_within_expiration(self, efact_client):
        """Test: Cached token is reused without making new request."""
        # Pre-populate cache with valid token
        _token_cache["access_token"] = "cached_token_xyz"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=5)

        with patch("httpx.Client") as mock_client_class:
            # Should NOT be called since token is cached
            token = efact_client._get_token()

            assert token == "cached_token_xyz"
            mock_client_class.assert_not_called()

    def test_expired_token_is_renewed_automatically(self, efact_client):
        """Test: Expired token triggers new authentication request."""
        # Pre-populate cache with expired token
        _token_cache["access_token"] = "expired_token"
        _token_cache["expires_at"] = datetime.utcnow() - timedelta(hours=1)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_fresh_token",
            "token_type": "Bearer",
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            token = efact_client._get_token()

            assert token == "new_fresh_token"
            mock_client.post.assert_called_once()

    def test_token_is_cached_after_successful_auth(self, efact_client):
        """Test: Token is stored in cache after successful authentication."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "token_to_cache",
            "token_type": "Bearer",
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            efact_client._get_token()

            assert _token_cache["access_token"] == "token_to_cache"
            assert _token_cache["expires_at"] is not None
            assert _token_cache["expires_at"] > datetime.utcnow()


class TestEFactClientSendDocument:
    """Tests for document submission in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    @pytest.fixture
    def sample_json_ubl(self):
        """Sample JSON-UBL document for testing."""
        return {
            "_D": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
            "Invoice": [
                {
                    "ID": [{"IdentifierContent": "B001-00000001"}],
                    "InvoiceTypeCode": [{"CodeContent": "03"}],
                    "AccountingSupplierParty": [
                        {
                            "Party": [
                                {
                                    "PartyIdentification": [
                                        {
                                            "ID": [{"IdentifierContent": "20123456789"}]
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                }
            ],
        }

    def test_successful_document_submission_returns_ticket(
        self, efact_client, sample_json_ubl
    ):
        """Test: Successful document submission returns ticket."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ticket": "TICKET123456",
            "status": "processing",
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.send_document(sample_json_ubl)

            assert result["ticket"] == "TICKET123456"
            mock_client.post.assert_called_once()

    def test_document_submission_http_error_raises_efact_error(
        self, efact_client, sample_json_ubl
    ):
        """Test: HTTP error during submission raises EFactError."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        http_error = httpx.HTTPStatusError(
            message="500 Server Error",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document(sample_json_ubl)

            assert "500" in str(exc_info.value)

    def test_document_submission_network_error_raises_efact_error(
        self, efact_client, sample_json_ubl
    ):
        """Test: Network error during submission raises EFactError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.RequestError(
                "Connection timeout",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document(sample_json_ubl)

            assert "Network error" in str(exc_info.value)

    def test_document_submission_includes_bearer_token(
        self, efact_client, sample_json_ubl
    ):
        """Test: Document submission includes Bearer token in headers."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ticket": "TEST123"}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            efact_client.send_document(sample_json_ubl)

            call_kwargs = mock_client.post.call_args
            headers = call_kwargs.kwargs.get("headers", call_kwargs[1].get("headers"))
            assert headers["Authorization"] == "Bearer valid_test_token"


class TestEFactClientGetDocumentStatus:
    """Tests for status checking in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_status_202_returns_processing(self, efact_client):
        """Test: HTTP 202 response returns status='processing'."""
        mock_response = MagicMock()
        mock_response.status_code = 202

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.get_document_status("TICKET123")

            assert result["status"] == "processing"

    def test_status_200_returns_success_with_cdr(self, efact_client):
        """Test: HTTP 200 response returns status='success' with CDR data."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "cdr_code": "0",
            "cdr_description": "La Factura numero B001-00000001, ha sido aceptada",
            "hash_code": "abc123hash",
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.get_document_status("TICKET123")

            assert result["status"] == "success"
            assert "cdr" in result
            assert result["cdr"]["cdr_code"] == "0"

    def test_status_412_returns_error(self, efact_client):
        """Test: HTTP 412 response returns status='error' with error details."""
        mock_response = MagicMock()
        mock_response.status_code = 412
        mock_response.json.return_value = {
            "error_code": "2800",
            "error_message": "El RUC del emisor no existe",
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.get_document_status("TICKET123")

            assert result["status"] == "error"
            assert "error" in result
            assert result["error"]["error_code"] == "2800"

    def test_unexpected_status_code_raises_efact_error(self, efact_client):
        """Test: Unexpected HTTP status code raises EFactError."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.get_document_status("TICKET123")

            assert "Unexpected status code 500" in str(exc_info.value)

    def test_status_check_network_error_raises_efact_error(self, efact_client):
        """Test: Network error during status check raises EFactError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.side_effect = httpx.RequestError(
                "Connection timeout",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.get_document_status("TICKET123")

            assert "Network error" in str(exc_info.value)


class TestEFactClientErrorHandling:
    """Tests for error handling and edge cases in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_html_response_instead_of_json_raises_error(self, efact_client):
        """Test: HTML response instead of JSON raises EFactError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError(
            "Expecting value", "<html>Error</html>", 0
        )
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            # Should catch the JSON error and wrap in EFactError
            assert "Unexpected error" in str(exc_info.value)

    def test_timeout_error_is_descriptive(self, efact_client):
        """Test: Timeout error has descriptive message."""
        timeout_error = httpx.TimeoutException(
            "Connection timed out after 30 seconds",
            request=MagicMock(),
        )

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = timeout_error
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            # httpx.TimeoutException inherits from RequestError
            error_msg = str(exc_info.value).lower()
            assert "network error" in error_msg or "timeout" in error_msg


class TestEFactClientDownloads:
    """Tests for PDF and XML download methods in EFactClient."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_download_pdf_returns_bytes(self, efact_client):
        """Test: Successful PDF download returns bytes content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"%PDF-1.4 fake pdf content"
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.download_pdf("TICKET123")

            assert isinstance(result, bytes)
            assert b"%PDF" in result

    def test_download_xml_returns_bytes(self, efact_client):
        """Test: Successful XML download returns bytes content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"<?xml version='1.0'?><Invoice></Invoice>"
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = efact_client.download_xml("TICKET123")

            assert isinstance(result, bytes)
            assert b"<?xml" in result

    def test_download_pdf_http_error_raises_efact_error(self, efact_client):
        """Test: HTTP error during PDF download raises EFactError."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"

        http_error = httpx.HTTPStatusError(
            message="404 Not Found",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.download_pdf("INVALID_TICKET")

            assert "PDF download failed" in str(exc_info.value)
            assert "404" in str(exc_info.value)

    def test_download_xml_network_error_raises_efact_error(self, efact_client):
        """Test: Network error during XML download raises EFactError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.side_effect = httpx.RequestError(
                "Connection refused",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.download_xml("TICKET123")

            assert "Network error" in str(exc_info.value)
