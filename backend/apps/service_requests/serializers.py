from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.catalog.serializers import ServiceCategoryListSerializer, ServiceSerializer
from apps.households.serializers import HouseholdSerializer
from apps.professionals.serializers import ProfessionalListSerializer

from .models import RequestCandidate, ServiceRequest, ServiceRequestImage
from .services import build_candidates, professional_offers_service


class ServiceRequestImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequestImage
        fields = ["id", "image_url", "created_at"]
        read_only_fields = fields

    def get_image_url(self, obj):
        request = self.context.get("request")
        path = f"/api/v1/requests/{obj.service_request_id}/images/{obj.id}/"
        return request.build_absolute_uri(path) if request else path


class RequestClientSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    city = serializers.CharField(read_only=True)


class RequestOrderSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_label = serializers.CharField(read_only=True)
    payment_status = serializers.CharField(read_only=True)
    payment_status_label = serializers.CharField(read_only=True)
    payment_confirmed_at = serializers.DateTimeField(read_only=True, allow_null=True)


class RequestCandidateSerializer(serializers.ModelSerializer):
    professional = ProfessionalListSerializer(read_only=True)

    class Meta:
        model = RequestCandidate
        fields = ["id", "professional", "distance_km", "status", "created_at"]


class ServiceRequestSerializer(serializers.ModelSerializer):
    client = RequestClientSerializer(read_only=True)
    household = HouseholdSerializer(read_only=True)
    suggested_category = ServiceCategoryListSerializer(read_only=True)
    selected_category = ServiceCategoryListSerializer(read_only=True)
    selected_service = ServiceSerializer(read_only=True)
    professional = ProfessionalListSerializer(read_only=True)
    candidates = RequestCandidateSerializer(many=True, read_only=True)
    images = ServiceRequestImageSerializer(many=True, read_only=True)
    followed_suggestion = serializers.BooleanField(read_only=True, allow_null=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    order = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "client",
            "household",
            "diagnostic_session",
            "suggested_category",
            "selected_category",
            "selected_service",
            "professional",
            "followed_suggestion",
            "description",
            "urgency",
            "search_radius_km",
            "status",
            "status_label",
            "order",
            "images",
            "candidates",
            "created_at",
        ]
        read_only_fields = fields

    def get_order(self, obj):
        order = next(iter(getattr(obj, "prefetched_orders", [])), None)
        if order is None:
            order = obj.orders.order_by("id").first()
        if order is None:
            return None
        return {
            "id": order.id,
            "status": order.status,
            "status_label": order.get_status_display(),
            "payment_status": order.payment_status,
            "payment_status_label": order.get_payment_status_display(),
            "payment_confirmed_at": order.payment_confirmed_at,
        }


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = [
            "household",
            "diagnostic_session",
            "suggested_category",
            "selected_category",
            "selected_service",
            "professional",
            "description",
            "urgency",
            "search_radius_km",
        ]
        extra_kwargs = {
            "selected_category": {"required": False},
            "selected_service": {"required": False, "allow_null": True},
            "professional": {"required": False, "allow_null": True},
        }

    def validate_household(self, household):
        if household.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("El hogar no pertenece a este usuario.")
        return household

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role != UserRole.CLIENT:
            raise serializers.ValidationError("Solo los clientes pueden crear solicitudes.")

        selected_service = attrs.get("selected_service")
        selected_category = attrs.get("selected_category")
        professional = attrs.get("professional")

        if selected_service:
            if not selected_service.is_active or not selected_service.category.is_active:
                raise serializers.ValidationError(
                    {"selected_service": "Selecciona un servicio activo."}
                )
            if selected_category and selected_category.id != selected_service.category_id:
                raise serializers.ValidationError(
                    {"selected_category": "La categoria no corresponde al servicio."}
                )
            attrs["selected_category"] = selected_service.category

        if professional:
            if not selected_service:
                raise serializers.ValidationError(
                    {"selected_service": "Selecciona el servicio concreto."}
                )
            if not professional.is_active:
                raise serializers.ValidationError(
                    {"professional": "Selecciona un profesional activo."}
                )
            if not professional_offers_service(professional, selected_service.id):
                raise serializers.ValidationError(
                    {"professional": "El profesional no ofrece este servicio."}
                )
            if attrs.get("urgency") == ServiceRequest.Urgency.URGENT and not professional.accepts_urgent:
                raise serializers.ValidationError(
                    {"urgency": "Este profesional no atiende solicitudes urgentes."}
                )

        if not attrs.get("selected_category"):
            raise serializers.ValidationError(
                {"selected_category": "Selecciona una categoria o un servicio."}
            )

        return attrs

    def create(self, validated_data):
        session = validated_data.get("diagnostic_session")
        if session and not validated_data.get("suggested_category"):
            validated_data["suggested_category"] = session.suggested_category

        request = ServiceRequest.objects.create(
            client=self.context["request"].user, **validated_data
        )
        if session:
            session.status = (
                session.Status.CONFIRMED
                if request.followed_suggestion
                else session.Status.DISCARDED
            )
            session.save(update_fields=["status"])

        if request.professional_id is None:
            build_candidates(request)
        return request

    def to_representation(self, instance):
        return ServiceRequestSerializer(instance, context=self.context).data
