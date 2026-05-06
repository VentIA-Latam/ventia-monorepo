"""
US-CONV-002: Tests for phone number normalization.

Validates normalize_phone_to_e164 converts various Shopify phone formats
to E.164 standard (+XXXXXXXXXXX) matching messaging Contact model regex.
"""

import pytest

from app.core.phone import normalize_phone_to_e164


class TestNormalizePhoneToE164:
    """Tests for normalize_phone_to_e164 function."""

    # --- Valid formats ---

    def test_e164_with_plus_unchanged(self):
        """Test: Already E.164 format passes through unchanged."""
        assert normalize_phone_to_e164("+51987654321") == "+51987654321"

    def test_digits_without_plus_gets_prefix(self):
        """Test: Digits-only gets + prefix added."""
        assert normalize_phone_to_e164("51987654321") == "+51987654321"

    def test_us_format_with_parentheses(self):
        """Test: US format +1(502)-459-2181 normalized to +15024592181."""
        assert normalize_phone_to_e164("+1(502)-459-2181") == "+15024592181"

    def test_dashes_only(self):
        """Test: Dashes stripped, + prefix added."""
        assert normalize_phone_to_e164("555-625-1199") == "+5556251199"

    def test_spaces_and_dashes(self):
        """Test: Spaces and dashes stripped."""
        assert normalize_phone_to_e164("+51 987 654 321") == "+51987654321"

    def test_short_valid_number(self):
        """Test: 8-char number is minimum valid length."""
        assert normalize_phone_to_e164("98765432") == "+98765432"

    def test_double_plus_corrected(self):
        """Test: Double ++ prefix corrected to single +."""
        assert normalize_phone_to_e164("++51987654321") == "+51987654321"

    def test_peru_mobile(self):
        """Test: Typical Peru mobile number."""
        assert normalize_phone_to_e164("+51 912 345 678") == "+51912345678"

    def test_max_length_e164(self):
        """Test: Maximum E.164 length (15 digits) is valid."""
        assert normalize_phone_to_e164("+123456789012345") == "+123456789012345"

    # --- Invalid formats → None ---

    def test_none_returns_none(self):
        """Test: None input returns None."""
        assert normalize_phone_to_e164(None) is None

    def test_empty_string_returns_none(self):
        """Test: Empty string returns None."""
        assert normalize_phone_to_e164("") is None

    def test_whitespace_only_returns_none(self):
        """Test: Whitespace-only returns None."""
        assert normalize_phone_to_e164("   ") is None

    def test_too_short_returns_none(self):
        """Test: Less than 8 chars after normalization returns None."""
        assert normalize_phone_to_e164("123") is None

    def test_plus_only_returns_none(self):
        """Test: Just a + sign returns None."""
        assert normalize_phone_to_e164("+") is None

    def test_leading_zero_returns_none(self):
        """Test: Leading zero after + rejected by E.164 regex."""
        assert normalize_phone_to_e164("+0123456789") is None

    def test_letters_only_returns_none(self):
        """Test: All letters with no digits returns None."""
        assert normalize_phone_to_e164("abcdefgh") is None

    def test_letters_mixed_with_few_digits_returns_none(self):
        """Test: Letters mixed with too few digits returns None."""
        assert normalize_phone_to_e164("abc12def") is None

    def test_letters_mixed_with_enough_digits(self):
        """Test: Letters stripped, remaining digits normalized if valid."""
        # "abc51987654321def" → digits "51987654321" → "+51987654321"
        assert normalize_phone_to_e164("abc51987654321def") == "+51987654321"

    def test_exceeds_max_e164_length_returns_none(self):
        """Test: More than 15 digits after + is invalid E.164."""
        assert normalize_phone_to_e164("+1234567890123456") is None
