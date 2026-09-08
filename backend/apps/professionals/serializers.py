from rest_framework import serializers
from django.utils.text import slugify

from apps.catalog.models import Service, ServiceCategory

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
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_slug = serializers.CharField(source="service.slug", read_only=True)
    category = serializers.IntegerField(source="service.category_id", read_only=True)
    category_name = serializers.CharField(source="service.category.name", read_only=True)
    category_slug = serializers.CharField(source="service.category.slug", read_only=True)
    observaciones = serializers.CharField(source="observations", read_only=True)

    class Meta:
        model = ProfessionalService
        fields = [
            "id",
            "service",
            "service_name",
            "service_slug",
            "category",
            "category_name",
            "category_slug",
            "price_min",
            "price_max",
            "observaciones",
            "years_experience",
        ]


class ProfessionalServiceInputSerializer(serializers.Serializer):
    service = serializers.IntegerField()
    price_min = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    price_max = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    years_experience = serializers.IntegerField(required=False, min_value=0, max_value=80)

    def validate(self, attrs):
        price_min = attrs.get("price_min")
        price_max = attrs.get("price_max")
        if price_min is not None and price_max is not None and price_min > price_max:
            raise serializers.ValidationError("La tarifa minima no puede superar la maxima.")
        return attrs


class CustomProfessionalServiceInputSerializer(serializers.Serializer):
    category = serializers.IntegerField()
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True)
    price_min = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    price_max = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    years_experience = serializers.IntegerField(required=False, min_value=0, max_value=80)

    def validate(self, attrs):
        price_min = attrs.get("price_min")
        price_max = attrs.get("price_max")
        if price_min is not None and price_max is not None and price_min > price_max:
            raise serializers.ValidationError("La tarifa minima no puede superar la maxima.")
        return attrs


class ProfessionalListSerializer(serializers.ModelSerializer):
    """Payload de la tarjeta y del pin en el mapa."""

    initials = serializers.CharField(read_only=True)
    distance_km = serializers.FloatField(read_only=True, required=False)
    categories = serializers.SerializerMethodField()
    matching_service = serializers.SerializerMethodField()

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
            "matching_service",
        ]

    def get_categories(self, obj) -> list[str]:
        names = {service.service.category.name for service in obj.services.all()}
        return sorted(names)

    def get_matching_service(self, obj):
        request = self.context.get("request")
        service_param = request.query_params.get("service") if request else None
        if not service_param:
            return None
        for service in obj.services.all():
            if service_param.isdigit() and service.service_id == int(service_param):
                return ProfessionalServiceSerializer(service, context=self.context).data
            if not service_param.isdigit() and service.service.slug == service_param:
                return ProfessionalServiceSerializer(service, context=self.context).data
        return None


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
    service_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=False,
    )
    service_offerings = ProfessionalServiceInputSerializer(
        many=True,
        write_only=True,
        required=False,
        allow_empty=False,
    )
    custom_services = CustomProfessionalServiceInputSerializer(
        many=True,
        write_only=True,
        required=False,
        allow_empty=True,
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
            "service_ids",
            "service_offerings",
            "custom_services",
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

    def validate_service_ids(self, value):
        unique_ids = list(dict.fromkeys(value))
        services_count = Service.objects.filter(
            id__in=unique_ids,
            is_active=True,
            category__is_active=True,
        ).count()
        if services_count != len(unique_ids):
            raise serializers.ValidationError("Selecciona servicios validos del catalogo.")
        return unique_ids

    def validate_service_offerings(self, value):
        service_ids = [item["service"] for item in value]
        unique_ids = list(dict.fromkeys(service_ids))
        if len(unique_ids) != len(service_ids):
            raise serializers.ValidationError("No repitas servicios.")
        services_count = Service.objects.filter(
            id__in=unique_ids,
            is_active=True,
            category__is_active=True,
        ).count()
        if services_count != len(unique_ids):
            raise serializers.ValidationError("Selecciona servicios validos del catalogo.")
        return value

    def validate_custom_services(self, value):
        category_ids = [item["category"] for item in value]
        found = set(
            ServiceCategory.objects.filter(
                id__in=category_ids, is_active=True
            ).values_list("id", flat=True)
        )
        missing = [category_id for category_id in category_ids if category_id not in found]
        if missing:
            raise serializers.ValidationError("Selecciona categorias validas para servicios nuevos.")
        return value

    def _sync_services(self, profile, service_ids=None, service_offerings=None, custom_services=None):
        if service_offerings is None and service_ids is not None:
            service_offerings = [{"service": service_id} for service_id in service_ids]

        if custom_services:
            service_offerings = list(service_offerings or [])
            for item in custom_services:
                name = item["name"].strip()
                category_id = item["category"]
                service, _ = Service.objects.update_or_create(
                    category_id=category_id,
                    slug=slugify(name),
                    defaults={
                        "name": name,
                        "description": item.get("description", ""),
                        "price_min": item.get("price_min"),
                        "price_max": item.get("price_max"),
                        "is_active": True,
                    },
                )
                service_offerings.append(
                    {
                        "service": service.id,
                        "price_min": item.get("price_min"),
                        "price_max": item.get("price_max"),
                        "observaciones": item.get("observaciones", ""),
                        "years_experience": item.get("years_experience", 0),
                    }
                )

        if service_offerings is None:
            return
        by_service = {item["service"]: item for item in service_offerings}
        service_offerings = list(by_service.values())
        service_ids = list(by_service.keys())
        ProfessionalService.objects.filter(profile=profile).exclude(service_id__in=service_ids).delete()
        existing_ids = set(
            ProfessionalService.objects.filter(profile=profile, service_id__in=service_ids)
            .values_list("service_id", flat=True)
        )
        for item in service_offerings:
            defaults = {
                "price_min": item.get("price_min"),
                "price_max": item.get("price_max"),
                "observations": item.get("observaciones", ""),
                "years_experience": item.get("years_experience", 0),
            }
            if item["service"] in existing_ids:
                ProfessionalService.objects.filter(
                    profile=profile, service_id=item["service"]
                ).update(**defaults)
            else:
                ProfessionalService.objects.create(
                    profile=profile,
                    service_id=item["service"],
                    **defaults,
                )

    def create(self, validated_data):
        service_ids = validated_data.pop("service_ids", None)
        service_offerings = validated_data.pop("service_offerings", None)
        custom_services = validated_data.pop("custom_services", None)
        profile = ProfessionalProfile.objects.create(**validated_data)
        self._sync_services(profile, service_ids, service_offerings, custom_services)
        return profile

    def update(self, instance, validated_data):
        service_ids = validated_data.pop("service_ids", None)
        service_offerings = validated_data.pop("service_offerings", None)
        custom_services = validated_data.pop("custom_services", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._sync_services(instance, service_ids, service_offerings, custom_services)
        return instance
