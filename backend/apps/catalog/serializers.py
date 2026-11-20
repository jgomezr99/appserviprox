from rest_framework import serializers

from .models import Service, ServiceCategory, StoreProduct, StoreProductReport

MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

class StoreProductSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
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
            "images",
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

    def get_images(self, instance) -> list[str]:
        request = self.context.get("request")
        paths = []
        if instance.image:
            paths.append(f"/api/v1/store/products/{instance.pk}/image/")
        paths.extend(f"/api/v1/store/products/{instance.pk}/gallery/{image.pk}/" for image in instance.gallery.all())
        return [request.build_absolute_uri(path) if request else path for path in paths]

    def get_is_owner(self, instance) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and instance.owner_id == user.id)


class StoreProductReportSerializer(serializers.ModelSerializer):
    productId = serializers.CharField(source="product_id_snapshot", read_only=True)
    productTitle = serializers.CharField(source="product_title", read_only=True)
    productPrice = serializers.IntegerField(source="product_price", read_only=True)
    productCategory = serializers.CharField(source="product_category", read_only=True)
    productImage = serializers.CharField(source="product_image", read_only=True)
    sellerId = serializers.CharField(source="seller_id_snapshot", read_only=True)
    sellerName = serializers.CharField(source="seller_name", read_only=True)
    sellerEmail = serializers.EmailField(source="seller_email", read_only=True)
    sellerPhone = serializers.CharField(source="seller_phone", read_only=True)
    sellerRole = serializers.CharField(source="seller_role", read_only=True)
    reporterName = serializers.CharField(source="reporter_name", read_only=True)
    reporterEmail = serializers.EmailField(source="reporter_email", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    adminResponse = serializers.CharField(source="admin_response", read_only=True)
    adminRespondedAt = serializers.DateTimeField(source="admin_responded_at", read_only=True)
    adminName = serializers.CharField(source="admin_name", read_only=True)
    actionTaken = serializers.CharField(source="action_taken", read_only=True)

    class Meta:
        model = StoreProductReport
        fields = [
            "id", "productId", "productTitle", "productPrice", "productCategory", "productImage",
            "sellerId", "sellerName", "sellerEmail", "sellerPhone", "sellerRole", "reporterName",
            "reporterEmail", "reason", "description", "priority", "createdAt", "status",
            "adminResponse", "adminRespondedAt", "adminName", "actionTaken",
        ]


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
