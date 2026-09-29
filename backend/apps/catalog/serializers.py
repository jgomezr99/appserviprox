from rest_framework import serializers

from .models import Service, ServiceCategory


class ServiceSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "category",
            "category_slug",
            "name",
            "slug",
            "description",
            "price_min",
            "price_max",
            "estimated_hours",
        ]


class ServiceCategorySerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)
    professionals_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "icon_key",
            "sort_order",
            "services",
            "professionals_count",
        ]


class ServiceCategoryListSerializer(serializers.ModelSerializer):
    """Version liviana para la grilla de la app (sin anidar servicios)."""

    professionals_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "description", "icon_key", "professionals_count"]
