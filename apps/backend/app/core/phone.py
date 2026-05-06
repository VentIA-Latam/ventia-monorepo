"""
Phone number normalization utilities.

Normalizes phone numbers from various formats (Shopify, user input)
to E.164 standard format used by the messaging service.

Messaging Contact model validates: /\\A\\+[1-9]\\d{1,14}\\z/
"""

import re


def normalize_phone_to_e164(raw_phone: str | None) -> str | None:
    """
    Normalize a phone number to E.164 format (+XXXXXXXXXXX).

    Messaging stores WhatsApp contacts as +XXXXXXXXXXX (E.164 strict).
    Shopify may send: +51987654321, 51987654321, +1(502)-459-2181, 555-625-1199

    Process:
    1. Strip everything except digits and +
    2. Ensure starts with +
    3. Validate against E.164 regex (same as messaging Contact model)
    4. Validate minimum length (country code + local number)

    Args:
        raw_phone: Raw phone string from Shopify or other source

    Returns:
        Normalized phone as +XXXXXXXXXXX or None if invalid
    """
    if not raw_phone or not raw_phone.strip():
        return None

    # Step 1: strip everything except digits and + (same as messaging Contact#prepare_contact_attributes)
    cleaned = re.sub(r"[^\d+]", "", raw_phone)

    if not cleaned:
        return None

    # Step 2: ensure starts with +
    if not cleaned.startswith("+"):
        cleaned = f"+{cleaned}"

    # Step 3: remove duplicate + signs
    cleaned = "+" + cleaned.lstrip("+")

    # Step 4: validate E.164 format (same regex as messaging Contact model)
    if not re.match(r"^\+[1-9]\d{1,14}$", cleaned):
        return None

    # Step 5: validate minimum length (country code + at least 6 digits)
    if len(cleaned) < 8:
        return None

    return cleaned
