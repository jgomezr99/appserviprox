"""Modo mantenimiento aplicado en la API: bloquea las escrituras de usuarios que no son del equipo."""
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import PlatformSettings, UserRole

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# El login valida el mantenimiento por su cuenta; el resto debe seguir disponible para el equipo y los webhooks.
EXEMPT_PREFIXES = (
    "/api/v1/auth/token/",
    "/api/v1/auth/password-reset/",
    "/api/v1/admin/",
    "/api/v1/platform/",
    "/api/v1/payments/wompi/events/",
    "/api/v1/health",
)


def _client_ip(request) -> str:
    return request.META.get("REMOTE_ADDR", "")


def _is_staff_request(request) -> bool:
    try:
        result = JWTAuthentication().authenticate(request)
    except Exception:  # token ausente o inválido: se trata como usuario normal
        return False
    if not result:
        return False
    user = result[0]
    return bool(user.is_staff or user.role == UserRole.STAFF)


class MaintenanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in SAFE_METHODS and request.path.startswith("/api/") \
                and not request.path.startswith(EXEMPT_PREFIXES):
            data = PlatformSettings.load()
            active, message = PlatformSettings.maintenance_state(data)
            if active and _client_ip(request) not in data["sections"].get("maintenance", {}).get("ips", []) \
                    and not _is_staff_request(request):
                return JsonResponse({"detail": message, "maintenance": True}, status=503)
        return self.get_response(request)
