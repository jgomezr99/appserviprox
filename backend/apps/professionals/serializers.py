from rest_framework import serializers

from .models import AvailabilitySlot, PortfolioItem, ProfessionalProfile, ProfessionalService


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = AvailabilitySlot
        fields = ["id", "weekday", "weekday_label", "start_time", "end_time"]


class PortfolioItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioItem
        fields = ["id", "image_url", "caption", "sort_order"]


class ProfessionalServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = ProfessionalService
        fields = [
            "id",
            "category",
            "category_name",
            "category_slug",
            "price_min",
            "price_max",
            "years_experience",
        ]


class ProfessionalListSerializer(serializers.ModelSerializer):
    """Payload de la tarjeta y del pin en el mapa."""

    initials = serializers.CharField(read_only=True)
    distance_km = serializers.FloatField(read_only=True, required=False)
    categories = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalProfile
        fields = [
            "id",
            "display_name",
            "initials",
            "headline",
            "rating_avg",
            "jobs_completed",
            "is_verified",
            "accepts_urgent",
            "neighborhood",
            "city",
            "latitude",
            "longitude",
            "distance_km",
            "categories",
        ]

    def get_categories(self, obj) -> list[str]:
        return [service.category.name for service in obj.services.all()]


class ProfessionalDetailSerializer(ProfessionalListSerializer):
    services = ProfessionalServiceSerializer(many=True, read_only=True)
    availability = AvailabilitySlotSerializer(many=True, read_only=True)
    portfolio = PortfolioItemSerializer(many=True, read_only=True)

    class Meta(ProfessionalListSerializer.Meta):
        fields = ProfessionalListSerializer.Meta.fields + [
            "bio",
            "coverage_radius_km",
            "response_time_minutes",
            "services",
            "availability",
            "portfolio",
            "created_at",
        ]
