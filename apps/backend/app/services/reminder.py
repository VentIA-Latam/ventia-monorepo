"""
Service layer for temperature reminder messages.

Orchestrates reading tenant config from DB and communicating with n8n.
"""

import logging

from sqlalchemy.orm import Session

from app.integrations.n8n_client import N8NError, n8n_client
from app.models.tenant import Tenant
from app.schemas.reminder import (
    ReminderMessage,
    ReminderMessagesResponse,
    ReminderMessageUpdate,
    ReminderWindow,
)

logger = logging.getLogger(__name__)


class ReminderService:
    """Business logic for reading and updating reminder messages."""

    async def get_messages(
        self, tenant_id: int, db: Session
    ) -> ReminderMessagesResponse:
        """
        Get all reminder messages for a tenant.

        Reads the tenant's workflow ID, fetches the workflow from n8n,
        and extracts messages by traversing the graph.
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        workflow_id = tenant.n8n_reminder_workflow_id
        if not workflow_id:
            return ReminderMessagesResponse(
                windows=[], workflow_configured=False
            )

        workflow = await n8n_client.get_workflow(workflow_id)
        result = n8n_client.extract_reminder_messages(workflow)

        return ReminderMessagesResponse(
            windows=[
                ReminderWindow(
                    window=w["window"],
                    window_label=w["window_label"],
                    messages=[
                        ReminderMessage(**m) for m in w["messages"]
                    ],
                )
                for w in result["windows"]
            ],
            workflow_configured=True,
        )

    async def update_messages(
        self,
        tenant_id: int,
        updates: list[ReminderMessageUpdate],
        db: Session,
    ) -> ReminderMessagesResponse:
        """
        Update reminder message texts in n8n.

        Fetches the current workflow, validates node IDs, applies updates,
        and PUTs the updated workflow back to n8n.
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        workflow_id = tenant.n8n_reminder_workflow_id
        if not workflow_id:
            raise ValueError("Tenant does not have a reminder workflow configured")

        # Fetch current workflow
        workflow = await n8n_client.get_workflow(workflow_id)

        # Validate node IDs exist in the workflow
        current = n8n_client.extract_reminder_messages(workflow)
        valid_node_ids = set()
        for w in current["windows"]:
            for m in w["messages"]:
                valid_node_ids.add(m["node_id"])

        for update in updates:
            if update.node_id not in valid_node_ids:
                raise N8NError(
                    f"Node ID '{update.node_id}' is not a valid reminder message node"
                )

        # Apply updates and save
        update_dicts = [{"node_id": u.node_id, "text": u.text} for u in updates]
        n8n_client.apply_message_updates(workflow, update_dicts)
        await n8n_client.update_workflow(workflow_id, workflow)

        logger.info(
            f"Updated {len(updates)} reminder messages for tenant {tenant_id}"
        )

        # Return updated state
        return await self.get_messages(tenant_id, db)


reminder_service = ReminderService()
