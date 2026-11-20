import mimetypes

from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.platform_guard import require_feature

from .models import Service, ServiceCategory, StoreProduct, StoreProductImage, StoreProductReport
from .serializers import (
    ServiceCategoryListSerializer,
    ServiceCategorySerializer,
    ServiceSerializer,
    StoreProductSerializer,
    StoreProductReportSerializer,
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
    mixins.UpdateModelMixin,
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

    def get_queryset(self):
        if self.action in {"image", "gallery_image"}:
            return StoreProduct.objects.all()
        return StoreProduct.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in {"list", "retrieve", "image", "gallery_image"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer(self, *args, **kwargs):
        uploads = []
        if self.action in {"create", "update", "partial_update"} and self.request.FILES:
            uploads = self.request.FILES.getlist("image")
            if any(upload.size > 5 * 1024 * 1024 for upload in uploads[1:]):
                raise ValidationError({"image": "Cada imagen puede tener máximo 5 MB."})
            if uploads:
                data = self.request.data.copy()
                data.setlist("image", [uploads[0]])
                kwargs["data"] = data
        serializer = super().get_serializer(*args, **kwargs)
        serializer.extra_image_uploads = uploads[1:]
        return serializer

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
        for image in serializer.extra_image_uploads:
            StoreProductImage.objects.create(product=serializer.instance, image=image)

    def perform_update(self, serializer):
        serializer.save()
        for image in serializer.extra_image_uploads:
            StoreProductImage.objects.create(product=serializer.instance, image=image)

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.owner_id != user.id and getattr(user, "role", "") != "staff":
            raise PermissionDenied("Solo el autor puede eliminar esta publicación.")
        if instance.image:
            instance.image.delete(save=False)
        for image in instance.gallery.all():
            image.image.delete(save=False)
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

    @action(detail=True, methods=["get"], url_path=r"gallery/(?P<image_id>[^/.]+)", permission_classes=[permissions.AllowAny])
    def gallery_image(self, request, pk=None, image_id=None):
        image = StoreProductImage.objects.filter(product_id=pk, pk=image_id).first()
        if not image:
            raise Http404
        content_type = mimetypes.guess_type(image.image.name)[0] or "application/octet-stream"
        response = FileResponse(image.image.open("rb"), content_type=content_type)
        response["Cache-Control"] = "public, max-age=86400"
        return response

    @action(detail=True, methods=["post"], url_path="report", permission_classes=[permissions.AllowAny])
    def report(self, request, pk=None):
        product = self.get_object()
        reporter = request.user if request.user.is_authenticated else None
        report = StoreProductReport.objects.create(
            product=product,
            product_id_snapshot=str(product.pk),
            product_title=product.title,
            product_price=product.price,
            product_category=product.category,
            product_image=request.build_absolute_uri(f"/api/v1/store/products/{product.pk}/image/") if product.image else "",
            seller_id_snapshot=str(product.owner_id or ""),
            seller_name=product.seller_name,
            seller_email=getattr(product.owner, "email", "") or "",
            seller_phone=product.phone,
            seller_role=product.seller_role,
            reporter=reporter,
            reporter_name=request.data.get("reporter_name") or (reporter.get_full_name() or reporter.get_username() if reporter else "Cliente"),
            reporter_email=request.data.get("reporter_email") or (reporter.email if reporter else ""),
            reason=str(request.data.get("reason", "Reporte de publicación"))[:255],
            description=str(request.data.get("description", "")),
            priority=request.data.get("priority", "Media") if request.data.get("priority", "Media") in StoreProductReport.Priority.values else "Media",
        )
        if reporter and (reporter.is_staff or getattr(reporter, "role", "") == "staff") and request.data.get("hide_product"):
            StoreProduct.objects.filter(pk=product.pk).update(is_active=False)
            report.action_taken = "producto_oculto"
            report.save(update_fields=["action_taken"])
        return Response({"ok": True, "report": StoreProductReportSerializer(report).data}, status=status.HTTP_201_CREATED)
