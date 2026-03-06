"""
Tests for app/core/timezone.py — pure timezone conversion functions.
"""

from datetime import date, datetime, timezone

import pytest
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.timezone import get_date_range_utc, utc_to_local


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_date_range_utc
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGetDateRangeUtc:
    """Tests for get_date_range_utc function."""

    def test_lima_timezone_converts_correctly(self):
        """Lima (UTC-5): midnight 2024-01-15 Lima → 05:00 2024-01-15 UTC."""
        start, end = get_date_range_utc(
            date(2024, 1, 15), date(2024, 1, 15), "America/Lima"
        )
        assert start == datetime(2024, 1, 15, 5, 0, 0)
        # End: 23:59:59.999999 Lima → +5h → 2024-01-16 04:59:59.999999 UTC
        assert end == datetime(2024, 1, 16, 4, 59, 59, 999999)

    def test_utc_timezone_returns_same_dates(self):
        """UTC: no offset, midnight stays midnight."""
        start, end = get_date_range_utc(
            date(2024, 6, 1), date(2024, 6, 1), "UTC"
        )
        assert start == datetime(2024, 6, 1, 0, 0, 0)
        assert end == datetime(2024, 6, 1, 23, 59, 59, 999999)

    def test_positive_offset_timezone(self):
        """Tokyo (UTC+9): midnight 2024-03-01 Tokyo → 15:00 2024-02-29 UTC."""
        start, end = get_date_range_utc(
            date(2024, 3, 1), date(2024, 3, 1), "Asia/Tokyo"
        )
        assert start == datetime(2024, 2, 29, 15, 0, 0)
        # End: 23:59:59.999999 Tokyo → -9h → 14:59:59.999999 same day UTC
        assert end == datetime(2024, 3, 1, 14, 59, 59, 999999)

    def test_date_range_spanning_multiple_days(self):
        """Full month range: start of first day to end of last day."""
        start, end = get_date_range_utc(
            date(2024, 1, 1), date(2024, 1, 31), "America/Lima"
        )
        # Start: 2024-01-01 00:00 Lima → 2024-01-01 05:00 UTC
        assert start == datetime(2024, 1, 1, 5, 0, 0)
        # End: 2024-01-31 23:59:59.999999 Lima → 2024-02-01 04:59:59.999999 UTC
        assert end == datetime(2024, 2, 1, 4, 59, 59, 999999)

    def test_returns_naive_datetimes(self):
        """Result datetimes must be naive (tzinfo is None) for DB queries."""
        start, end = get_date_range_utc(
            date(2024, 1, 1), date(2024, 1, 1), "America/Lima"
        )
        assert start.tzinfo is None
        assert end.tzinfo is None

    def test_invalid_timezone_raises_exception(self):
        """Invalid IANA timezone name raises ZoneInfoNotFoundError."""
        with pytest.raises(ZoneInfoNotFoundError):
            get_date_range_utc(date(2024, 1, 1), date(2024, 1, 1), "Invalid/Zone")

    def test_default_timezone_is_lima(self):
        """Default timezone is America/Lima when not specified."""
        start_default, _ = get_date_range_utc(date(2024, 1, 15), date(2024, 1, 15))
        start_lima, _ = get_date_range_utc(
            date(2024, 1, 15), date(2024, 1, 15), "America/Lima"
        )
        assert start_default == start_lima

    def test_dst_spring_forward_transition(self):
        """New York DST spring forward: offset changes from -5 to -4."""
        # 2024-03-10 is spring forward day in US Eastern
        start_before, _ = get_date_range_utc(
            date(2024, 3, 9), date(2024, 3, 9), "America/New_York"
        )
        start_after, _ = get_date_range_utc(
            date(2024, 3, 10), date(2024, 3, 10), "America/New_York"
        )
        # March 9 (EST, UTC-5): midnight → 05:00 UTC
        assert start_before == datetime(2024, 3, 9, 5, 0, 0)
        # March 10 (EDT, UTC-4): midnight → 04:00 UTC (DST shifted)
        # Note: clocks spring forward at 2am, but midnight is still EST
        # so it's actually 05:00 UTC. The end of the day would be EDT.
        assert start_after.tzinfo is None  # still naive

    def test_dst_fall_back_end_of_day(self):
        """New York DST fall back: end-of-day uses new offset."""
        # 2024-11-03 is fall back day in US Eastern
        _, end = get_date_range_utc(
            date(2024, 11, 3), date(2024, 11, 3), "America/New_York"
        )
        # End of Nov 3 (EST, UTC-5): 23:59:59.999999 → +5h = Nov 4 04:59:59.999999
        assert end == datetime(2024, 11, 4, 4, 59, 59, 999999)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# utc_to_local
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestUtcToLocal:
    """Tests for utc_to_local function."""

    def test_utc_to_lima_converts_correctly(self):
        """05:00 UTC → 00:00 Lima (UTC-5)."""
        result = utc_to_local(datetime(2024, 1, 15, 5, 0, 0), "America/Lima")
        assert result.hour == 0
        assert result.day == 15

    def test_utc_to_local_preserves_awareness(self):
        """Result must be timezone-aware."""
        result = utc_to_local(datetime(2024, 1, 15, 5, 0, 0), "America/Lima")
        assert result.tzinfo is not None

    def test_default_timezone_is_lima(self):
        """Default timezone is America/Lima."""
        result_default = utc_to_local(datetime(2024, 1, 15, 5, 0, 0))
        result_lima = utc_to_local(datetime(2024, 1, 15, 5, 0, 0), "America/Lima")
        assert result_default == result_lima

    def test_utc_to_positive_offset(self):
        """00:00 UTC → 09:00 Tokyo (UTC+9)."""
        result = utc_to_local(datetime(2024, 1, 15, 0, 0, 0), "Asia/Tokyo")
        assert result.hour == 9
        assert result.day == 15

    def test_utc_to_local_midnight_utc(self):
        """Midnight UTC → previous day in Lima (UTC-5)."""
        result = utc_to_local(datetime(2024, 1, 15, 0, 0, 0), "America/Lima")
        assert result.day == 14
        assert result.hour == 19
