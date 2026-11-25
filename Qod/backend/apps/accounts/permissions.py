from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

PERMISSIONS = {
    "dashboard.view",
    "finance.view",
    "pos.use",
    "orders.view",
    "orders.manage",
    "customers.manage",
    "payments.view",
    "payments.manage",
    "expenses.manage",
    "inventory.view",
    "inventory.manage",
    "purchasing.manage",
    "recipes.manage",
    "production.view",
    "production.manage",
    "transfers.manage",
    "reports.view",
    "employees.manage",
    "products.manage",
    "cms.manage",
}

_ALL = sorted(PERMISSIONS)

ROLE_PERMISSIONS = {
    "owner": set(_ALL),
    "admin": set(_ALL),
    "manager": PERMISSIONS - {"employees.manage"},
    "cashier": {
        "dashboard.view",
        "pos.use",
        "orders.view",
        "customers.manage",
        "payments.view",
        "payments.manage",
    },
    "production": {
        "dashboard.view",
        "orders.view",
        "production.view",
        "production.manage",
        "inventory.view",
        "recipes.manage",
    },
    "inventory": {
        "dashboard.view",
        "inventory.view",
        "inventory.manage",
        "purchasing.manage",
        "transfers.manage",
    },
}

# Grants mirror src/config/permissions.ts exactly; the backend is authoritative.

ROLE_LABELS = {
    "owner": "Owner",
    "admin": "Administrator",
    "manager": "Manager",
    "cashier": "Cashier",
    "production": "Production staff",
    "inventory": "Inventory staff",
}


def permissions_for(user) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    return ROLE_PERMISSIONS.get(getattr(user, "role", ""), set())


def has_permission(user, permission: str) -> bool:
    return permission in permissions_for(user)


def has_any_permission(user, permissions) -> bool:
    return bool(permissions_for(user).intersection(set(permissions)))


def require_permission(user, permission: str):
    if not has_permission(user, permission):
        raise PermissionDenied("Your role does not allow this action.")
    return user


class RolePermission(BasePermission):
    """Reads ``required_permission`` or ``required_any`` from the view."""

    message = "Your role does not allow this action."

    def has_permission(self, request, view):
        authorization = getattr(view, "authorization", None)
        if authorization is None:
            return True
        if isinstance(authorization, str):
            return has_permission(request.user, authorization)
        return has_any_permission(request.user, authorization)


class AuthenticatedRolePermission(IsAuthenticated, RolePermission):
    pass
