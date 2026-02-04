"""
Role-based access control (RBAC) system.
"""

from enum import Enum
from typing import Dict, List, Tuple


class Role(str, Enum):
    """User roles in the system."""

    SUPERADMIN = "superadmin"  # Platform admin with access to all tenants
    ADMIN = "admin"  # Full access to all resources within tenant
    LOGISTICA = "logistica"  # Read-only access to orders and invoices (for dispatch)
    VENTAS = "ventas"  # Can create, edit orders, validate payments and create invoices
    VIEWER = "viewer"  # Read-only access


# Permissions map: (HTTP method, path pattern) -> allowed roles
PERMISSIONS: Dict[Tuple[str, str], List[Role]] = {
    # ORDERS ENDPOINTS
    ("GET", "/orders"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("GET", "/orders/*"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("POST", "/orders"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("PUT", "/orders/*"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("POST", "/orders/*/validate"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("DELETE", "/orders/*"): [Role.SUPERADMIN, Role.ADMIN],

    # USERS ENDPOINTS (only ADMIN and SUPERADMIN)
    ("GET", "/users"): [Role.SUPERADMIN, Role.ADMIN],
    ("GET", "/users/*"): [Role.SUPERADMIN, Role.ADMIN],
    ("POST", "/users"): [Role.SUPERADMIN, Role.ADMIN],
    ("PUT", "/users/*"): [Role.SUPERADMIN, Role.ADMIN],
    ("DELETE", "/users/*"): [Role.SUPERADMIN, Role.ADMIN],

    # TENANTS ENDPOINTS (only SUPERADMIN)
    ("GET", "/tenants"): [Role.SUPERADMIN],
    ("GET", "/tenants/*"): [Role.SUPERADMIN],
    ("POST", "/tenants"): [Role.SUPERADMIN],
    ("PUT", "/tenants/*"): [Role.SUPERADMIN],
    ("DELETE", "/tenants/*"): [Role.SUPERADMIN],

    # STATS ENDPOINTS (only SUPERADMIN)
    ("GET", "/stats"): [Role.SUPERADMIN],
    ("GET", "/stats/*"): [Role.SUPERADMIN],

    # API KEYS ENDPOINTS (SUPERADMIN and ADMIN)
    # SUPERADMIN can create API keys for any tenant
    # ADMIN can create API keys for their own tenant
    ("GET", "/api-keys"): [Role.SUPERADMIN, Role.ADMIN],
    ("GET", "/api-keys/*"): [Role.SUPERADMIN, Role.ADMIN],
    ("POST", "/api-keys"): [Role.SUPERADMIN, Role.ADMIN],
    ("PATCH", "/api-keys/*"): [Role.SUPERADMIN, Role.ADMIN],
    ("DELETE", "/api-keys/*"): [Role.SUPERADMIN, Role.ADMIN],
    
    # INVOICES ENDPOINTS (RESTful paths under /orders/{id}/invoices)
    ("POST", "/orders/*/invoices"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("GET", "/orders/*/invoices"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],

    # INVOICES ENDPOINTS (new unified paths)
    ("POST", "/invoices"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("POST", "/invoices/*"): [Role.SUPERADMIN, Role.ADMIN, Role.VENTAS],
    ("GET", "/invoices"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("GET", "/invoices/*"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],

    # INVOICE SERIES ENDPOINTS
    ("GET", "/invoice-series"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("GET", "/invoice-series/*"): [Role.SUPERADMIN, Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("POST", "/invoice-series"): [Role.SUPERADMIN, Role.ADMIN],
    ("PATCH", "/invoice-series/*"): [Role.SUPERADMIN, Role.ADMIN],
    ("DELETE", "/invoice-series/*"): [Role.SUPERADMIN, Role.ADMIN],
}


def _match_path_pattern(pattern: str, path: str) -> bool:
    """
    Match a path against a pattern with wildcard support.

    Wildcards:
    - `*` matches a single path segment (e.g., `/orders/*/invoices` matches `/orders/123/invoices`)
    - Pattern ending with `/*` matches any path starting with that prefix

    Examples:
        >>> _match_path_pattern("/orders/*", "/orders/123")
        True
        >>> _match_path_pattern("/orders/*/invoices", "/orders/123/invoices")
        True
        >>> _match_path_pattern("/orders/*", "/orders/123/invoices")
        True
    """
    # Handle trailing wildcard (matches anything after prefix)
    if pattern.endswith("/*"):
        prefix = pattern[:-1]  # Remove trailing *
        return path.startswith(prefix)

    # Handle wildcards in the middle of the pattern
    if "*" in pattern:
        pattern_parts = pattern.split("/")
        path_parts = path.split("/")

        # If pattern has fewer parts than path, no match (unless trailing /*)
        if len(pattern_parts) != len(path_parts):
            return False

        # Compare each segment
        for pattern_part, path_part in zip(pattern_parts, path_parts):
            if pattern_part == "*":
                continue  # Wildcard matches any single segment
            if pattern_part != path_part:
                return False

        return True

    # No wildcards - exact match
    return pattern == path


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
        if perm_method == method and _match_path_pattern(perm_path, normalized_path):
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
        if perm_method == method and _match_path_pattern(perm_path, normalized_path):
            return allowed_roles

    return []
