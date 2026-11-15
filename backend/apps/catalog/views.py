import mimetypes

from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, Http404
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.accounts.platform_guard import require_feature

from .models import Service, ServiceCategory, StoreProduct
from .serializers import (
    ServiceCategoryListSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
    StoreProductSerializer,
)


class ServiceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    search_fields = ["name", "description", "keywords"]
    serializer_class = ServiceCategorySerializer

    def get_queryset(self):
        return (
            ServiceCategory.objects.filter(is_active=True)
            .annotate(
                professionals_count=Count(
                    "services__professional_services",
                    filter=Q(services__is_active=True, services__professional_services__profile__is_active=True),
                    distinct=True,
                )
            )
            .prefetch_related(Prefetch("services", queryset=Service.objects.filter(is_active=True)))
            # El GROUP BY del annotate descarta Meta.ordering: lo reponemos para
            # que la paginacion de DRF sea estable.
            .order_by("sort_order", "name")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ServiceCategoryListSerializer
        return ServiceCategorySerializer


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceSerializer
    filterset_fields = ["category", "category__slug"]
    search_fields = ["name", "description"]
    queryset = (
        Service.objects.filter(is_active=True, category__is_active=True)
        .select_related("category")
        .order_by("category__sort_order", "name", "id")
    )


class StoreProductViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Tienda: lectura publica; publicar requiere sesion; borrar solo el autor o staff."""

    serializer_class = StoreProductSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    filterset_fields = ["category", "city"]
    search_fields = ["title", "description", "seller_name", "city"]
    queryset = StoreProduct.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in {"list", "retrieve", "image"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        require_feature("products", "La tienda de productos está deshabilitada temporalmente.")
        user = self.request.user
        full_name = f"{user.first_name} {user.last_name}".strip()
        role = getattr(user, "role", "")
        seller_role = {"staff": "Administrador", "professional": "Contratista"}.get(role, "Cliente")
        serializer.save(
            owner=user,
            seller_name="Administrador Serviprox" if role == "staff" else (full_name or user.email),
            seller_role=seller_role,
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.owner_id != user.id and getattr(user, "role", "") != "staff":
            raise PermissionDenied("Solo el autor puede eliminar esta publicación.")
        if instance.image:
            instance.image.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"], url_path="image")
    def image(self, request, pk=None):
        product = self.get_object()
        if not product.image:
            raise Http404
        content_type = mimetypes.guess_type(product.image.name)[0] or "application/octet-stream"
        response = FileResponse(product.image.open("rb"), content_type=content_type)
        response["Cache-Control"] = "public, max-age=86400"
        return response
