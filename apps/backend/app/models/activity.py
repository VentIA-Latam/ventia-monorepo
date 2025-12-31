"""
Activity model - tracks platform activity for audit trail and analytics.
"""

from sqlalchemy import Column, Integer, String, Text

from app.models.base import Base, TimestampMixin


class Activity(Base, TimestampMixin):
    """
    Activity model - records important platform events.

    Tracks: tenant creation, user updates, API key creation, etc.
    """

    __tablename__ = "activities"

    # Activity details
    action_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of action (e.g., 'tenant_created', 'user_updated', 'api_key_created')",
    )
    description = Column(
        Text,
        nullable=False,
        comment="Human-readable description of the action",
    )
    entity_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of entity affected (tenant, user, api_key, order)",
    )
    entity_id = Column(
        Integer,
        nullable=True,
        index=True,
        comment="ID of the affected entity (if applicable)",
    )
    performed_by = Column(
        String(255),
        nullable=True,
        comment="Email of user who performed the action (None for system)",
    )

    def __repr__(self) -> str:
        """String representation of Activity."""
        return f"<Activity(id={self.id}, action_type='{self.action_type}', entity_type='{self.entity_type}')>"
