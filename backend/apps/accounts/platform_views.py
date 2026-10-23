import json
from datetime import timedelta

from django.conf import settings as dj_settings
from django.core.management import call_command
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (
    AdminAuditLog,
    DEFAULT_PLATFORM_SETTINGS,
    Notification,
    PlatformSettings,
    User,
    UserRole,
)
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.orders.models import Order
from apps.pqrs.models import AppProblemReport, PQRReport
from apps.professionals.models import ProfessionalProfile
from apps.service_requests.models import ServiceRequest
from config.mongo import MONGO_COLLECTIONS, purge_collections

MAX_LOGO_CHARS = 3_000_000
SECTION_KEYS = (
    "appearance",
    "notifications",
    "payments",
    "security",
    "integrations",
    "app_params",
    "maintenance",
    "role_params",
)
SECTION_LIMIT = {"appearance": 8_000_000}
DEFAULT_SECTION_LIMIT = 200_000
BACKUP_DIR = dj_settings.BASE_DIR / "backups"
NESTED_TEXT = {
    "email": ("host", "port", "cipher", "sender", "sender_name"),
    "social": ("facebook", "instagram", "x", "youtube", "linkedin"),
    "documents": ("terms", "privacy", "refunds", "rules", "contract"),
}
TEXT_FIELDS = (
    "platform_name",
    "description",
    "country",
    "timezone",
    "language",
    "date_format",
    "time_format",
    "currency",
    "maintenance_message",
)
PUBLIC_FIELDS = (
    "platform_name",
    "logo",
    "country",
    "language",
    "currency",
    "cities",
    "features",
    "maintenance_message",
)


class IsPlatformStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or user.role == UserRole.STAFF)
        )


def _audit(request, action, target, reason=""):
    AdminAuditLog.objects.create(
        admin_user=request.user,
        admin_name=request.user.get_full_name() or request.user.email,
        action=action,
        target=target,
        reason=reason,
    )


class PublicPlatformSettingsView(APIView):
    """Parámetros visibles para las apps de cliente y profesional (sin autenticación)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = PlatformSettings.load()
        active, message = PlatformSettings.maintenance_state(data)
        public = {key: data[key] for key in PUBLIC_FIELDS}
        public["features"] = {**data["features"], "maintenance": active}
        public["maintenance_message"] = message
        public["appearance"] = data["sections"].get("appearance", {})
        public["role_params"] = data["sections"].get("role_params", {})
        return Response(public)


class AdminPlatformSettingsView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        data = PlatformSettings.load()
        row = PlatformSettings.objects.first()
        data["system"] = {
            "version": "v1.2.0",
            "updated_at": row.updated_at.isoformat() if row else "",
            "db_engine": connection.vendor,
            "environment": "Desarrollo" if dj_settings.DEBUG else "Producción",
            "users_total": User.objects.count(),
            "backups": [
                {"name": p.name, "size": p.stat().st_size, "created_at": p.stat().st_mtime}
                for p in sorted(BACKUP_DIR.glob("backup_*.json"), reverse=True)[:5]
            ] if BACKUP_DIR.exists() else [],
            "history": [
                {
                    "date": log.created_at.isoformat(),
                    "action": log.action,
                    "target": log.target,
                    "admin": log.admin_name,
                }
                for log in AdminAuditLog.objects.all()[:10]
            ],
        }
        return Response(data)

    def patch(self, request):
        current = PlatformSettings.load()
        payload = request.data

        for key in TEXT_FIELDS:
            if key in payload:
                value = str(payload[key]).strip()
                if key in ("platform_name", "country") and not value:
                    return Response(
                        {"detail": f"El campo {key} no puede estar vacío."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                current[key] = value[:1000]

        if "logo" in payload:
            logo = str(payload["logo"] or "")
            if logo and not logo.startswith("data:image/"):
                return Response({"detail": "Logo inválido."}, status=status.HTTP_400_BAD_REQUEST)
            if len(logo) > MAX_LOGO_CHARS:
                return Response({"detail": "El logo supera el tamaño permitido."}, status=status.HTTP_400_BAD_REQUEST)
            current["logo"] = logo

        if "cities" in payload:
            cities = payload["cities"]
            if not isinstance(cities, list):
                return Response({"detail": "Ciudades inválidas."}, status=status.HTTP_400_BAD_REQUEST)
            current["cities"] = [str(c).strip() for c in cities if str(c).strip()][:200]

        for group, keys in NESTED_TEXT.items():
            if isinstance(payload.get(group), dict):
                for key in keys:
                    if key in payload[group]:
                        current[group][key] = str(payload[group][key]).strip()[:20000]
        if isinstance(payload.get("email"), dict) and "requires_auth" in payload["email"]:
            current["email"]["requires_auth"] = bool(payload["email"]["requires_auth"])

        if "features" in payload and isinstance(payload["features"], dict):
            for key in DEFAULT_PLATFORM_SETTINGS["features"]:
                if key in payload["features"]:
                    current["features"][key] = bool(payload["features"][key])

        if isinstance(payload.get("sections"), dict):
            for name, value in payload["sections"].items():
                if name not in SECTION_KEYS or not isinstance(value, dict):
                    continue
                if len(json.dumps(value)) > SECTION_LIMIT.get(name, DEFAULT_SECTION_LIMIT):
                    return Response({"detail": f"La sección {name} es demasiado grande."}, status=status.HTTP_400_BAD_REQUEST)
                current["sections"][name] = value

        saved = PlatformSettings.save_data(current)
        _audit(request, "Configuración actualizada", "Plataforma")
        return Response(saved)


class AdminDeleteAccountView(APIView):
    """Elimina una cuenta de cliente o profesional junto con sus pedidos y viviendas."""

    permission_classes = [IsPlatformStaff]

    @transaction.atomic
    def delete(self, request, kind, pk):
        if kind == "professional":
            profile = ProfessionalProfile.objects.select_related("user").filter(pk=pk).first()
            user = profile.user if profile else None
        elif kind == "client":
            user = User.objects.filter(pk=pk).first()
        else:
            return Response({"detail": "Tipo de cuenta inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if not user:
            return Response({"detail": "La cuenta no existe."}, status=status.HTTP_404_NOT_FOUND)
        if user.is_staff or user.role == UserRole.STAFF or user.pk == request.user.pk:
            return Response({"detail": "No se puede eliminar esta cuenta."}, status=status.HTTP_403_FORBIDDEN)

        label = user.get_full_name() or user.email
        Order.objects.filter(Q(client=user) | Q(professional__user=user)).delete()
        ServiceRequest.objects.filter(Q(client=user) | Q(professional__user=user)).delete()
        Household.objects.filter(owner=user).delete()
        user.delete()
        _audit(request, "Eliminar cuenta", label)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSystemActionView(APIView):
    """Acciones destructivas del sistema: requieren staff autenticado y confirmación explícita."""

    permission_classes = [IsPlatformStaff]

    @transaction.atomic
    def post(self, request):
        action = request.data.get("action")

        if action == "toggle_maintenance":
            data = PlatformSettings.load()
            data["features"]["maintenance"] = bool(request.data.get("enabled"))
            saved = PlatformSettings.save_data(data)
            _audit(request, "Modo mantenimiento", "Plataforma", str(saved["features"]["maintenance"]))
            return Response({"detail": "Modo mantenimiento actualizado.", "settings": saved})

        if action == "backup_now":
            BACKUP_DIR.mkdir(exist_ok=True)
            stamp = timezone.now()
            path = BACKUP_DIR / f"backup_{stamp:%Y%m%d_%H%M%S}.json"
            call_command(
                "dumpdata",
                exclude=["contenttypes", "sessions", "auth.permission", "admin.logentry"],
                output=str(path),
            )
            data = PlatformSettings.load()
            data["last_backup"] = stamp.isoformat()
            PlatformSettings.save_data(data)
            _audit(request, "Copia de seguridad", path.name)
            return Response({"detail": f"Copia creada: {path.name}", "last_backup": stamp.isoformat()})

        if request.data.get("confirm") != "BORRAR":
            return Response(
                {"detail": "Debes confirmar la acción escribiendo BORRAR."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "clear_cache":
            # Pedidos, PQR y fallas técnicas de clientes y profesionales
            counts = {
                "orders": Order.objects.all().delete()[0],
                "service_requests": ServiceRequest.objects.all().delete()[0],
                "pqrs": PQRReport.objects.all().delete()[0],
                "technical_issues": AppProblemReport.objects.all().delete()[0],
                "notifications": Notification.objects.all().delete()[0],
                "mongo": purge_collections(("pqrs", "technical_issues", "notifications")),
            }
            _audit(request, "Limpiar caché", "Pedidos, PQR y fallas técnicas")
            return Response({"detail": "Pedidos, PQR y fallas técnicas eliminados.", "deleted": counts})

        if action == "reset_services":
            # Elimina todas las cuentas de clientes y profesionales (conserva al staff)
            accounts = User.objects.exclude(is_staff=True).exclude(role=UserRole.STAFF)
            Order.objects.all().delete()
            ServiceRequest.objects.all().delete()
            Household.objects.all().delete()
            PQRReport.objects.all().delete()
            AppProblemReport.objects.all().delete()
            deleted = accounts.delete()[0]
            purge_collections(MONGO_COLLECTIONS)
            _audit(request, "Reiniciar servicios", "Cuentas de clientes y profesionales")
            return Response({"detail": "Cuentas de clientes y profesionales eliminadas.", "deleted": deleted})

        if action == "cleanup_logs":
            try:
                months = min(max(int(request.data.get("months", 3)), 1), 60)
            except (TypeError, ValueError):
                return Response({"detail": "Meses inválidos."}, status=status.HTTP_400_BAD_REQUEST)
            cutoff = timezone.now() - timedelta(days=30 * months)
            deleted = AdminAuditLog.objects.filter(created_at__lt=cutoff).delete()[0]
            return Response({"detail": f"Registros eliminados: {deleted}."})

        if action == "delete_backup":
            name = request.data.get("name")
            if name and BACKUP_DIR.exists():
                target = BACKUP_DIR / name
                if target.exists() and target.is_file():
                    target.unlink()
                    _audit(request, "Eliminar copia de seguridad", name)
                    return Response({"detail": f"Copia eliminada: {name}"})
            return Response({"detail": "Copia no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if action == "restore_backup":
            backups = sorted(BACKUP_DIR.glob("backup_*.json")) if BACKUP_DIR.exists() else []
            name = request.data.get("name")
            if name:
                backups = [b for b in backups if b.name == name]
            if not backups:
                return Response({"detail": "No hay copias de seguridad."}, status=status.HTTP_404_NOT_FOUND)
            call_command("loaddata", str(backups[-1]))
            return Response({"detail": f"Copia restaurada: {backups[-1].name}"})

        if action == "delete_platform":
            Order.objects.all().delete()
            ServiceRequest.objects.all().delete()
            Household.objects.all().delete()
            PQRReport.objects.all().delete()
            AppProblemReport.objects.all().delete()
            Service.objects.all().delete()
            ServiceCategory.objects.all().delete()
            User.objects.exclude(is_staff=True).exclude(role=UserRole.STAFF).delete()
            PlatformSettings.objects.all().delete()
            purge_collections(MONGO_COLLECTIONS)
            _audit(request, "Eliminar plataforma", "Todos los datos")
            return Response({"detail": "Todos los datos de la plataforma fueron eliminados."})

        return Response({"detail": "Acción no soportada."}, status=status.HTTP_400_BAD_REQUEST)
