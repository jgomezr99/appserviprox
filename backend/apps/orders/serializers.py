from rest_framework import serializers

from apps.professionals.serializers import ProfessionalListSerializer

from .models import Order, OrderEvent, Review
from .services import refresh_rating


class OrderEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderEvent
        fields = ["id", "status", "status_label", "note", "created_at"]


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "order", "rating", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_order(self, order):
        if order.client_id != self.context["request"].user.id:
            raise serializers.ValidationError("Solo el cliente puede calificar la orden.")
        if order.status != Order.Status.COMPLETED:
            raise serializers.ValidationError("La orden aun no esta completada.")
        return order

    def create(self, validated_data):
        review = super().create(validated_data)
        refresh_rating(review.order.professional)
        return review


class OrderSerializer(serializers.ModelSerializer):
    professional = ProfessionalListSerializer(read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    review = ReviewSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "service_request",
            "professional",
            "status",
            "status_label",
            "scheduled_for",
            "estimate_min",
            "estimate_max",
            "final_price",
            "client_notes",
            "events",
            "review",
            "created_at",
        ]
        read_only_fields = fields


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "service_request",
            "professional",
            "scheduled_for",
            "estimate_min",
            "estimate_max",
            "client_notes",
        ]

    def validate_service_request(self, service_request):
        if service_request.client_id != self.context["request"].user.id:
            raise serializers.ValidationError("La solicitud no pertenece a este usuario.")
        return service_request

    def create(self, validated_data):
        order = Order.objects.create(client=self.context["request"].user, **validated_data)
        OrderEvent.objects.create(
            order=order,
            status=order.status,
            note="Visita solicitada desde la app.",
            created_by=order.client,
        )
        service_request = order.service_request
        service_request.status = service_request.Status.MATCHED
        service_request.save(update_fields=["status", "updated_at"])
        return order

    def to_representation(self, instance):
        return OrderSerializer(instance, context=self.context).data
