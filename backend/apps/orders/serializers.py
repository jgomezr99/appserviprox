from rest_framework import serializers

from apps.professionals.serializers import ProfessionalListSerializer
from apps.service_requests.models import ServiceRequest
from apps.service_requests.services import professional_offers_service

from .models import Order, OrderEvent, Review, WorkEvidence
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


class WorkEvidenceSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkEvidence
        fields = ["id", "image_url", "caption", "created_at"]

    def get_image_url(self, instance):
        request = self.context.get("request")
        return request.build_absolute_uri(instance.image.url) if request else instance.image.url


class OrderSerializer(serializers.ModelSerializer):
    professional = ProfessionalListSerializer(read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    review = ReviewSerializer(read_only=True)
    work_evidence = WorkEvidenceSerializer(many=True, read_only=True)
    workplace_latitude = serializers.FloatField(source="service_request.household.latitude", read_only=True)
    workplace_longitude = serializers.FloatField(source="service_request.household.longitude", read_only=True)
    workplace_address = serializers.CharField(source="service_request.household.address_line", read_only=True, default="")
    workplace_neighborhood = serializers.CharField(source="service_request.household.neighborhood", read_only=True, default="")
    workplace_city = serializers.CharField(source="service_request.household.city", read_only=True, default="")
    household_label = serializers.CharField(source="service_request.household.label", read_only=True, default="Tu Vivienda")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_status_label = serializers.CharField(source="get_payment_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "service_request",
            "professional",
            "status",
            "status_label",
            "payment_status",
            "payment_status_label",
            "payment_confirmed_at",
            "payment_reference",
            "scheduled_for",
            "estimate_min",
            "estimate_max",
            "final_price",
            "client_notes",
            "arrival_code",
            "professional_latitude",
            "professional_longitude",
            "workplace_latitude",
            "workplace_longitude",
            "workplace_address",
            "workplace_neighborhood",
            "workplace_city",
            "household_label",
            "events",
            "review",
            "work_evidence",
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
        if service_request.status not in {ServiceRequest.Status.OPEN, ServiceRequest.Status.MATCHED}:
            raise serializers.ValidationError("La solicitud ya no permite crear una orden.")
        return service_request

    def validate(self, attrs):
        service_request = attrs["service_request"]
        professional = attrs["professional"]

        if service_request.selected_service_id and not professional_offers_service(
            professional, service_request.selected_service_id
        ):
            raise serializers.ValidationError(
                {"professional": "El profesional no ofrece el servicio seleccionado."}
            )
        if Order.objects.filter(
            service_request=service_request, professional=professional
        ).exists():
            raise serializers.ValidationError("Ya existe una orden para esta solicitud.")
        return attrs

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
