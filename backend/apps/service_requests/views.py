from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ServiceRequest
from .serializers import ServiceRequestCreateSerializer, ServiceRequestSerializer
from .services import build_candidates


class ServiceRequestViewSet(viewsets.ModelViewSet):
    queryset = ServiceRequest.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "selected_category__slug"]

    def get_queryset(self):
        return (
            ServiceRequest.objects.filter(client=self.request.user)
            .select_related("suggested_category", "selected_category", "household")
            .prefetch_related("candidates__professional__services__category")
        )

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ServiceRequestCreateSerializer
        return ServiceRequestSerializer

    @action(detail=True, methods=["post"])
    def refresh_candidates(self, request, pk=None):
        """Recalcula los profesionales cercanos, p. ej. tras cambiar el radio."""
        service_request = self.get_object()
        build_candidates(service_request)
        return Response(ServiceRequestSerializer(service_request).data)
