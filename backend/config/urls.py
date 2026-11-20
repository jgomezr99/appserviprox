import logging

from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
try:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
except (ImportError, ModuleNotFoundError):
    SpectacularAPIView = None
    SpectacularSwaggerView = None
from rest_framework_simplejwt.views import TokenRefreshView


def health_check(request):
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
        return JsonResponse({
            "status": "ok",
            "database": "connected",
            "engine": connection.vendor or "sqlite",
        })
    except Exception:
        logger.exception("Health check failed to connect to the database.")
        return JsonResponse({
            "status": "error",
            "database": "disconnected",
        }, status=503)


def admin_overview(request):
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")

        from django.contrib.auth import get_user_model
        from django.db.models import Q
        from apps.pqrs.models import PQRReport, AppProblemReport
        from apps.catalog.models import StoreProduct
        from apps.orders.models import Order
        from apps.service_requests.models import ServiceRequest
        from apps.professionals.models import ProfessionalProfile
        from apps.accounts.models import AdminAuditLog

        User = get_user_model()
        clients_count = User.objects.filter(role="client").count()
        pros_count = ProfessionalProfile.objects.filter(is_active=True).count() or User.objects.filter(role="professional").count()
        staff_count = User.objects.filter(Q(role="staff") | Q(is_staff=True)).count()
        pqrs_count = PQRReport.objects.filter(status__in=["radicado", "en_revision", "conciliacion"]).count()
        tech_issues_count = AppProblemReport.objects.filter(status__in=["recibido", "en_proceso"]).count()
        hired_services_count = Order.objects.count()
        pending_publications_count = ServiceRequest.objects.filter(status="open").count()

        engine_name = "PostgreSQL (MV)" if connection.vendor == "postgresql" else (connection.vendor or "sqlite")
        database_name = str(connection.settings_dict.get("NAME") or "")

        return JsonResponse({
            "database": {
                "connected": True,
                "engine": engine_name,
                "database_name": database_name,
            },
            "kpis": {
                "clients": clients_count,
                "professionals": pros_count,
                "hired_services": hired_services_count,
                "pending_publications": pending_publications_count,
                "open_pqrs": pqrs_count,
                "technical_issues": tech_issues_count,
            },
            "charts": {
                "user_distribution": {
                    "clients": clients_count,
                    "professionals": pros_count,
                    "administrators": staff_count,
                },
                "pqr_chart": {
                    "radicado": pqrs_count,
                    "en_revision": 0,
                    "conciliacion": 0,
                    "resuelto": PQRReport.objects.filter(status="resuelto").count(),
                },
            },
            "reports": {
                "blocked_accounts_today": User.objects.filter(is_active=False).count(),
                "complaints": pqrs_count,
                "rejected_publications": ServiceRequest.objects.filter(status="rejected").count(),
                "cancelled_services": Order.objects.filter(status="cancelled").count(),
                "technical_issues": tech_issues_count,
            },
            "requests_list": [],
            "top_professionals": [],
            "audit_logs": [],
        })
    except Exception as e:
        logger.exception("Error in admin_overview")
        return JsonResponse({
            "database": {
                "connected": False,
                "detail": str(e),
            }
        }, status=503)


from apps.accounts.views import CustomTokenObtainPairView, RegisterAdminWorkerView

logger = logging.getLogger(__name__)

api_v1 = [
    path("health/", health_check, name="api-health"),
    path("auth/token/", CustomTokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/admin/register-worker/", RegisterAdminWorkerView.as_view(), name="api-auth-admin-register-worker"),
    path("auth/admin/register-worker", RegisterAdminWorkerView.as_view()),
    path("admin/register-worker/", RegisterAdminWorkerView.as_view()),
    path("admin/register-worker", RegisterAdminWorkerView.as_view()),
    path("auth/register-worker/", RegisterAdminWorkerView.as_view()),
    path("auth/register-worker", RegisterAdminWorkerView.as_view()),
    path("admin/catalog/", include("apps.catalog.admin_urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.households.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.diagnosis.urls")),
    path("", include("apps.professionals.urls")),
    path("", include("apps.service_requests.urls")),
    path("", include("apps.orders.urls")),
    path("", include("apps.pqrs.urls")),
]


urlpatterns = [
    path("health/", health_check, name="root-health"),
    path("auth/admin/register-worker/", RegisterAdminWorkerView.as_view()),
    path("auth/admin/register-worker", RegisterAdminWorkerView.as_view()),
    path("admin/register-worker/", RegisterAdminWorkerView.as_view()),
    path("admin/register-worker", RegisterAdminWorkerView.as_view()),
    path("auth/register-worker/", RegisterAdminWorkerView.as_view()),
    path("auth/register-worker", RegisterAdminWorkerView.as_view()),
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]

if SpectacularAPIView and SpectacularSwaggerView:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler400 = "config.errors.bad_request"
handler403 = "config.errors.permission_denied"
handler404 = "config.errors.not_found"
handler500 = "config.errors.server_error"
