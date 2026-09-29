"""Reglas de negocio de las solicitudes."""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.professionals.geo import annotate_distance, within_radius
from apps.professionals.models import ProfessionalProfile, ProfessionalService

from .models import RequestCandidate, ServiceRequest


def build_candidates(request: ServiceRequest, limit: int = 20) -> list[RequestCandidate]:
    """Busca profesionales compatibles dentro del radio elegido."""
    household = request.household
    service_filter = (
        {"services__service_id": request.selected_service_id}
        if request.selected_service_id
        else {"services__service__category": request.selected_category}
    )
    queryset = ProfessionalProfile.objects.filter(is_active=True, **service_filter).distinct()

    if household.latitude is not None and household.longitude is not None:
        queryset = annotate_distance(queryset, household.latitude, household.longitude)
        queryset = within_radius(queryset, request.search_radius_km).order_by("distance_km")
    else:
        queryset = queryset.order_by("-rating_avg", "-jobs_completed")

    candidates = [
        RequestCandidate(
            request=request,
            professional=profile,
            distance_km=round(getattr(profile, "distance_km", 0), 2),
        )
        for profile in queryset[:limit]
    ]
    return RequestCandidate.objects.bulk_create(candidates, ignore_conflicts=True)


def professional_offers_service(professional: ProfessionalProfile, service_id: int | None) -> bool:
    if service_id is None:
        return False
    return ProfessionalService.objects.filter(
        profile=professional,
        service_id=service_id,
        service__is_active=True,
        service__category__is_active=True,
    ).exists()


def _professional_profile_for(user) -> ProfessionalProfile:
    profile = getattr(user, "professional_profile", None)
    if not profile:
        raise PermissionDenied("Solo el profesional destinatario puede responder la solicitud.")
    return profile


def _lock_request(service_request_id: int) -> ServiceRequest:
    return (
        ServiceRequest.objects.select_for_update(of=("self",))
        .select_related("client", "household", "selected_service", "professional")
        .get(pk=service_request_id)
    )


@transaction.atomic
def accept_request(service_request_id: int, user) -> ServiceRequest:
    from apps.orders.models import Order, OrderEvent

    profile = _professional_profile_for(user)
    service_request = _lock_request(service_request_id)

    if service_request.professional_id != profile.id:
        raise PermissionDenied("Esta solicitud no esta dirigida a este profesional.")
    if service_request.status != ServiceRequest.Status.OPEN:
        raise ValidationError({"status": "La solicitud ya no se puede aceptar."})
    if not professional_offers_service(profile, service_request.selected_service_id):
        raise ValidationError({"professional": "El profesional no ofrece este servicio."})

    order = service_request.orders.select_for_update().filter(professional=profile).first()
    if order is None:
        order = Order.objects.create(
            service_request=service_request,
            professional=profile,
            client=service_request.client,
            status=Order.Status.ACCEPTED,
            client_notes=service_request.description,
        )
        OrderEvent.objects.create(
            order=order,
            status=Order.Status.ACCEPTED,
            note="Solicitud aceptada por el profesional.",
            created_by=user,
        )

    service_request.status = ServiceRequest.Status.ACCEPTED
    service_request.save(update_fields=["status", "updated_at"])
    RequestCandidate.objects.filter(
        request=service_request, professional=profile
    ).update(status=RequestCandidate.Status.HIRED)
    return service_request


@transaction.atomic
def reject_request(service_request_id: int, user) -> ServiceRequest:
    profile = _professional_profile_for(user)
    service_request = _lock_request(service_request_id)

    if service_request.professional_id != profile.id:
        raise PermissionDenied("Esta solicitud no esta dirigida a este profesional.")
    if service_request.status != ServiceRequest.Status.OPEN:
        raise ValidationError({"status": "La solicitud ya no se puede rechazar."})

    service_request.status = ServiceRequest.Status.REJECTED
    service_request.save(update_fields=["status", "updated_at"])
    RequestCandidate.objects.filter(
        request=service_request, professional=profile
    ).update(status=RequestCandidate.Status.DECLINED)
    return service_request
