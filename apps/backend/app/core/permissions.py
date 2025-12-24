"""
Role-based access control (RBAC) system.
"""

from enum import Enum
from typing import Dict, List, Tuple


class Role(str, Enum):
    """User roles in the system."""

    ADMIN = "admin"  # Full access to all resources
    LOGISTICA = "logistica"  # Can manage orders and validate payments
    VENTAS = "ventas"  # Can view and create orders
    VIEWER = "viewer"  # Read-only access


# Permissions map: (HTTP method, path pattern) -> allowed roles
PERMISSIONS: Dict[Tuple[str, str], List[Role]] = {
    # ORDERS ENDPOINTS
    ("GET", "/orders"): [Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("GET", "/orders/*"): [Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("POST", "/orders"): [Role.ADMIN, Role.VENTAS],
    ("PUT", "/orders/*"): [Role.ADMIN, Role.LOGISTICA],
    ("POST", "/orders/*/validate"): [Role.ADMIN, Role.LOGISTICA],
    ("DELETE", "/orders/*"): [Role.ADMIN],

    # USERS ENDPOINTS (only ADMIN)
    ("GET", "/users"): [Role.ADMIN],
    ("GET", "/users/*"): [Role.ADMIN],
    ("POST", "/users"): [Role.ADMIN],
    ("PUT", "/users/*"): [Role.ADMIN],
    ("DELETE", "/users/*"): [Role.ADMIN],

    # TENANTS ENDPOINTS (only ADMIN)
    ("GET", "/tenants"): [Role.ADMIN],
    ("GET", "/tenants/*"): [Role.ADMIN],
    ("POST", "/tenants"): [Role.ADMIN],
    ("PUT", "/tenants/*"): [Role.ADMIN],
    ("DELETE", "/tenants/*"): [Role.ADMIN],
}


def can_access(role: Role, method: str, path: str) -> bool:
    """
    Check if a role has permission to access a specific endpoint.

    Args:
        role: User's role
        method: HTTP method (GET, POST, PUT, DELETE)
        path: Request path (e.g., "/orders", "/orders/123")

    Returns:
        bool: True if role has permission, False otherwise

    Example:
        >>> can_access(Role.ADMIN, "GET", "/orders")
        True
        >>> can_access(Role.VIEWER, "POST", "/orders/123/validate")
        False
    """
    # Normalize path (remove leading /api/v1 if present)
    normalized_path = path.replace("/api/v1", "")

    # Try exact match first
    key = (method, normalized_path)
    if key in PERMISSIONS:
        return role in PERMISSIONS[key]

    # Try wildcard match
    for (perm_method, perm_path), allowed_roles in PERMISSIONS.items():
        if perm_method == method and perm_path.endswith("/*"):
            # Convert "/orders/*" to "/orders/"
            pattern_prefix = perm_path[:-1]  # Remove *
            if normalized_path.startswith(pattern_prefix):
                return role in allowed_roles

    # No permission found - deny by default
    return False


def get_allowed_roles(method: str, path: str) -> List[Role]:
    """
    Get list of roles allowed to access a specific endpoint.

    Args:
        method: HTTP method
        path: Request path

    Returns:
        List[Role]: List of allowed roles, empty if no permissions defined
    """
    normalized_path = path.replace("/api/v1", "")

    # Try exact match
    key = (method, normalized_path)
    if key in PERMISSIONS:
        return PERMISSIONS[key]

    # Try wildcard match
    for (perm_method, perm_path), allowed_roles in PERMISSIONS.items():
        if perm_method == method and perm_path.endswith("/*"):
            pattern_prefix = perm_path[:-1]
            if normalized_path.startswith(pattern_prefix):
                return allowed_roles

    return []
