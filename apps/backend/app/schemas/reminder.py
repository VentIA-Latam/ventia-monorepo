"""
Schemas for temperature reminder messages.
"""

from pydantic import BaseModel, Field


class ReminderMessage(BaseModel):
    """A single reminder message from an n8n workflow."""

    node_id: str = Field(..., description="Unique n8n node ID")
    node_name: str = Field(..., description="Node name in the workflow")
    temperature: str = Field(..., description="Temperature label (e.g., frio, tibio, caliente)")
    text: str = Field(..., description="Message text content")


class ReminderWindow(BaseModel):
    """A time window containing reminder messages."""

    window: int = Field(..., description="Window index (0-based)")
    window_label: str = Field(..., description="Window label (e.g., primer_recordatorio)")
    messages: list[ReminderMessage] = Field(default_factory=list)


class ReminderMessagesResponse(BaseModel):
    """Response for GET /reminders/messages."""

    windows: list[ReminderWindow] = Field(default_factory=list)
    workflow_configured: bool = Field(
        ..., description="Whether the tenant has an n8n reminder workflow configured"
    )


class ReminderMessageUpdate(BaseModel):
    """A single message update."""

    node_id: str = Field(..., description="n8n node ID to update")
    text: str = Field(..., min_length=1, max_length=300, description="New message text")


class ReminderMessagesUpdateRequest(BaseModel):
    """Request body for PUT /reminders/messages."""

    messages: list[ReminderMessageUpdate] = Field(
        ..., min_length=1, description="Messages to update"
    )
