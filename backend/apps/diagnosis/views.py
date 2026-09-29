from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import DiagnosticQuestion, DiagnosticSession
from .serializers import (
    DiagnosticQuestionSerializer,
    DiagnosticSessionCreateSerializer,
    DiagnosticSessionSerializer,
)


class DiagnosticQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DiagnosticQuestionSerializer
    pagination_class = None
    queryset = (
        DiagnosticQuestion.objects.filter(is_active=True).prefetch_related("options")
    )


class DiagnosticSessionViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Crea el diagnostico y expone la sugerencia; confirmarla es del cliente."""

    def get_queryset(self):
        queryset = DiagnosticSession.objects.select_related("suggested_category")
        if self.request.user.is_authenticated:
            return queryset.filter(user=self.request.user)
        return queryset.none()

    def get_serializer_class(self):
        if self.action == "create":
            return DiagnosticSessionCreateSerializer
        return DiagnosticSessionSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        """El cliente descarta la sugerencia y elige otra categoria."""
        session = self.get_object()
        session.status = DiagnosticSession.Status.DISCARDED
        session.save(update_fields=["status"])
        return Response(DiagnosticSessionSerializer(session).data)
