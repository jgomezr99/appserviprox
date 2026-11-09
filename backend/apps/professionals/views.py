from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import PlatformSettings, UserRole
from apps.orders.models import Order

from .geo import annotate_distance, within_radius
from .models import BenefitRedemption, ProfessionalProfile, ProfessionalService
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
    lookup_value_regex = r"[^/]+"

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field, "")
        queryset = self.filter_queryset(self.get_queryset())
        obj = None
        if str(lookup).isdigit():
            obj = queryset.filter(id=int(lookup)).first()
        if not obj:
            obj = queryset.filter(slug=lookup).first()
        if not obj:
            obj = queryset.filter(user__username=lookup).first()
        if not obj:
            from django.utils.text import slugify
            for item in queryset:
                if slugify(item.display_name) == lookup:
                    obj = item
                    break
        if not obj:
            raise NotFound("Profesional no encontrado en la base de datos.")
        self.check_object_permissions(self.request, obj)
        return obj

    def get_permissions(self):
        if self.action in {"me", "benefit_redemptions", "live_location"}:
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
        if self.action == "list" and self.request.user.is_authenticated:
            queryset = queryset.exclude(user_id=self.request.user.id)

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

        # Un profesional con un servicio terminado sin pagar queda fuera de las búsquedas
        # públicas; el equipo Serviprox sigue viéndolo en el panel administrativo.
        user = self.request.user
        is_staff = user.is_authenticated and (user.is_staff or user.role == UserRole.STAFF)
        if self.action == "list" and not is_staff:
            queryset = queryset.exclude(
                Exists(
                    Order.objects.filter(
                        professional=OuterRef("pk"),
                        status=Order.Status.COMPLETED,
                        payment_status=Order.PaymentStatus.PENDING,
                    )
                )
            )

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
                serializer = self.get_serializer(profile, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
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

    @action(detail=False, methods=["post", "patch"], url_path="location")
    def live_location(self, request):
        """Actualiza las coordenadas GPS en tiempo real del profesional."""
        if not request.user.is_authenticated or request.user.role != UserRole.PROFESSIONAL:
            raise PermissionDenied("Solo los profesionales pueden actualizar su ubicación.")
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            raise NotFound("Perfil profesional no encontrado.")
        try:
            lat = float(request.data["latitude"])
            lng = float(request.data["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "latitude y longitude son obligatorios."}, status=status.HTTP_400_BAD_REQUEST)

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return Response({"detail": "Coordenadas fuera de rango válido."}, status=status.HTTP_400_BAD_REQUEST)

        profile.latitude = lat
        profile.longitude = lng
        profile.save(update_fields=["latitude", "longitude"])
        return Response({
            "status": "ok",
            "professional_id": profile.id,
            "latitude": lat,
            "longitude": lng,
            "updated_at": timezone.now().isoformat(),
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get", "post"], url_path="benefit-redemptions")
    def benefit_redemptions(self, request):
        if request.user.role != UserRole.PROFESSIONAL:
            raise PermissionDenied("Solo los profesionales pueden gestionar sus beneficios.")

        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            raise NotFound("Perfil profesional no encontrado.")

        if request.method == "GET":
            redemptions = profile.benefit_redemptions.all()
            return Response([
                {
                    "id": item.id,
                    "benefit_id": item.benefit_id,
                    "title": item.title,
                    "points": item.points,
                    "recharge_amount": str(item.recharge_amount),
                    "status": item.status,
                    "created_at": item.created_at.isoformat(),
                }
                for item in redemptions
            ])

        benefit_id = str(request.data.get("benefit_id", "")).strip()
        if not benefit_id:
            raise ValidationError({"benefit_id": "Selecciona un beneficio."})

        settings_data = PlatformSettings.load()
        catalog = settings_data.get("sections", {}).get("benefit_catalog", {})
        items = catalog.get("items", []) if isinstance(catalog, dict) else []
        benefit = next(
            (
                item for item in items
                if isinstance(item, dict) and str(item.get("id", "")) == benefit_id
            ),
            None,
        ) if isinstance(items, list) else None
        if not benefit:
            raise NotFound("El beneficio ya no está disponible.")

        try:
            points = int(benefit.get("points", 0))
            recharge_amount = Decimal(str(benefit.get("recharge_amount", 0) or 0))
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError({"benefit_id": "La configuración del beneficio no es válida."})
        title = str(benefit.get("title", "")).strip()
        if points <= 0 or not recharge_amount.is_finite() or recharge_amount < 0 or not title:
            raise ValidationError({"benefit_id": "La configuración del beneficio no es válida."})

        with transaction.atomic():
            profile = ProfessionalProfile.objects.select_for_update().get(pk=profile.pk)
            if profile.points < points:
                raise ValidationError({"detail": "No tienes puntos suficientes para este beneficio."})
            profile.points -= points
            profile.save(update_fields=["points"])
            redemption = BenefitRedemption.objects.create(
                profile=profile,
                benefit_id=benefit_id,
                title=title[:180],
                points=points,
                recharge_amount=recharge_amount,
            )

        return Response(
            {
                "id": redemption.id,
                "benefit_id": redemption.benefit_id,
                "title": redemption.title,
                "points": redemption.points,
                "recharge_amount": str(redemption.recharge_amount),
                "status": redemption.status,
                "created_at": redemption.created_at.isoformat(),
                "remaining_points": profile.points,
            },
            status=status.HTTP_201_CREATED,
        )
