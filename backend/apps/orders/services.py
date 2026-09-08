"""Transiciones de estado y efectos secundarios de las ordenes."""
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, Count

from .models import Order, OrderEvent, Review

# Transiciones permitidas: evita saltos invalidos (p. ej. de solicitada a completada).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Order.Status.REQUESTED: {Order.Status.ACCEPTED, Order.Status.CANCELLED},
    Order.Status.ACCEPTED: {Order.Status.SCHEDULED, Order.Status.CANCELLED},
    Order.Status.SCHEDULED: {Order.Status.IN_PROGRESS, Order.Status.CANCELLED},
    Order.Status.IN_PROGRESS: {Order.Status.COMPLETED, Order.Status.CANCELLED},
    Order.Status.COMPLETED: set(),
    Order.Status.CANCELLED: set(),
}


class InvalidTransition(Exception):
    pass


@transaction.atomic
def transition(order: Order, new_status: str, user=None, note: str = "") -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    if new_status not in ALLOWED_TRANSITIONS[order.status]:
        raise InvalidTransition(
            f"No se puede pasar de «{order.get_status_display()}» a «{new_status}»."
        )
    if new_status == Order.Status.COMPLETED and order.payment_status != Order.PaymentStatus.PAID:
        raise InvalidTransition("No se puede completar una orden con pago pendiente.")
    order.status = new_status
    order.save(update_fields=["status", "updated_at"])
    OrderEvent.objects.create(order=order, status=new_status, note=note, created_by=user)

    if new_status == Order.Status.COMPLETED:
        profile = order.professional
        profile.jobs_completed = profile.orders.filter(status=Order.Status.COMPLETED).count()
        profile.save(update_fields=["jobs_completed"])
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
