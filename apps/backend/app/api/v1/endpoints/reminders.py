"""
Reminder message endpoints.

Allows ADMIN and SUPERADMIN users to read and update
temperature-based reminder messages stored in n8n workflows.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_database, require_permission_dual
from app.integrations.n8n_client import N8NConnectionError, N8NError
from app.models.user import User
from app.schemas.reminder import (
    ReminderMessagesResponse,
    ReminderMessagesUpdateRequest,
    WorkflowStatusResponse,
    WorkflowStatusUpdate,
)
from app.services.reminder import reminder_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/messages",
    response_model=ReminderMessagesResponse,
    tags=["reminders"],
)
async def get_reminder_messages(
    current_user: User = Depends(require_permission_dual("GET", "/reminders/messages")),
    db: Session = Depends(get_database),
) -> ReminderMessagesResponse:
    """
    Get all reminder messages for the current tenant.

    Returns the messages grouped by time window, with each message's
    temperature, text, and n8n node ID. The structure is discovered
    dynamically from the n8n workflow graph.

    **Permissions:** ADMIN, SUPERADMIN
    """
    try:
        return await reminder_service.get_messages(current_user.tenant_id, db)
    except N8NConnectionError as e:
        logger.error(f"n8n connection error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cannot connect to n8n service",
        )
    except N8NError as e:
        logger.error(f"n8n error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading reminder messages: {e.message}",
        )


@router.put(
    "/messages",
    response_model=ReminderMessagesResponse,
    tags=["reminders"],
)
async def update_reminder_messages(
    body: ReminderMessagesUpdateRequest,
    current_user: User = Depends(require_permission_dual("PUT", "/reminders/messages")),
    db: Session = Depends(get_database),
) -> ReminderMessagesResponse:
    """
    Update reminder message texts in the tenant's n8n workflow.

    Accepts a list of {node_id, text} pairs. Each node_id must correspond
    to a valid message node in the workflow.

    **Permissions:** ADMIN, SUPERADMIN
    """
    try:
        return await reminder_service.update_messages(
            current_user.tenant_id, body.messages, db
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except N8NConnectionError as e:
        logger.error(f"n8n connection error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cannot connect to n8n service",
        )
    except N8NError as e:
        logger.error(f"n8n error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )


@router.get(
    "/workflow-status",
    response_model=WorkflowStatusResponse,
    tags=["reminders"],
)
async def get_workflow_status(
    current_user: User = Depends(require_permission_dual("GET", "/reminders/*")),
    db: Session = Depends(get_database),
) -> WorkflowStatusResponse:
    """
    Get the active/inactive status of the tenant's reminder workflow.

    **Permissions:** ADMIN, SUPERADMIN
    """
    try:
        return await reminder_service.get_workflow_status(current_user.tenant_id, db)
    except N8NConnectionError as e:
        logger.error(f"n8n connection error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cannot connect to n8n service",
        )
    except N8NError as e:
        logger.error(f"n8n error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading workflow status: {e.message}",
        )


@router.patch(
    "/workflow-status",
    response_model=WorkflowStatusResponse,
    tags=["reminders"],
)
async def update_workflow_status(
    body: WorkflowStatusUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/reminders/*")),
    db: Session = Depends(get_database),
) -> WorkflowStatusResponse:
    """
    Activate or deactivate the tenant's reminder workflow in n8n.

    **Permissions:** ADMIN, SUPERADMIN
    """
    try:
        return await reminder_service.set_workflow_active(
            current_user.tenant_id, body.active, db
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except N8NConnectionError as e:
        logger.error(f"n8n connection error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cannot connect to n8n service",
        )
    except N8NError as e:
        logger.error(f"n8n error for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )
