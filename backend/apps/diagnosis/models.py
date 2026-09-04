from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import ServiceCategory
from apps.households.models import Household


class DiagnosticQuestion(models.Model):
    """Pregunta del flujo 'No estoy segura que necesito'."""

    code = models.SlugField(_("codigo"), max_length=40, unique=True)
    text = models.CharField(_("pregunta"), max_length=200)
    help_text = models.CharField(_("ayuda"), max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("pregunta de diagnostico")
        verbose_name_plural = _("preguntas de diagnostico")
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.text


class DiagnosticOption(models.Model):
    question = models.ForeignKey(
        DiagnosticQuestion, related_name="options", on_delete=models.CASCADE
    )
    value = models.SlugField(_("valor"), max_length=40)
    label = models.CharField(_("etiqueta"), max_length=120)
    order = models.PositiveSmallIntegerField(default=0)
    # Peso por categoria: {"impermeabilizacion": 3, "plomeria": 1}
    weights = models.JSONField(_("pesos por categoria"), default=dict, blank=True)

    class Meta:
        verbose_name = _("opcion de diagnostico")
        verbose_name_plural = _("opciones de diagnostico")
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["question", "value"], name="unique_option_value_per_question"
            )
        ]

    def __str__(self) -> str:
        return f"{self.question.code}: {self.label}"


class DiagnosticSession(models.Model):
    """Una consulta del cliente y la sugerencia (no vinculante) del sistema."""

    class Status(models.TextChoices):
        DRAFT = "draft", _("En curso")
        SUGGESTED = "suggested", _("Sugerencia entregada")
        CONFIRMED = "confirmed", _("Confirmada por el cliente")
        DISCARDED = "discarded", _("Descartada por el cliente")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="diagnostic_sessions",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    household = models.ForeignKey(
        Household,
        related_name="diagnostic_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    description = models.TextField(_("descripcion del problema"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    suggested_category = models.ForeignKey(
        ServiceCategory,
        related_name="diagnostic_suggestions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("categoria sugerida"),
    )
    confidence = models.FloatField(_("confianza"), default=0)
    rationale = models.CharField(_("motivo de la sugerencia"), max_length=300, blank=True)
    # Ranking completo del motor: [{"slug": ..., "name": ..., "score": ...}]
    ranking = models.JSONField(_("ranking de categorias"), default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("sesion de diagnostico")
        verbose_name_plural = _("sesiones de diagnostico")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Diagnostico #{self.pk} · {self.description[:40]}"


class DiagnosticAnswer(models.Model):
    session = models.ForeignKey(
        DiagnosticSession, related_name="answers", on_delete=models.CASCADE
    )
    question = models.ForeignKey(DiagnosticQuestion, on_delete=models.CASCADE)
    option = models.ForeignKey(
        DiagnosticOption, on_delete=models.SET_NULL, null=True, blank=True
    )
    free_text = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = _("respuesta de diagnostico")
        verbose_name_plural = _("respuestas de diagnostico")
        constraints = [
            models.UniqueConstraint(
                fields=["session", "question"], name="unique_answer_per_question"
            )
        ]

    def __str__(self) -> str:
        return f"{self.question.code} = {self.option.value if self.option else self.free_text}"
