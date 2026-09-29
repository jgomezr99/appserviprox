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
        TRAVELING = "traveling", _("En camino")
        ARRIVED = "arrived", _("En el lugar")
        IN_PROGRESS = "in_progress", _("En ejecucion")
        BREAK = "break", _("Descanso")
        LUNCH = "lunch", _("Almuerzo")
        OTHER_SERVICE = "other_service", _("Otro servicio")
        COMPLETED = "completed", _("Completada")
        CANCELLED = "cancelled", _("Cancelada")

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", _("Pendiente de pago")
        PAID = "paid", _("Pagado")

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
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=80, blank=True)
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
    arrival_code = models.CharField(max_length=8, unique=True, blank=True)
    professional_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    professional_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("orden")
        verbose_name_plural = _("ordenes")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Orden #{self.pk} · {self.professional.display_name}"

    def save(self, *args, **kwargs):
        if not self.arrival_code:
            import secrets
            self.arrival_code = str(secrets.randbelow(9000) + 1000)
        super().save(*args, **kwargs)


class WorkEvidence(models.Model):
    order = models.ForeignKey(Order, related_name="work_evidence", on_delete=models.CASCADE)
    image = models.ImageField(upload_to="work-evidence/%Y/%m/")
    caption = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


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
