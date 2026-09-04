from rest_framework import serializers

from apps.catalog.serializers import ServiceCategoryListSerializer
from apps.professionals.serializers import ProfessionalListSerializer

from .models import RequestCandidate, ServiceRequest
from .services import build_candidates


class RequestCandidateSerializer(serializers.ModelSerializer):
    professional = ProfessionalListSerializer(read_only=True)

    class Meta:
        model = RequestCandidate
        fields = ["id", "professional", "distance_km", "status", "created_at"]


class ServiceRequestSerializer(serializers.ModelSerializer):
    suggested_category = ServiceCategoryListSerializer(read_only=True)
    selected_category = ServiceCategoryListSerializer(read_only=True)
    candidates = RequestCandidateSerializer(many=True, read_only=True)
    followed_suggestion = serializers.BooleanField(read_only=True, allow_null=True)

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "household",
            "diagnostic_session",
            "suggested_category",
            "selected_category",
            "followed_suggestion",
            "description",
            "urgency",
            "search_radius_km",
            "status",
            "candidates",
            "created_at",
        ]
        read_only_fields = fields


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = [
            "household",
            "diagnostic_session",
            "suggested_category",
            "selected_category",
            "description",
            "urgency",
            "search_radius_km",
        ]

    def validate_household(self, household):
        if household.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("El hogar no pertenece a este usuario.")
        return household

    def create(self, validated_data):
        session = validated_data.get("diagnostic_session")
        # Si el cliente venia del diagnostico, dejamos constancia de la sugerencia
        # aunque termine eligiendo otra categoria.
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

        build_candidates(request)
        return request

    def to_representation(self, instance):
        return ServiceRequestSerializer(instance, context=self.context).data
