from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.professionals.models import ProfessionalProfile
from apps.service_requests.models import ServiceRequest


class Order(models.Model):
    """Visita agendada entre un cliente y un profesional."""

    class Status(models.TextChoices):
        REQUESTED = "requested", _("Solicitada")
        ACCEPTED = "accepted", _("Aceptada")
        SCHEDULED = "scheduled", _("Agendada")
        IN_PROGRESS = "in_progress", _("En ejecucion")
        COMPLETED = "completed", _("Completada")
        CANCELLED = "cancelled", _("Cancelada")

    service_request = models.ForeignKey(
        ServiceRequest, related_name="orders", on_delete=models.PROTECT
    )
    professional = models.ForeignKey(
        ProfessionalProfile, related_name="orders", on_delete=models.PROTECT
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="orders", on_delete=models.PROTECT
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    scheduled_for = models.DateTimeField(_("visita agendada"), null=True, blank=True)
    estimate_min = models.DecimalField(
        _("estimado minimo"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    estimate_max = models.DecimalField(
        _("estimado maximo"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    final_price = models.DecimalField(
        _("precio final"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    client_notes = models.TextField(_("notas del cliente"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("orden")
        verbose_name_plural = _("ordenes")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Orden #{self.pk} · {self.professional.display_name}"


class OrderEvent(models.Model):
    """Bitacora de estados; alimenta la linea de tiempo de la app."""

    order = models.ForeignKey(Order, related_name="events", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Order.Status.choices)
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("evento de la orden")
        verbose_name_plural = _("eventos de la orden")
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.order_id} → {self.status}"


class Review(models.Model):
    order = models.OneToOneField(Order, related_name="review", on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("calificacion")
        verbose_name_plural = _("calificaciones")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.rating}★ · orden #{self.order_id}"
