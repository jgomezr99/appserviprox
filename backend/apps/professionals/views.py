from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db.models import Exists, OuterRef, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import UserRole

from .geo import annotate_distance, within_radius
from .models import ProfessionalProfile, ProfessionalService
from .serializers import (
    ProfessionalDetailSerializer,
    ProfessionalListSerializer,
    ProfessionalProfileMeSerializer,
)


def _as_float(value, name):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValidationError({name: "Debe ser un numero decimal."})


def _as_decimal(value, name):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({name: "Debe ser un numero decimal."})


@extend_schema(
    parameters=[
        OpenApiParameter("lat", OpenApiTypes.FLOAT, description="Latitud del cliente."),
        OpenApiParameter("lng", OpenApiTypes.FLOAT, description="Longitud del cliente."),
        OpenApiParameter("radius_km", OpenApiTypes.FLOAT, description="Radio de busqueda."),
        OpenApiParameter("category", OpenApiTypes.STR, description="Slug de la categoria."),
        OpenApiParameter("service", OpenApiTypes.STR, description="ID o slug del servicio."),
        OpenApiParameter("price_min", OpenApiTypes.NUMBER, description="Presupuesto minimo."),
        OpenApiParameter("price_max", OpenApiTypes.NUMBER, description="Presupuesto maximo."),
    ]
)
class ProfessionalViewSet(viewsets.ReadOnlyModelViewSet):
    """Busqueda de profesionales; con `lat`/`lng` ordena y filtra por cercania."""

    serializer_class = ProfessionalListSerializer
    search_fields = ["display_name", "headline", "bio", "neighborhood"]
    ordering_fields = ["rating_avg", "jobs_completed", "created_at"]

    def get_permissions(self):
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProfessionalDetailSerializer
        if self.action == "me":
            return ProfessionalProfileMeSerializer
        return ProfessionalListSerializer

    def get_queryset(self):
        params = self.request.query_params
        queryset = (
            ProfessionalProfile.objects.filter(is_active=True)
            .select_related("user")
            .prefetch_related("services__service__category", "availability", "portfolio")
        )

        category = params.get("category")
        service = params.get("service")
        price_min = params.get("price_min")
        price_max = params.get("price_max")

        if price_min and price_max and _as_decimal(price_min, "price_min") > _as_decimal(price_max, "price_max"):
            raise ValidationError({"price_max": "El precio maximo debe ser mayor o igual al minimo."})

        if category or service or price_min or price_max:
            offered_services = ProfessionalService.objects.filter(
                profile=OuterRef("pk"),
                service__is_active=True,
                service__category__is_active=True,
            )
            if category:
                offered_services = offered_services.filter(service__category__slug=category)
            if service:
                service_filter = (
                    {"service_id": int(service)}
                    if service.isdigit()
                    else {"service__slug": service}
                )
                offered_services = offered_services.filter(**service_filter)
            if price_min or price_max:
                offered_services = offered_services.exclude(
                    price_min__isnull=True, price_max__isnull=True
                )
            if price_max:
                offered_services = offered_services.filter(
                    Q(price_min__isnull=True) | Q(price_min__lte=_as_decimal(price_max, "price_max"))
                )
            if price_min:
                offered_services = offered_services.filter(
                    Q(price_max__isnull=True) | Q(price_max__gte=_as_decimal(price_min, "price_min"))
                )
            queryset = queryset.filter(Exists(offered_services))

        if params.get("accepts_urgent") in {"1", "true", "True"}:
            queryset = queryset.filter(accepts_urgent=True)

        lat, lng = params.get("lat"), params.get("lng")
        if lat and lng:
            queryset = annotate_distance(queryset, _as_float(lat, "lat"), _as_float(lng, "lng"))
            radius = params.get("radius_km")
            radius_km = (
                _as_float(radius, "radius_km") if radius else settings.DEFAULT_SEARCH_RADIUS_KM
            )
            queryset = within_radius(queryset, radius_km).order_by("distance_km")

        return queryset

    @action(detail=False, methods=["get", "post", "patch"], url_path="me")
    def me(self, request):
        if request.user.role != UserRole.PROFESSIONAL:
            raise PermissionDenied("Solo los profesionales pueden gestionar este perfil.")

        profile = getattr(request.user, "professional_profile", None)

        if request.method == "GET":
            if not profile:
                raise NotFound("Perfil profesional no encontrado.")
            return Response(self.get_serializer(profile).data)

        if request.method == "POST":
            if profile:
                raise ValidationError({"detail": "Ya existe un perfil profesional."})
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        if not profile:
            raise NotFound("Perfil profesional no encontrado.")
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
