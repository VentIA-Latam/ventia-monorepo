"""
Timezone utilities for converting between tenant local time and UTC.

All database timestamps are stored as naive UTC datetimes.
These helpers convert tenant-local dates to UTC ranges for querying,
and convert UTC datetimes back to tenant-local for display/export.
"""

from datetime import date, datetime, timezone

from zoneinfo import ZoneInfo


def get_date_range_utc(
    start_date: date,
    end_date: date,
    tz_name: str = "America/Lima",
) -> tuple[datetime, datetime]:
    """
    Convert local dates to a UTC datetime range for DB queries.

    Takes date boundaries in the tenant's timezone and converts them to
    naive UTC datetimes that match created_at (stored as naive UTC).

    Args:
        start_date: Start date in tenant's timezone
        end_date: End date in tenant's timezone
        tz_name: IANA timezone name (e.g., 'America/Lima')

    Returns:
        Tuple of (start_datetime, end_datetime) as naive UTC
    """
    tz = ZoneInfo(tz_name)
    start_local = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
    end_local = datetime.combine(end_date, datetime.max.time(), tzinfo=tz)

    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)

    return start_utc, end_utc


def utc_to_local(dt: datetime, tz_name: str = "America/Lima") -> datetime:
    """
    Convert a naive UTC datetime to the tenant's local timezone.

    Args:
        dt: Naive UTC datetime
        tz_name: IANA timezone name

    Returns:
        Timezone-aware datetime in the tenant's local timezone
    """
    tz = ZoneInfo(tz_name)
    utc_aware = dt.replace(tzinfo=timezone.utc)
    return utc_aware.astimezone(tz)
