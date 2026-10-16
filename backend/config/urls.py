import logging

from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def health_check(request):
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
        return JsonResponse({
            "status": "ok",
            "database": "connected",
        })
    except Exception:
        logger.exception("Health check failed to connect to the database.")
        return JsonResponse({
            "status": "error",
            "database": "disconnected",
        }, status=503)


from apps.accounts.views import CustomTokenObtainPairView

logger = logging.getLogger(__name__)

api_v1 = [
    path("health/", health_check, name="api-health"),
    path("auth/token/", CustomTokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
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
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

handler400 = "config.errors.bad_request"
handler403 = "config.errors.permission_denied"
handler404 = "config.errors.not_found"
handler500 = "config.errors.server_error"
