"""Suspensión por pago pendiente: servicios terminados que el cliente aún no paga.

La suspensión se calcula (no se guarda): mientras exista una orden terminada con pago
pendiente, el cliente no puede contratar y el profesional no recibe ni acepta solicitudes.
Al aprobarse el pago la restricción desaparece sola. El login nunca se bloquea, para que
el cliente siempre pueda entrar a pagar.
"""
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from .models import Order

CLIENT_HOLD_MESSAGE = (
    "Tienes un servicio terminado sin pagar. Tu cuenta está suspendida hasta que lo pagues."
)
PROFESSIONAL_HOLD_MESSAGE = (
    "Tu cuenta está suspendida: un cliente aún no paga un servicio que terminaste. "
    "Se reactiva automáticamente cuando el pago sea confirmado."
)


def unpaid_completed_orders(user):
    return Order.objects.filter(
        status=Order.Status.COMPLETED, payment_status=Order.PaymentStatus.PENDING
    ).filter(Q(client=user) | Q(professional__user=user))


def client_has_hold(user) -> bool:
    return Order.objects.filter(
        client=user,
        status=Order.Status.COMPLETED,
        payment_status=Order.PaymentStatus.PENDING,
    ).exists()


def professional_has_hold(profile) -> bool:
    return Order.objects.filter(
        professional=profile,
        status=Order.Status.COMPLETED,
        payment_status=Order.PaymentStatus.PENDING,
    ).exists()


def assert_client_can_hire(user) -> None:
    if client_has_hold(user):
        raise PermissionDenied(CLIENT_HOLD_MESSAGE)


def assert_professional_can_work(profile) -> None:
    if professional_has_hold(profile):
        raise PermissionDenied(PROFESSIONAL_HOLD_MESSAGE)
