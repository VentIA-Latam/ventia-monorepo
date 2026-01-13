"""
eFact-OSE API Client for Electronic Invoicing (SUNAT Peru).

This module provides an HTTP client for integrating with eFact-OSE API for
electronic invoicing in Peru. It handles OAuth2 authentication, document
submission, status checking, file downloads, and JSON-UBL generation.
"""

from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, Dict, List, Optional
import json

import httpx

from app.core.config import settings


# ============================
# Custom Exceptions
# ============================

class EFactError(Exception):
    """Base exception for eFact-OSE errors."""
    pass


class EFactAuthError(EFactError):
    """Exception raised when authentication with eFact fails."""
    pass


# ============================
# Token Cache
# ============================

# Global token cache to avoid requesting a new token on every request
_token_cache: Dict[str, Any] = {
    "access_token": None,
    "expires_at": None,
}


# ============================
# EFactClient Class
# ============================

class EFactClient:
    """
    HTTP client for eFact-OSE API integration.

    Handles:
    - OAuth2 authentication with token caching
    - Document submission (invoices, credit notes, etc.)
    - Status checking
    - PDF/XML downloads
    """

    def __init__(self):
        """Initialize the eFact client with base configuration."""
        self.base_url = settings.EFACT_BASE_URL
        self.ruc_ventia = settings.EFACT_RUC_VENTIA
        self.password_rest = settings.EFACT_PASSWORD_REST
        self.token_cache_hours = settings.EFACT_TOKEN_CACHE_HOURS

        # Fixed Basic Auth header for OAuth2 (Base64 of "client:secret")
        self.oauth_basic_auth = "Basic Y2xpZW50OnNlY3JldA=="

    def _get_token(self) -> str:
        """
        Get OAuth2 access token with caching.

        Makes a POST request to /oauth/token with Basic authentication.
        Caches the token for EFACT_TOKEN_CACHE_HOURS hours (default 11h).

        Returns:
            str: Access token for API requests

        Raises:
            EFactAuthError: If authentication fails
        """
        # Check if we have a valid cached token
        if _token_cache["access_token"] and _token_cache["expires_at"]:
            if datetime.utcnow() < _token_cache["expires_at"]:
                return _token_cache["access_token"]

        # Request new token
        url = f"{self.base_url}/oauth/token"
        headers = {
            "Authorization": self.oauth_basic_auth,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = {
            "username": self.ruc_ventia,
            "password": self.password_rest,
            "grant_type": "password",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, data=data)
                response.raise_for_status()

                token_data = response.json()
                access_token = token_data.get("access_token")

                if not access_token:
                    raise EFactAuthError("No access_token in response")

                # Cache token with expiration time
                expires_at = datetime.utcnow() + timedelta(hours=self.token_cache_hours)
                _token_cache["access_token"] = access_token
                _token_cache["expires_at"] = expires_at

                return access_token

        except httpx.HTTPStatusError as e:
            raise EFactAuthError(
                f"Authentication failed with status {e.response.status_code}: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise EFactAuthError(f"Network error during authentication: {str(e)}")
        except Exception as e:
            raise EFactAuthError(f"Unexpected error during authentication: {str(e)}")

    def send_document(self, json_ubl: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a document (invoice, credit note, etc.) to eFact.

        The document is sent as a JSON file via multipart/form-data.
        The filename follows the format: {RUC}-{TIPO_DOC}-{SERIE}-{CORRELATIVO}.json

        Args:
            json_ubl: Complete JSON-UBL 2.1 document structure

        Returns:
            dict: Response containing ticket and status
                  Example: {"ticket": "ABC123", "status": "processing"}

        Raises:
            EFactError: If document submission fails
            EFactAuthError: If authentication fails
        """
        token = self._get_token()
        url = f"{self.base_url}/v1/document"
        headers = {
            "Authorization": f"Bearer {token}",
        }

        try:
            # Extract document info to build filename
            invoice_data = json_ubl.get("Invoice", [{}])[0]

            # Get RUC from supplier party
            ruc_emisor = (
                invoice_data.get("AccountingSupplierParty", [{}])[0]
                .get("Party", [{}])[0]
                .get("PartyIdentification", [{}])[0]
                .get("ID", [{}])[0]
                .get("IdentifierContent", "")
            )

            # Get document type code
            tipo_documento = (
                invoice_data.get("InvoiceTypeCode", [{}])[0]
                .get("CodeContent", "")
            )

            # Get full document number (e.g., "B001-00000123")
            numero_documento = (
                invoice_data.get("ID", [{}])[0]
                .get("IdentifierContent", "")
            )

            # Split serie and correlativo from document number
            if "-" in numero_documento:
                serie, correlativo = numero_documento.split("-", 1)
            else:
                serie = ""
                correlativo = numero_documento

            # Build filename: RUC-TIPO_DOC-SERIE-CORRELATIVO.json
            filename = f"{ruc_emisor}-{tipo_documento}-{serie}-{correlativo}.json"

            # Convert JSON dict to string and then to bytes
            json_string = json.dumps(json_ubl, ensure_ascii=False)
            json_bytes = json_string.encode('utf-8')

            # Create file-like object in memory
            json_file = BytesIO(json_bytes)

            # Send as multipart/form-data with key "file"
            files = {
                'file': (filename, json_file, 'application/json')
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, files=files)
                response.raise_for_status()

                result = response.json()
                return result

        except httpx.HTTPStatusError as e:
            raise EFactError(
                f"Document submission failed with status {e.response.status_code}: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise EFactError(f"Network error during document submission: {str(e)}")
        except Exception as e:
            raise EFactError(f"Unexpected error during document submission: {str(e)}")

    def get_document_status(self, ticket: str) -> Dict[str, Any]:
        """
        Check the processing status of a submitted document.

        Args:
            ticket: The ticket ID returned when the document was submitted

        Returns:
            dict: Status information with one of:
                - {"status": "processing"} - Still being processed (HTTP 202)
                - {"status": "success", "cdr": {...}} - Successfully processed (HTTP 200)
                - {"status": "error", "error": {...}} - Processing failed (HTTP 412)

        Raises:
            EFactError: If status check fails with unexpected status code
            EFactAuthError: If authentication fails
        """
        token = self._get_token()
        url = f"{self.base_url}/v1/document/{ticket}"
        headers = {
            "Authorization": f"Bearer {token}",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=headers)

                # Handle different status codes according to eFact API spec
                if response.status_code == 202:
                    # Still processing
                    return {"status": "processing"}

                elif response.status_code == 200:
                    # Successfully processed
                    data = response.json()
                    return {
                        "status": "success",
                        "cdr": data,
                    }

                elif response.status_code == 412:
                    # Processing failed (precondition failed)
                    data = response.json()
                    return {
                        "status": "error",
                        "error": data,
                    }

                else:
                    # Unexpected status code
                    raise EFactError(
                        f"Unexpected status code {response.status_code}: {response.text}"
                    )

        except httpx.RequestError as e:
            raise EFactError(f"Network error during status check: {str(e)}")
        except EFactError:
            raise
        except Exception as e:
            raise EFactError(f"Unexpected error during status check: {str(e)}")

    def download_pdf(self, ticket: str) -> bytes:
        """
        Download the PDF file for a successfully processed document.

        Args:
            ticket: The ticket ID of the document

        Returns:
            bytes: PDF file content

        Raises:
            EFactError: If download fails
            EFactAuthError: If authentication fails
        """
        token = self._get_token()
        url = f"{self.base_url}/v1/pdf/{ticket}"
        headers = {
            "Authorization": f"Bearer {token}",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()

                return response.content

        except httpx.HTTPStatusError as e:
            raise EFactError(
                f"PDF download failed with status {e.response.status_code}: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise EFactError(f"Network error during PDF download: {str(e)}")
        except Exception as e:
            raise EFactError(f"Unexpected error during PDF download: {str(e)}")

    def download_xml(self, ticket: str) -> bytes:
        """
        Download the signed XML file for a successfully processed document.

        Args:
            ticket: The ticket ID of the document

        Returns:
            bytes: XML file content

        Raises:
            EFactError: If download fails
            EFactAuthError: If authentication fails
        """
        token = self._get_token()
        url = f"{self.base_url}/v1/xml/{ticket}"
        headers = {
            "Authorization": f"Bearer {token}",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()

                return response.content

        except httpx.HTTPStatusError as e:
            raise EFactError(
                f"XML download failed with status {e.response.status_code}: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise EFactError(f"Network error during XML download: {str(e)}")
        except Exception as e:
            raise EFactError(f"Unexpected error during XML download: {str(e)}")


# ============================
# Singleton Instance
# ============================

# Global singleton instance
efact_client = EFactClient()


# ============================
# Helper Functions
# ============================


def generate_json_ubl(
    invoice_type: str,
    serie: str,
    correlativo: int,
    fecha_emision: datetime,
    emisor_ruc: str,
    emisor_razon_social: str,
    cliente_tipo_doc: str,
    cliente_numero_doc: str,
    cliente_razon_social: str,
    currency: str,
    items: List[Dict[str, Any]],
    subtotal: float,
    igv: float,
    total: float,
    emisor_nombre_comercial: Optional[str] = None,
    emisor_ubigeo: str = "150101",
    emisor_departamento: str = "LIMA",
    emisor_provincia: str = "LIMA",
    emisor_distrito: str = "LIMA",
    emisor_direccion: str = "AV. EJEMPLO 123",
    reference_type: Optional[str] = None,
    reference_serie: Optional[str] = None,
    reference_correlativo: Optional[int] = None,
    reference_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a complete JSON-UBL 2.1 document for eFact-OSE with full SUNAT compliance.

    This function generates a UBL 2.1 document in JSON format with all required
    metadata, catalog references, and proper field naming according to SUNAT standards.

    Args:
        invoice_type: Type of document ("01"=Factura, "03"=Boleta, "07"=NC, "08"=ND)
        serie: Document series (e.g., "F001", "B001")
        correlativo: Sequential number (will be zero-padded to 8 digits)
        fecha_emision: Emission date and time
        emisor_ruc: Issuer's RUC (11 digits)
        emisor_razon_social: Issuer's legal business name
        cliente_tipo_doc: Customer document type ("1"=DNI, "6"=RUC)
        cliente_numero_doc: Customer document number
        cliente_razon_social: Customer name/business name
        currency: Currency code ("PEN", "USD")
        items: List of line items with keys: quantity, description, unit_price, unit, sku
        subtotal: Subtotal without IGV
        igv: IGV amount (18%)
        total: Total amount (subtotal + igv)
        emisor_nombre_comercial: Commercial name (optional, defaults to legal name)
        emisor_ubigeo: INEI ubigeo code (default: "150101" = Lima/Lima/Lima)
        emisor_departamento: Department name (default: "LIMA")
        emisor_provincia: Province name (default: "LIMA")
        emisor_distrito: District name (default: "LIMA")
        emisor_direccion: Full address (default: "AV. EJEMPLO 123")
        reference_type: Reference document type (required for NC/ND)
        reference_serie: Reference document series (required for NC/ND)
        reference_correlativo: Reference document number (required for NC/ND)
        reference_reason: Reason for credit/debit note (required for NC/ND)

    Returns:
        dict: Complete JSON-UBL 2.1 structure with proper field naming:
            - Uses "Content" suffix for values (AmountContent, TextContent, etc.)
            - Uses "Identifier" suffix for codes (AmountCurrencyIdentifier, etc.)
            - Includes all SUNAT catalog references (URNs)
            - Includes Signature, LineCount, and full RegistrationAddress

    Raises:
        ValueError: If validation fails (empty items, total mismatch, missing references)

    Example:
        >>> items = [{"sku": "P001", "description": "Product", "quantity": 1,
        ...           "unit_price": 100.0, "unit": "NIU"}]
        >>> json_ubl = generate_json_ubl(
        ...     invoice_type="03", serie="B001", correlativo=1,
        ...     fecha_emision=datetime.now(), emisor_ruc="20123456789",
        ...     emisor_razon_social="MI EMPRESA SAC", cliente_tipo_doc="1",
        ...     cliente_numero_doc="12345678", cliente_razon_social="CLIENTE",
        ...     currency="PEN", items=items, subtotal=100.0, igv=18.0, total=118.0
        ... )
    """
    # ============================
    # Validations
    # ============================

    # Items must not be empty
    if not items or len(items) == 0:
        raise ValueError("Items list cannot be empty")

    # Validate totals match
    expected_total = round(subtotal + igv, 2)
    if abs(total - expected_total) > 0.01:  # Allow 1 cent tolerance for rounding
        raise ValueError(
            f"Total mismatch: expected {expected_total} but got {total}"
        )

    # For credit notes (07) and debit notes (08), references are required
    if invoice_type in ["07", "08"]:
        if not all([reference_type, reference_serie, reference_correlativo, reference_reason]):
            raise ValueError(
                "Credit/Debit notes require reference_type, reference_serie, "
                "reference_correlativo, and reference_reason"
            )

    # ============================
    # Build JSON-UBL 2.1 Structure
    # ============================

    # Format date and time
    fecha_str = fecha_emision.strftime("%Y-%m-%d")
    hora_str = fecha_emision.strftime("%H:%M:%S")

    # Build document number (serie-correlativo with padding)
    numero_documento = f"{serie}-{correlativo:08d}"

    # Use commercial name if provided, otherwise use legal name
    nombre_comercial = emisor_nombre_comercial or emisor_razon_social

    # Build invoice lines (UBL 2.1 format with correct field names)
    invoice_lines = []
    for idx, item in enumerate(items, start=1):
        # Extract item data
        cantidad = item.get("quantity", 1)
        descripcion = item.get("description", "Producto")
        precio_unitario = item.get("unit_price", 0.0)
        unidad_medida = item.get("unit", "NIU")  # NIU = Unidad (Default)
        codigo = item.get("sku", f"ITEM{idx:03d}")

        # Calculate values
        valor_venta = round(cantidad * precio_unitario, 2)
        igv_item = round(valor_venta * 0.18, 2)
        precio_con_impuesto = round(precio_unitario * 1.18, 2)

        invoice_line = {
            "ID": [{"IdentifierContent": str(idx)}],
            "InvoicedQuantity": [
                {
                    "QuantityContent": str(cantidad),
                    "QuantityUnitCode": unidad_medida,
                    "QuantityUnitCodeListIdentifier": "UN/ECE rec 20",
                    "QuantityUnitCodeListAgencyNameText": "United Nations Economic Commission for Europe",
                }
            ],
            "LineExtensionAmount": [
                {
                    "AmountContent": f"{valor_venta:.2f}",
                    "AmountCurrencyIdentifier": currency,
                }
            ],
            "PricingReference": [
                {
                    "AlternativeConditionPrice": [
                        {
                            "PriceAmount": [
                                {
                                    "AmountContent": f"{precio_con_impuesto:.2f}",
                                    "AmountCurrencyIdentifier": currency,
                                }
                            ],
                            "PriceTypeCode": [
                                {
                                    "CodeContent": "01",
                                    "CodeListNameText": "Tipo de Precio",
                                    "CodeListAgencyNameText": "PE:SUNAT",
                                    "CodeListUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16",
                                }
                            ],
                        }
                    ]
                }
            ],
            "TaxTotal": [
                {
                    "TaxAmount": [
                        {
                            "AmountContent": f"{igv_item:.2f}",
                            "AmountCurrencyIdentifier": currency,
                        }
                    ],
                    "TaxSubtotal": [
                        {
                            "TaxableAmount": [
                                {
                                    "AmountContent": f"{valor_venta:.2f}",
                                    "AmountCurrencyIdentifier": currency,
                                }
                            ],
                            "TaxAmount": [
                                {
                                    "AmountContent": f"{igv_item:.2f}",
                                    "AmountCurrencyIdentifier": currency,
                                }
                            ],
                            "TaxCategory": [
                                {
                                    "Percent": [{"NumericContent": 18.00}],
                                    "TaxExemptionReasonCode": [
                                        {
                                            "CodeContent": "10",
                                            "CodeListAgencyNameText": "PE:SUNAT",
                                            "CodeListNameText": "Afectacion del IGV",
                                            "CodeListUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07",
                                        }
                                    ],
                                    "TaxScheme": [
                                        {
                                            "ID": [
                                                {
                                                    "IdentifierContent": "1000",
                                                    "IdentificationSchemeNameText": "Codigo de tributos",
                                                    "IdentificationSchemeUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05",
                                                    "IdentificationSchemeAgencyNameText": "PE:SUNAT",
                                                }
                                            ],
                                            "Name": [{"TextContent": "IGV"}],
                                            "TaxTypeCode": [{"CodeContent": "VAT"}],
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
            "Item": [
                {
                    "Description": [{"TextContent": descripcion}],
                    "SellersItemIdentification": [
                        {
                            "ID": [{"IdentifierContent": codigo}]
                        }
                    ],
                }
            ],
            "Price": [
                {
                    "PriceAmount": [
                        {
                            "AmountContent": f"{precio_unitario:.2f}",
                            "AmountCurrencyIdentifier": currency,
                        }
                    ]
                }
            ],
        }

        invoice_lines.append(invoice_line)

    # Build the complete UBL 2.1 Invoice structure
    invoice_data = {
        "UBLVersionID": [{"IdentifierContent": "2.1"}],
        "CustomizationID": [{"IdentifierContent": "2.0"}],
        "ID": [{"IdentifierContent": numero_documento}],
        "IssueDate": [{"DateContent": fecha_str}],
        "IssueTime": [{"DateTimeContent": hora_str}],
        "InvoiceTypeCode": [
            {
                "CodeContent": invoice_type,
                "CodeListNameText": "Tipo de Documento",
                "CodeListSchemeUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51",
                "CodeListIdentifier": "0101",
                "CodeNameText": "Tipo de Operacion",
                "CodeListUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01",
                "CodeListAgencyNameText": "PE:SUNAT",
            }
        ],
        "Note": [
            {
                "TextContent": numero_a_letras(total, currency),
                "LanguageLocaleIdentifier": "1000",
            }
        ],
        "DocumentCurrencyCode": [
            {
                "CodeContent": currency,
                "CodeListIdentifier": "ISO 4217 Alpha",
                "CodeListNameText": "Currency",
                "CodeListAgencyNameText": "United Nations Economic Commission for Europe",
            }
        ],
        "LineCountNumeric": [{"NumericContent": len(items)}],
        "Signature": [
            {
                "ID": [{"IdentifierContent": "IDSignature"}],
                "SignatoryParty": [
                    {
                        "PartyIdentification": [
                            {
                                "ID": [{"TextContent": emisor_ruc}]
                            }
                        ],
                        "PartyName": [
                            {
                                "Name": [{"TextContent": emisor_razon_social}]
                            }
                        ],
                    }
                ],
                "DigitalSignatureAttachment": [
                    {
                        "ExternalReference": [
                            {
                                "URI": [{"TextContent": "IDSignature"}]
                            }
                        ]
                    }
                ],
            }
        ],
        "AccountingSupplierParty": [
            {
                "Party": [
                    {
                        "PartyIdentification": [
                            {
                                "ID": [
                                    {
                                        "IdentifierContent": emisor_ruc,
                                        "IdentificationSchemeIdentifier": "6",
                                        "IdentificationSchemeNameText": "Documento de Identidad",
                                        "IdentificationSchemeAgencyNameText": "PE:SUNAT",
                                        "IdentificationSchemeUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
                                    }
                                ]
                            }
                        ],
                        "PartyName": [
                            {
                                "Name": [{"TextContent": nombre_comercial}]
                            }
                        ],
                        "PartyLegalEntity": [
                            {
                                "RegistrationName": [{"TextContent": emisor_razon_social}],
                                "RegistrationAddress": [
                                    {
                                        "ID": [
                                            {
                                                "IdentifierContent": emisor_ubigeo,
                                                "IdentificationSchemeAgencyNameText": "PE:INEI",
                                                "IdentificationSchemeNameText": "Ubigeos",
                                            }
                                        ],
                                        "AddressTypeCode": [
                                            {
                                                "CodeContent": "0000",
                                                "CodeListAgencyNameText": "PE:SUNAT",
                                                "CodeListNameText": "Establecimientos anexos",
                                            }
                                        ],
                                        "CityName": [{"TextContent": emisor_provincia}],
                                        "CountrySubentity": [{"TextContent": emisor_departamento}],
                                        "District": [{"TextContent": emisor_distrito}],
                                        "AddressLine": [
                                            {
                                                "Line": [{"TextContent": emisor_direccion}]
                                            }
                                        ],
                                        "Country": [
                                            {
                                                "IdentificationCode": [
                                                    {
                                                        "CodeContent": "PE",
                                                        "CodeListIdentifier": "ISO 3166-1",
                                                        "CodeListAgencyNameText": "United Nations Economic Commission for Europe",
                                                    }
                                                ]
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        ],
        "AccountingCustomerParty": [
            {
                "Party": [
                    {
                        "PartyIdentification": [
                            {
                                "ID": [
                                    {
                                        "IdentifierContent": cliente_numero_doc,
                                        "IdentificationSchemeIdentifier": cliente_tipo_doc,
                                        "IdentificationSchemeNameText": "Documento de Identidad",
                                        "IdentificationSchemeAgencyNameText": "PE:SUNAT",
                                        "IdentificationSchemeUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
                                    }
                                ]
                            }
                        ],
                        "PartyLegalEntity": [
                            {
                                "RegistrationName": [{"TextContent": cliente_razon_social}]
                            }
                        ],
                    }
                ]
            }
        ],
        "TaxTotal": [
            {
                "TaxAmount": [
                    {
                        "AmountContent": f"{round(igv, 2):.2f}",
                        "AmountCurrencyIdentifier": currency,
                    }
                ],
                "TaxSubtotal": [
                    {
                        "TaxableAmount": [
                            {
                                "AmountContent": f"{round(subtotal, 2):.2f}",
                                "AmountCurrencyIdentifier": currency,
                            }
                        ],
                        "TaxAmount": [
                            {
                                "AmountContent": f"{round(igv, 2):.2f}",
                                "AmountCurrencyIdentifier": currency,
                            }
                        ],
                        "TaxCategory": [
                            {
                                "TaxScheme": [
                                    {
                                        "ID": [
                                            {
                                                "IdentifierContent": "1000",
                                                "IdentificationSchemeNameText": "Codigo de tributos",
                                                "IdentificationSchemeUniformResourceIdentifier": "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05",
                                                "IdentificationSchemeAgencyNameText": "PE:SUNAT",
                                            }
                                        ],
                                        "Name": [{"TextContent": "IGV"}],
                                        "TaxTypeCode": [{"CodeContent": "VAT"}],
                                    }
                                ]
                            }
                        ],
                    }
                ],
            }
        ],
        "LegalMonetaryTotal": [
            {
                "LineExtensionAmount": [
                    {
                        "AmountContent": f"{round(subtotal, 2):.2f}",
                        "AmountCurrencyIdentifier": currency,
                    }
                ],
                "TaxInclusiveAmount": [
                    {
                        "AmountContent": f"{round(total, 2):.2f}",
                        "AmountCurrencyIdentifier": currency,
                    }
                ],
                "PayableAmount": [
                    {
                        "AmountContent": f"{round(total, 2):.2f}",
                        "AmountCurrencyIdentifier": currency,
                    }
                ],
            }
        ],
        "InvoiceLine": invoice_lines,
    }

    # ============================
    # Add References (for NC/ND)
    # ============================

    if invoice_type in ["07", "08"] and reference_type:
        invoice_data["BillingReference"] = [
            {
                "InvoiceDocumentReference": [
                    {
                        "ID": [{"IdentifierContent": f"{reference_serie}-{reference_correlativo:08d}"}],
                        "DocumentTypeCode": [{"CodeContent": reference_type}],
                    }
                ]
            }
        ]
        invoice_data["DiscrepancyResponse"] = [
            {
                "ReferenceID": [{"IdentifierContent": f"{reference_serie}-{reference_correlativo:08d}"}],
                "ResponseCode": [{"CodeContent": "01"}],  # 01 = Anulación de la operación
                "Description": [{"TextContent": reference_reason}],
            }
        ]

    # ============================
    # Wrap in UBL 2.1 Root with Namespaces
    # ============================

    json_ubl: Dict[str, Any] = {
        "_D": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
        "_S": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "_B": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "_E": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
        "Invoice": [invoice_data],
    }

    return json_ubl


def numero_a_letras(numero: float, moneda: str = "PEN") -> str:
    """
    Convert a number to its text representation according to SUNAT rules.

    Args:
        numero: The amount to convert
        moneda: Currency code ("PEN" or "USD")

    Returns:
        str: Amount in words

    Examples:
        >>> numero_a_letras(150.50, "PEN")
        "CIENTO CINCUENTA CON 50/100 SOLES"

        >>> numero_a_letras(1000.00, "USD")
        "UN MIL CON 00/100 DÓLARES AMERICANOS"
    """
    # Split into integer and decimal parts
    entero = int(numero)
    decimal = int(round((numero - entero) * 100))

    # Convert integer part to words
    letras_entero = _numero_entero_a_letras(entero)

    # Decimal part always as XX/100
    decimal_str = f"{decimal:02d}/100"

    # Currency name
    if moneda == "PEN":
        moneda_str = "SOLES" if entero != 1 else "SOL"
    elif moneda == "USD":
        moneda_str = "DÓLARES AMERICANOS" if entero != 1 else "DÓLAR AMERICANO"
    else:
        moneda_str = moneda

    return f"{letras_entero} CON {decimal_str} {moneda_str}"


def _numero_entero_a_letras(numero: int) -> str:
    """
    Convert an integer to its text representation in Spanish.

    Args:
        numero: Integer to convert (0-999999999)

    Returns:
        str: Number in words
    """
    if numero == 0:
        return "CERO"

    # Units (1-9)
    unidades = [
        "", "UNO", "DOS", "TRES", "CUATRO", "CINCO",
        "SEIS", "SIETE", "OCHO", "NUEVE"
    ]

    # Tens (10-19) - Special cases
    diez_a_diecinueve = [
        "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
        "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
    ]

    # Tens (20-90)
    decenas = [
        "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
        "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
    ]

    # Hundreds (100-900)
    centenas = [
        "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
        "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
    ]

    def convertir_grupo(n: int) -> str:
        """Convert a group of up to 3 digits."""
        if n == 0:
            return ""

        # Special case: 100
        if n == 100:
            return "CIEN"

        resultado = ""

        # Hundreds
        c = n // 100
        if c > 0:
            resultado += centenas[c]

        # Tens and units
        resto = n % 100

        if resto == 0:
            return resultado

        if resultado:
            resultado += " "

        # Special cases 10-19
        if 10 <= resto <= 19:
            resultado += diez_a_diecinueve[resto - 10]
        else:
            d = resto // 10
            u = resto % 10

            if d > 0:
                resultado += decenas[d]

            if u > 0:
                if d == 2:  # 21-29 use "VEINTI"
                    resultado = "VEINTI" + unidades[u]
                else:
                    if d > 0:
                        resultado += " Y "
                    resultado += unidades[u]

        return resultado

    # Process number in groups of thousands
    if numero < 1000:
        return convertir_grupo(numero)

    elif numero < 1000000:
        miles = numero // 1000
        resto = numero % 1000

        resultado = ""
        if miles == 1:
            resultado = "UN MIL"
        else:
            resultado = convertir_grupo(miles) + " MIL"

        if resto > 0:
            resultado += " " + convertir_grupo(resto)

        return resultado

    elif numero < 1000000000:
        millones = numero // 1000000
        resto = numero % 1000000

        resultado = ""
        if millones == 1:
            resultado = "UN MILLÓN"
        else:
            resultado = convertir_grupo(millones) + " MILLONES"

        if resto > 0:
            if resto >= 1000:
                miles = resto // 1000
                resto_final = resto % 1000

                if miles == 1:
                    resultado += " UN MIL"
                else:
                    resultado += " " + convertir_grupo(miles) + " MIL"

                if resto_final > 0:
                    resultado += " " + convertir_grupo(resto_final)
            else:
                resultado += " " + convertir_grupo(resto)

        return resultado

    return str(numero)  # Fallback for very large numbers


def validar_ruc(ruc: str) -> bool:
    """
    Validate a RUC (Registro Único de Contribuyentes) number.

    Args:
        ruc: RUC string to validate

    Returns:
        bool: True if valid, False otherwise
    """
    if not ruc:
        return False

    # Must be exactly 11 digits
    if len(ruc) != 11:
        return False

    # Must be numeric
    if not ruc.isdigit():
        return False

    return True


def validar_dni(dni: str) -> bool:
    """
    Validate a DNI (Documento Nacional de Identidad) number.

    Args:
        dni: DNI string to validate

    Returns:
        bool: True if valid, False otherwise
    """
    if not dni:
        return False

    # Must be exactly 8 digits
    if len(dni) != 8:
        return False

    # Must be numeric
    if not dni.isdigit():
        return False

    return True
