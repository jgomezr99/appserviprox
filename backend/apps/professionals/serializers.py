from rest_framework import serializers

from apps.catalog.models import ServiceCategory

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


class ProfessionalProfileMeSerializer(serializers.ModelSerializer):
    services = ProfessionalServiceSerializer(many=True, read_only=True)
    service_category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=False,
    )

    class Meta:
        model = ProfessionalProfile
        fields = [
            "id",
            "display_name",
            "headline",
            "bio",
            "latitude",
            "longitude",
            "neighborhood",
            "city",
            "coverage_radius_km",
            "response_time_minutes",
            "accepts_urgent",
            "is_verified",
            "is_active",
            "rating_avg",
            "jobs_completed",
            "services",
            "service_category_ids",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "is_verified",
            "is_active",
            "rating_avg",
            "jobs_completed",
            "created_at",
        ]

    def validate_service_category_ids(self, value):
        unique_ids = list(dict.fromkeys(value))
        categories_count = ServiceCategory.objects.filter(id__in=unique_ids, is_active=True).count()
        if categories_count != len(unique_ids):
            raise serializers.ValidationError("Selecciona servicios validos del catalogo.")
        return unique_ids

    def _sync_services(self, profile, category_ids):
        if category_ids is None:
            return
        ProfessionalService.objects.filter(profile=profile).exclude(
            category_id__in=category_ids
        ).delete()
        existing_ids = set(
            ProfessionalService.objects.filter(
                profile=profile, category_id__in=category_ids
            ).values_list("category_id", flat=True)
        )
        ProfessionalService.objects.bulk_create(
            [
                ProfessionalService(profile=profile, category_id=category_id)
                for category_id in category_ids
                if category_id not in existing_ids
            ]
        )

    def create(self, validated_data):
        category_ids = validated_data.pop("service_category_ids", None)
        profile = ProfessionalProfile.objects.create(**validated_data)
        self._sync_services(profile, category_ids)
        return profile

    def update(self, instance, validated_data):
        category_ids = validated_data.pop("service_category_ids", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._sync_services(instance, category_ids)
        return instance
