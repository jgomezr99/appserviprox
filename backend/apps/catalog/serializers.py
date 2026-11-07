from rest_framework import serializers

from .models import Service, ServiceCategory, StoreProduct

MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

class StoreProductSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = StoreProduct
        fields = [
            "id",
            "title",
            "category",
            "price",
            "description",
            "seller_name",
            "seller_role",
            "phone",
            "city",
            "image",
            "image_url",
            "is_owner",
            "created_at",
        ]
        read_only_fields = ["id", "seller_name", "seller_role", "is_owner", "created_at"]

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Ingresa el título del producto.")
        return value

    def validate_category(self, value: str) -> str:
        # Se permite cualquier tipo de producto en cada categoría para todos los perfiles (profesional, cliente, staff)
        if value not in StoreProduct.Category.values:
            raise serializers.ValidationError("Selecciona una categoría válida.")
        return value

    def validate_price(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a cero.")
        return value

    def validate_image(self, value):
        if value and value.size > MAX_PRODUCT_IMAGE_BYTES:
            raise serializers.ValidationError("La imagen no puede superar los 5 MB.")
        return value

    def get_image_url(self, instance) -> str:
        if not instance.image:
            return ""
        path = f"/api/v1/store/products/{instance.pk}/image/"
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path

    def get_is_owner(self, instance) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and instance.owner_id == user.id)


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
