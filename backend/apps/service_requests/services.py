"""Reglas de negocio de las solicitudes."""
from apps.professionals.geo import annotate_distance, within_radius
from apps.professionals.models import ProfessionalProfile

from .models import RequestCandidate, ServiceRequest


def build_candidates(request: ServiceRequest, limit: int = 20) -> list[RequestCandidate]:
    """Busca profesionales de la categoria confirmada dentro del radio elegido."""
    household = request.household
    queryset = ProfessionalProfile.objects.filter(
        is_active=True, services__category=request.selected_category
    ).distinct()
    queryset = annotate_distance(queryset, household.latitude, household.longitude)
    queryset = within_radius(queryset, request.search_radius_km).order_by("distance_km")[:limit]

    candidates = [
        RequestCandidate(
            request=request, professional=profile, distance_km=round(profile.distance_km, 2)
        )
        for profile in queryset
    ]
    return RequestCandidate.objects.bulk_create(candidates, ignore_conflicts=True)
