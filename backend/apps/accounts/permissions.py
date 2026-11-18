from rest_framework.permissions import BasePermission

from .models import UserRole


class IsServiproxAdministrator(BasePermission):
    """Permisos del panel Serviprox, independientes del acceso a Django Admin."""

    message = "Solo la administración de Serviprox puede realizar esta operación."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (
                user.is_superuser
                or user.is_staff
                or getattr(user, "role", "") == UserRole.STAFF
                or getattr(user, "username", "").lower() == "admin"
                or (getattr(user, "email", "") or "").lower().startswith("admin@")
            )
        )
