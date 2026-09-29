from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Order, Review, WorkEvidence
from .serializers import OrderCreateSerializer, OrderSerializer, ReviewSerializer
from .services import InvalidTransition, confirm_development_payment, transition


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("professional", "service_request").prefetch_related(
            "events", "professional__services__service__category"
        )
        if getattr(user, "role", "") == "staff":
            return queryset
        if getattr(user, "is_professional", False):
            return queryset.filter(professional__user=user)
        return queryset.filter(client=user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    @action(detail=True, methods=["post"], url_path="transition")
    def change_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in Order.Status.values:
            return Response(
                {"status": "Estado desconocido."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            order = transition(order, new_status, user=request.user, note=request.data.get("note", ""))
        except InvalidTransition as exc:
            return Response({"status": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="confirm-demo-payment")
    def confirm_demo_payment(self, request, pk=None):
        order = self.get_object()
        if order.client_id != request.user.id:
            return Response(
                {"detail": "Solo el cliente de la orden puede confirmar el pago."},
                status=status.HTTP_403_FORBIDDEN,
            )
        order = confirm_development_payment(order, user=request.user)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="location")
    def update_location(self, request, pk=None):
        order = self.get_object()
        if order.professional.user_id != request.user.id:
            return Response({"detail": "Solo el profesional puede actualizar su ubicacion."}, status=403)
        try:
            order.professional_latitude = float(request.data["latitude"])
            order.professional_longitude = float(request.data["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "latitude y longitude son obligatorios."}, status=400)
        order.save(update_fields=["professional_latitude", "professional_longitude", "updated_at"])
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="evidence")
    def add_evidence(self, request, pk=None):
        order = self.get_object()
        if order.professional.user_id != request.user.id:
            return Response({"detail": "Solo el profesional puede subir evidencia."}, status=403)
        if not request.FILES.get("image"):
            return Response({"detail": "La foto es obligatoria."}, status=400)
        WorkEvidence.objects.create(order=order, image=request.FILES["image"], caption=request.data.get("caption", ""))
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data, status=201)


class ReviewViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    queryset = Review.objects.none()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(order__client=self.request.user)
