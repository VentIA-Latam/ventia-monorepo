"""
n8n API client for reading and updating reminder workflows.

Discovers message nodes dynamically by traversing the workflow graph:
Switch Ventana → Switch Temperatura N → Mensaje N (n8n-nodes-base.set)
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class N8NError(Exception):
    """Base exception for n8n API errors."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class N8NConnectionError(N8NError):
    """Raised when n8n is unreachable."""
    pass


class N8NClient:
    """Client for interacting with the n8n REST API."""

    def __init__(self):
        self.base_url = settings.N8N_BASE_URL.rstrip("/")
        self.headers = {
            "X-N8N-API-KEY": settings.N8N_API_KEY,
            "Content-Type": "application/json",
        }

    async def get_workflow(self, workflow_id: str) -> dict[str, Any]:
        """Fetch a workflow by ID from n8n."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/workflows/{workflow_id}",
                    headers=self.headers,
                )
            except httpx.ConnectError as e:
                raise N8NConnectionError(f"Cannot connect to n8n: {e}")

            if response.status_code == 404:
                raise N8NError(f"Workflow {workflow_id} not found", status_code=404)
            if response.status_code != 200:
                raise N8NError(
                    f"n8n API error: {response.status_code} - {response.text}",
                    status_code=response.status_code,
                )
            return response.json()

    async def update_workflow(
        self, workflow_id: str, workflow: dict[str, Any]
    ) -> dict[str, Any]:
        """Update a workflow in n8n via PUT."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.put(
                    f"{self.base_url}/api/v1/workflows/{workflow_id}",
                    headers=self.headers,
                    json={
                        "name": workflow["name"],
                        "nodes": workflow["nodes"],
                        "connections": workflow["connections"],
                        "settings": workflow.get("settings", {}),
                    },
                )
            except httpx.ConnectError as e:
                raise N8NConnectionError(f"Cannot connect to n8n: {e}")

            if response.status_code not in (200, 201):
                raise N8NError(
                    f"Failed to update workflow: {response.status_code} - {response.text}",
                    status_code=response.status_code,
                )
            return response.json()

    def extract_reminder_messages(
        self, workflow: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Traverse the workflow graph to discover all reminder messages.

        Algorithm:
        1. Find "Switch Ventana" node
        2. Follow its connections to Switch Temperatura nodes (one per window)
        3. Read each Switch Temperatura's rules for temperature values
        4. Follow connections to Set nodes (message nodes)
        5. Extract text from each message node

        Returns:
            {"windows": [...], "workflow_configured": True}
        """
        nodes_by_name: dict[str, dict[str, Any]] = {
            n["name"]: n for n in workflow["nodes"]
        }
        nodes_by_id: dict[str, dict[str, Any]] = {
            n["id"]: n for n in workflow["nodes"]
        }
        connections: dict = workflow.get("connections", {})

        # Find Switch Ventana
        switch_ventana = nodes_by_name.get("Switch Ventana")
        if not switch_ventana:
            return {"windows": [], "workflow_configured": True}

        # Get window rules from Switch Ventana
        window_rules = (
            switch_ventana.get("parameters", {})
            .get("rules", {})
            .get("values", [])
        )

        # Get connections from Switch Ventana
        ventana_outputs = connections.get("Switch Ventana", {}).get("main", [])

        windows = []

        for win_idx, output_conns in enumerate(ventana_outputs):
            # Get window label from rule
            win_label = self._get_rule_value(window_rules, win_idx)

            # Find the Switch Temperatura connected to this output
            switch_temp_name = None
            for conn in output_conns:
                node = nodes_by_name.get(conn["node"])
                if node and node["type"] == "n8n-nodes-base.switch":
                    switch_temp_name = conn["node"]
                    break

            if not switch_temp_name:
                continue

            switch_temp = nodes_by_name[switch_temp_name]
            temp_rules = (
                switch_temp.get("parameters", {})
                .get("rules", {})
                .get("values", [])
            )

            # Get connections from this Switch Temperatura
            temp_outputs = connections.get(switch_temp_name, {}).get("main", [])

            messages = []
            for temp_idx, temp_output_conns in enumerate(temp_outputs):
                temperature = self._get_rule_value(temp_rules, temp_idx)
                if not temperature:
                    continue

                # Find the message node (type n8n-nodes-base.set)
                for conn in temp_output_conns:
                    msg_node = nodes_by_name.get(conn["node"])
                    if msg_node and msg_node["type"] == "n8n-nodes-base.set":
                        text = self._extract_message_text(msg_node)
                        messages.append(
                            {
                                "node_id": msg_node["id"],
                                "node_name": msg_node["name"],
                                "temperature": temperature,
                                "text": text,
                            }
                        )
                        break

            windows.append(
                {
                    "window": win_idx,
                    "window_label": win_label,
                    "messages": messages,
                }
            )

        return {"windows": windows, "workflow_configured": True}

    def apply_message_updates(
        self,
        workflow: dict[str, Any],
        updates: list[dict[str, str]],
    ) -> dict[str, Any]:
        """
        Apply message text updates to workflow nodes in-place.

        Args:
            workflow: Full workflow dict (will be mutated)
            updates: List of {"node_id": "...", "text": "..."}

        Returns:
            The mutated workflow dict

        Raises:
            N8NError: If a node_id is not found or is not a Set node
        """
        nodes_by_id = {n["id"]: n for n in workflow["nodes"]}

        for update in updates:
            node = nodes_by_id.get(update["node_id"])
            if not node:
                raise N8NError(
                    f"Node ID '{update['node_id']}' not found in workflow"
                )
            if node["type"] != "n8n-nodes-base.set":
                raise N8NError(
                    f"Node '{node['name']}' is not a message node (type: {node['type']})"
                )

            assignments = (
                node.get("parameters", {})
                .get("assignments", {})
                .get("assignments", [])
            )
            for assignment in assignments:
                if assignment.get("name") == "mensaje":
                    # n8n requires "=" prefix for expression values
                    assignment["value"] = "=" + update["text"]
                    break

        return workflow

    def _get_rule_value(self, rules: list, index: int) -> str | None:
        """Extract the comparison value from a switch rule at given index."""
        if index >= len(rules):
            return None
        rule = rules[index]
        conditions = rule.get("conditions", {}).get("conditions", [])
        if conditions:
            return conditions[0].get("rightValue")
        return None

    def _extract_message_text(self, node: dict[str, Any]) -> str:
        """Extract message text from a Set node's assignments."""
        assignments = (
            node.get("parameters", {})
            .get("assignments", {})
            .get("assignments", [])
        )
        for assignment in assignments:
            if assignment.get("name") == "mensaje":
                text = assignment.get("value", "")
                # Strip the "=" prefix that n8n uses for expressions
                return text.lstrip("=")
        return ""


# Singleton instance
n8n_client = N8NClient()
