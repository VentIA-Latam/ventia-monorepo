"""
Base model class with common fields.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.ext.declarative import declared_attr

from app.core.database import Base as SQLAlchemyBase


class TimestampMixin:
    """Mixin to add created_at and updated_at timestamps to models."""

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Base(SQLAlchemyBase):
    """
    Base model class for all database models.

    Includes:
    - id: Primary key
    - __tablename__: Auto-generated from class name (snake_case)
    """

    __abstract__ = True  # This is not a table itself

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name (convert CamelCase to snake_case)."""
        import re

        # Convert CamelCase to snake_case
        # Example: UserAccount -> user_account
        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", cls.__name__)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()
