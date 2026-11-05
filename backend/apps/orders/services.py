"""Transiciones de estado y efectos secundarios de las ordenes."""
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, Count
from rest_framework.exceptions import PermissionDenied
from apps.accounts.models import UserRole

from apps.service_requests.models import ServiceRequest

from .models import Order, OrderEvent, Review

# Transiciones permitidas: evita saltos invalidos (p. ej. de solicitada a completada).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Order.Status.REQUESTED: {Order.Status.ACCEPTED, Order.Status.CANCELLED},
    Order.Status.ACCEPTED: {Order.Status.SCHEDULED, Order.Status.TRAVELING, Order.Status.CANCELLED},
    Order.Status.SCHEDULED: {Order.Status.TRAVELING, Order.Status.CANCELLED},
    Order.Status.TRAVELING: {Order.Status.ARRIVED, Order.Status.CANCELLED},
    Order.Status.ARRIVED: {Order.Status.IN_PROGRESS, Order.Status.CANCELLED},
    Order.Status.IN_PROGRESS: {Order.Status.BREAK, Order.Status.LUNCH, Order.Status.OTHER_SERVICE, Order.Status.COMPLETED, Order.Status.CANCELLED},
    Order.Status.BREAK: {Order.Status.IN_PROGRESS, Order.Status.CANCELLED},
    Order.Status.LUNCH: {Order.Status.IN_PROGRESS, Order.Status.CANCELLED},
    Order.Status.OTHER_SERVICE: {Order.Status.IN_PROGRESS, Order.Status.CANCELLED},
    Order.Status.COMPLETED: set(),
    Order.Status.CANCELLED: set(),
}


class InvalidTransition(Exception):
    pass


def is_assigned_professional(order, user):
    return bool(user and getattr(user, "role", "") == UserRole.PROFESSIONAL
                and order.professional.user_id == user.id and order.client_id != user.id)


def is_order_client(order, user):
    return bool(user and getattr(user, "role", "") == UserRole.CLIENT and order.client_id == user.id
                and order.professional.user_id != user.id)


def price_bounds(order):
    """Conservar el rango aceptado; completar solo límites ausentes de órdenes antiguas."""
    lower, upper = order.estimate_min, order.estimate_max
    if lower is None or upper is None:
        offering = next((item for item in order.professional.services.all()
                         if item.service_id == order.service_request.selected_service_id), None)
        if offering:
            lower = lower if lower is not None else offering.price_min
            upper = upper if upper is not None else offering.price_max
    return lower, upper


def valid_price_bounds(order):
    lower, upper = price_bounds(order)
    return lower is not None and upper is not None and lower >= 1 and upper >= lower


def validate_price_range(order, amount):
    lower, upper = price_bounds(order)
    if lower is None or upper is None or lower < 1 or upper < lower:
        raise InvalidTransition("El servicio necesita una tarifa mínima y máxima publicadas válidas antes de confirmar el valor final.")
    if amount is None or not lower <= amount <= upper:
        raise InvalidTransition(f"La tarifa final debe estar entre {lower} y {upper} COP.")


@transaction.atomic
def transition(order: Order, new_status: str, user=None, note: str = "", scheduled_for=None, arrival_code="") -> Order:
    service_request = ServiceRequest.objects.select_for_update().get(pk=order.service_request_id)
    order = Order.objects.select_for_update().get(pk=order.pk)
    is_professional = is_assigned_professional(order, user)
    is_staff = user is not None and getattr(user, "role", "") == "staff"
    client_can_cancel = (
        is_order_client(order, user) and new_status == Order.Status.CANCELLED
        and order.status in {Order.Status.REQUESTED, Order.Status.ACCEPTED, Order.Status.SCHEDULED}
    )
    if not (is_professional or is_staff or client_can_cancel):
        raise PermissionDenied("Solo el profesional asignado puede avanzar el trabajo.")
    if new_status == Order.Status.ACCEPTED:
        raise InvalidTransition("Acepta la solicitud desde Mis solicitudes.")
    if service_request.status != ServiceRequest.Status.ACCEPTED and new_status != Order.Status.CANCELLED:
        raise InvalidTransition("El profesional debe aceptar la solicitud antes de iniciar el servicio.")
    if new_status not in ALLOWED_TRANSITIONS[order.status]:
        raise InvalidTransition(
            f"No se puede pasar de «{order.get_status_display()}» a «{new_status}»."
        )
    if new_status == Order.Status.SCHEDULED:
        if scheduled_for is None or scheduled_for <= timezone.now():
            raise InvalidTransition("Selecciona una fecha futura para agendar la visita.")
        order.scheduled_for = scheduled_for
    if new_status == Order.Status.ARRIVED:
        import secrets
        if not secrets.compare_digest(str(arrival_code).encode("utf-8"), order.arrival_code.encode("utf-8")):
            raise InvalidTransition("El código de llegada es incorrecto. Solicítalo al cliente.")
    order.status = new_status
    order.save(update_fields=["status", "scheduled_for", "updated_at"])
    OrderEvent.objects.create(order=order, status=new_status, note=note, created_by=user)

    if new_status in {Order.Status.COMPLETED, Order.Status.CANCELLED}:
        ServiceRequest.objects.filter(pk=order.service_request_id).update(
            status=ServiceRequest.Status.CLOSED if new_status == Order.Status.COMPLETED else ServiceRequest.Status.CANCELLED,
            updated_at=timezone.now(),
        )

    if new_status == Order.Status.COMPLETED:
        profile = order.professional
        profile.jobs_completed = profile.orders.filter(status=Order.Status.COMPLETED).count()
        profile.save(update_fields=["jobs_completed"])
    return order


def _check_price_change(order: Order, amount) -> None:
    if order.status in {Order.Status.REQUESTED, Order.Status.CANCELLED}:
        raise InvalidTransition("La orden debe estar aceptada y no cancelada para confirmar la tarifa.")
    validate_price_range(order, amount)
    if amount == order.final_price:
        return
    if order.payment_status == Order.PaymentStatus.PAID or order.payments.filter(status="pending").exists():
        raise InvalidTransition("El valor no se puede cambiar con un pago confirmado o en proceso.")


@transaction.atomic
def set_final_price(order: Order, amount, user) -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    if not is_assigned_professional(order, user):
        raise PermissionDenied("Solo el profesional asignado puede registrar el valor final acordado.")
    # Fijar los límites una sola vez antes de validar, también al completar una orden antigua.
    order.estimate_min, order.estimate_max = price_bounds(order)
    _check_price_change(order, amount)
    order.final_price = amount
    order.save(update_fields=["final_price", "estimate_min", "estimate_max", "updated_at"])
    return order


@transaction.atomic
def confirm_development_payment(order: Order, user=None) -> Order:
    """Marca como pagada una orden real para desarrollo/demo, sin pasarela externa."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.payment_status == Order.PaymentStatus.PAID:
        return order
    order.payment_status = Order.PaymentStatus.PAID
    order.payment_confirmed_at = timezone.now()
    order.payment_reference = order.payment_reference or f"DEV-{order.pk}"
    order.save(
        update_fields=[
            "payment_status",
            "payment_confirmed_at",
            "payment_reference",
            "updated_at",
        ]
    )
    return order


def refresh_rating(professional) -> None:
    """Recalcula el promedio mostrado en la tarjeta del profesional."""
    stats = Review.objects.filter(order__professional=professional).aggregate(
        average=Avg("rating"), total=Count("id")
    )
    professional.rating_avg = round(stats["average"] or 0, 2)
    professional.save(update_fields=["rating_avg"])
