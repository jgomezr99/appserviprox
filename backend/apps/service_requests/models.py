from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import ServiceCategory
from apps.diagnosis.models import DiagnosticSession
from apps.households.models import Household
from apps.professionals.models import ProfessionalProfile


class ServiceRequest(models.Model):
    """Solicitud del cliente.

    Distingue de forma explicita dos campos que el prototipo pinta con colores
    distintos: `suggested_category` (lo que propuso el sistema, no vinculante)
    y `selected_category` (lo que el cliente confirmo). Guardar ambos permite
    medir cuantas veces la sugerencia acerto.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", _("Borrador")
        OPEN = "open", _("Publicada")
        MATCHED = "matched", _("Con profesional asignado")
        CLOSED = "closed", _("Cerrada")
        CANCELLED = "cancelled", _("Cancelada")

    class Urgency(models.TextChoices):
        FLEXIBLE = "flexible", _("Puedo esperar")
        THIS_WEEK = "this_week", _("Esta semana")
        URGENT = "urgent", _("Urgente")

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="service_requests", on_delete=models.CASCADE
    )
    household = models.ForeignKey(
        Household, related_name="service_requests", on_delete=models.PROTECT
    )
    diagnostic_session = models.OneToOneField(
        DiagnosticSession,
        related_name="service_request",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    suggested_category = models.ForeignKey(
        ServiceCategory,
        related_name="requests_suggested",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("categoria sugerida por el sistema"),
    )
    selected_category = models.ForeignKey(
        ServiceCategory,
        related_name="requests_selected",
        on_delete=models.PROTECT,
        verbose_name=_("categoria confirmada por el cliente"),
    )

    description = models.TextField(_("descripcion"), blank=True)
    urgency = models.CharField(max_length=20, choices=Urgency.choices, default=Urgency.THIS_WEEK)
    search_radius_km = models.FloatField(_("radio de busqueda (km)"), default=5)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("solicitud de servicio")
        verbose_name_plural = _("solicitudes de servicio")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Solicitud #{self.pk} · {self.selected_category}"

    @property
    def followed_suggestion(self) -> bool | None:
        """True si el cliente confirmo la sugerencia; None si no hubo sugerencia."""
        if self.suggested_category_id is None:
            return None
        return self.suggested_category_id == self.selected_category_id


class RequestCandidate(models.Model):
    """Profesional propuesto para una solicitud, con la distancia calculada."""

    class Status(models.TextChoices):
        SUGGESTED = "suggested", _("Sugerido")
        CONTACTED = "contacted", _("Contactado")
        QUOTED = "quoted", _("Cotizo")
        DECLINED = "declined", _("Declino")
        HIRED = "hired", _("Contratado")

    request = models.ForeignKey(
        ServiceRequest, related_name="candidates", on_delete=models.CASCADE
    )
    professional = models.ForeignKey(
        ProfessionalProfile, related_name="candidacies", on_delete=models.CASCADE
    )
    distance_km = models.FloatField(_("distancia (km)"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUGGESTED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("candidato")
        verbose_name_plural = _("candidatos")
        ordering = ["distance_km"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "professional"], name="unique_candidate_per_request"
            )
        ]

    def __str__(self) -> str:
        return f"{self.professional} a {self.distance_km:.1f} km"
