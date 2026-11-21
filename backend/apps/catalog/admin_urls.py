from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_api import AdminCategoryViewSet, AdminServiceViewSet, AdminSuggestionPreview

router = DefaultRouter()
router.register("categories", AdminCategoryViewSet, basename="admin-category")
router.register("services", AdminServiceViewSet, basename="admin-service")

urlpatterns = [
    path("suggestions/preview/", AdminSuggestionPreview.as_view(), name="admin-suggestion-preview"),
    *router.urls,
]
