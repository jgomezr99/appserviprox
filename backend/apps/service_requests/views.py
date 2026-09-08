import mimetypes

from django.http import FileResponse
from django.db import transaction
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.orders.models import Order

from .models import ServiceRequest, ServiceRequestImage
from .serializers import ServiceRequestCreateSerializer, ServiceRequestSerializer
from .services import accept_request, build_candidates, reject_request


class ServiceRequestViewSet(viewsets.ModelViewSet):
    queryset = ServiceRequest.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["status", "selected_category__slug"]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            ServiceRequest.objects.select_related(
                "client",
                "household",
                "suggested_category",
                "selected_category",
                "selected_service__category",
                "professional",
            )
            .prefetch_related(
                "candidates__professional__services__service__category",
                "professional__services__service__category",
                "images",
                Prefetch("orders", queryset=Order.objects.order_by("id"), to_attr="prefetched_orders"),
            )
        )
        if user.role == UserRole.PROFESSIONAL:
            return queryset.filter(professional__user=user)
        if user.role == UserRole.CLIENT:
            return queryset.filter(client=user)
        if user.role == UserRole.STAFF:
            return queryset
        return ServiceRequest.objects.none()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ServiceRequestCreateSerializer
        return ServiceRequestSerializer

    def create(self, request, *args, **kwargs):
        images = request.FILES.getlist("images")
        for image in images:
            guessed_type = mimetypes.guess_type(image.name)[0] or ""
            is_image = (
                (image.content_type and image.content_type.startswith("image/"))
                or guessed_type.startswith("image/")
            )
            if not is_image:
                return Response(
                    {"images": "Solo se permiten archivos de imagen."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            service_request = serializer.save()
            for image in images:
                ServiceRequestImage.objects.create(
                    service_request=service_request,
                    image=image,
                    uploaded_by=request.user,
                )
        output = ServiceRequestSerializer(service_request, context=self.get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def refresh_candidates(self, request, pk=None):
        """Recalcula los profesionales cercanos, p. ej. tras cambiar el radio."""
        service_request = self.get_object()
        if service_request.professional_id is not None:
            return Response(
                {"detail": "Las solicitudes dirigidas no recalculan candidatos."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        build_candidates(service_request)
        return Response(ServiceRequestSerializer(service_request).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        service_request = self.get_object()
        if request.user.role != UserRole.PROFESSIONAL:
            raise PermissionDenied("Solo el profesional destinatario puede aceptar.")
        service_request = accept_request(service_request.id, request.user)
        return Response(ServiceRequestSerializer(service_request, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        service_request = self.get_object()
        if request.user.role != UserRole.PROFESSIONAL:
            raise PermissionDenied("Solo el profesional destinatario puede rechazar.")
        service_request = reject_request(service_request.id, request.user)
        return Response(ServiceRequestSerializer(service_request, context=self.get_serializer_context()).data)

    @action(
        detail=True,
        methods=["get"],
        url_path=r"images/(?P<image_id>[^/.]+)",
    )
    def image(self, request, pk=None, image_id=None):
        service_request = self.get_object()
        image = service_request.images.filter(pk=image_id).first()
        if image is None:
            return Response({"detail": "Imagen no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        content_type = mimetypes.guess_type(image.image.name)[0] or "application/octet-stream"
        return FileResponse(image.image.open("rb"), content_type=content_type)
