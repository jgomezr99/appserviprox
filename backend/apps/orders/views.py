from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Order, Review
from .serializers import OrderCreateSerializer, OrderSerializer, ReviewSerializer
from .services import InvalidTransition, transition


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("professional", "service_request").prefetch_related(
            "events", "professional__services__category"
        )
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
            transition(order, new_status, user=request.user, note=request.data.get("note", ""))
        except InvalidTransition as exc:
            return Response({"status": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)


class ReviewViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    queryset = Review.objects.none()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(order__client=self.request.user)
