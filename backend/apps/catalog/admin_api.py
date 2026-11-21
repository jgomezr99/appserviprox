"""Gestión del catálogo desde el panel Serviprox, con JWT y auditoría."""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AdminAuditLog
from apps.accounts.permissions import IsServiproxAdministrator
from apps.diagnosis.engine import normalize, suggest_services

from .models import Service, ServiceCategory
from .serializers import ServiceCategoryListSerializer, ServiceSerializer


class KeywordField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Cada palabra clave debe ser un texto.")
        return super().to_internal_value(data)


class CatalogSerializer(serializers.ModelSerializer):
    keywords = serializers.ListField(
        child=KeywordField(max_length=120, allow_blank=False),
        max_length=50, required=False, allow_empty=True,
    )

    def validate_keywords(self, values):
        result, seen = [], set()
        for value in values:
            value = " ".join(value.split())
            key = normalize(value)
            if key not in seen:
                result.append(value)
                seen.add(key)
        return result

    def create(self, validated_data):
        # El identificador se genera al crear; renombrar no rompe URLs ni pesos.
        model = self.Meta.model
        limit = model._meta.get_field("slug").max_length
        base = slugify(validated_data["name"])[:limit] or "catalogo"
        queryset = model.objects.all()
        if model is Service:
            queryset = queryset.filter(category=validated_data["category"])
        candidate, suffix = base, 2
        while queryset.filter(slug=candidate).exists():
            tail = f"-{suffix}"
            candidate = base[:limit - len(tail)] + tail
            suffix += 1
        validated_data["slug"] = candidate
        return super().create(validated_data)


class AdminCategorySerializer(CatalogSerializer):
    services_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ServiceCategory
        fields = [
            "id", "name", "slug", "description", "icon_key", "keywords",
            "sort_order", "is_active", "services_count",
        ]
        read_only_fields = ["id", "slug"]


class AdminServiceSerializer(CatalogSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_active = serializers.BooleanField(source="category.is_active", read_only=True)
    professionals_count = serializers.IntegerField(read_only=True, default=0)
    price_min = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"),
        required=False, allow_null=True,
    )
    price_max = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"),
        required=False, allow_null=True,
    )
    estimated_hours = serializers.DecimalField(
        max_digits=5, decimal_places=1, min_value=Decimal("0"),
        required=False, allow_null=True,
    )

    class Meta:
        model = Service
        fields = [
            "id", "category", "category_name", "category_active", "name", "slug",
            "description", "keywords", "price_min", "price_max", "estimated_hours",
            "is_active", "professionals_count",
        ]
        read_only_fields = ["id", "slug"]

    def validate(self, attrs):
        minimum = attrs.get("price_min", getattr(self.instance, "price_min", None))
        maximum = attrs.get("price_max", getattr(self.instance, "price_max", None))
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({"price_max": "La tarifa máxima debe ser mayor o igual a la mínima."})
        category = attrs.get("category", getattr(self.instance, "category", None))
        if self.instance and category and Service.objects.filter(
            category=category, slug=self.instance.slug,
        ).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError({"category": "Ya existe un servicio con el mismo identificador en esa categoría."})
        return attrs


class CatalogPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminCatalogViewSet(viewsets.ModelViewSet):
    permission_classes = [IsServiproxAdministrator]
    pagination_class = CatalogPagination
    search_fields = ["name", "description", "keywords"]

    def _audit(self, action, instance, reason=""):
        user = self.request.user
        AdminAuditLog.objects.create(
            admin_user=user,
            admin_name=(user.get_full_name() or user.username)[:150],
            action=action,
            target=f"{instance._meta.verbose_name} #{instance.pk}: {instance.name}"[:255],
            reason=reason,
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._audit("Crear elemento de catálogo", instance)

    def perform_update(self, serializer):
        fields = ", ".join(sorted(serializer.validated_data))
        instance = serializer.save()
        self._audit("Actualizar elemento de catálogo", instance, f"Campos actualizados: {fields}")

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response({"detail": "Ya existe un elemento con esos datos. Actualiza el catálogo e inténtalo nuevamente."}, status=status.HTTP_409_CONFLICT)

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response({"detail": "Los datos entran en conflicto con otro elemento del catálogo."}, status=status.HTTP_409_CONFLICT)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            with transaction.atomic():
                instance = get_object_or_404(type(instance).objects.select_for_update(), pk=instance.pk)
                # No permitir cascadas sobre ofertas, solicitudes o diagnósticos.
                for relation in instance._meta.related_objects:
                    if relation.related_model._base_manager.filter(
                        **{relation.field.name: instance}
                    ).exists():
                        return Response({"detail": "Este elemento tiene registros relacionados. Desactívalo para conservar el historial."}, status=status.HTTP_409_CONFLICT)
                self._audit("Eliminar elemento de catálogo", instance)
                instance.delete()
        except (ProtectedError, IntegrityError):
            return Response({"detail": "Este elemento está en uso. Puedes desactivarlo para conservar el historial."}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminCategoryViewSet(AdminCatalogViewSet):
    serializer_class = AdminCategorySerializer
    filterset_fields = ["is_active"]
    queryset = ServiceCategory.objects.annotate(
        services_count=Count("services", distinct=True),
    ).order_by("sort_order", "name", "id")


class AdminServiceViewSet(AdminCatalogViewSet):
    serializer_class = AdminServiceSerializer
    filterset_fields = ["category", "is_active"]
    queryset = Service.objects.select_related("category").annotate(
        professionals_count=Count("professional_services", distinct=True),
    ).order_by("category__sort_order", "name", "id")


class SuggestionPreviewInput(serializers.Serializer):
    description = serializers.CharField(min_length=5, max_length=1000)


class AdminSuggestionPreview(APIView):
    permission_classes = [IsServiproxAdministrator]
    serializer_class = SuggestionPreviewInput

    @extend_schema(request=SuggestionPreviewInput)
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        suggestion = suggest_services(serializer.validated_data["description"])
        # Usa el mismo motor del cliente sin crear sesiones ni solicitudes.
        return Response({
            "suggested_category": ServiceCategoryListSerializer(suggestion.category).data if suggestion.category else None,
            "suggested_service": ServiceSerializer(suggestion.service).data if suggestion.service else None,
            "confidence": suggestion.confidence,
            "rationale": suggestion.rationale,
            "ranking": suggestion.ranking,
            "service_ranking": suggestion.service_ranking,
        })
