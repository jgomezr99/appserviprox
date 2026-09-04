from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import ServiceCategory


class ProfessionalProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="professional_profile", on_delete=models.CASCADE
    )
    display_name = models.CharField(_("nombre publico"), max_length=120)
    headline = models.CharField(_("titular"), max_length=140, blank=True)
    bio = models.TextField(_("descripcion"), blank=True)

    # Base de operacion: centro desde el que se calcula la distancia al cliente.
    latitude = models.FloatField(_("latitud"))
    longitude = models.FloatField(_("longitud"))
    neighborhood = models.CharField(_("barrio"), max_length=100, blank=True)
    city = models.CharField(_("ciudad"), max_length=80, default="Bogota")
    coverage_radius_km = models.FloatField(_("radio de cobertura (km)"), default=8)

    rating_avg = models.DecimalField(
        _("calificacion"),
        max_digits=3,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("5"))],
    )
    jobs_completed = models.PositiveIntegerField(_("servicios completados"), default=0)
    response_time_minutes = models.PositiveIntegerField(_("tiempo de respuesta"), default=60)

    is_verified = models.BooleanField(_("verificado por Serviprox"), default=False)
    is_active = models.BooleanField(_("activo"), default=True)
    accepts_urgent = models.BooleanField(_("atiende urgencias"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("profesional")
        verbose_name_plural = _("profesionales")
        ordering = ["-rating_avg", "-jobs_completed"]
        indexes = [models.Index(fields=["latitude", "longitude"])]

    def __str__(self) -> str:
        return self.display_name

    @property
    def initials(self) -> str:
        parts = self.display_name.split()
        return "".join(p[0] for p in parts[:2]).upper() if parts else "SP"


class ProfessionalService(models.Model):
    """Categoria que atiende un profesional, con su rango de tarifa propio."""

    profile = models.ForeignKey(
        ProfessionalProfile, related_name="services", on_delete=models.CASCADE
    )
    category = models.ForeignKey(
        ServiceCategory, related_name="professional_services", on_delete=models.CASCADE
    )
    price_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    price_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    years_experience = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = _("servicio del profesional")
        verbose_name_plural = _("servicios del profesional")
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "category"], name="unique_category_per_professional"
            )
        ]

    def __str__(self) -> str:
        return f"{self.profile.display_name} · {self.category.name}"


class AvailabilitySlot(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, _("Lunes")
        TUESDAY = 1, _("Martes")
        WEDNESDAY = 2, _("Miercoles")
        THURSDAY = 3, _("Jueves")
        FRIDAY = 4, _("Viernes")
        SATURDAY = 5, _("Sabado")
        SUNDAY = 6, _("Domingo")

    profile = models.ForeignKey(
        ProfessionalProfile, related_name="availability", on_delete=models.CASCADE
    )
    weekday = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        verbose_name = _("franja de disponibilidad")
        verbose_name_plural = _("franjas de disponibilidad")
        ordering = ["weekday", "start_time"]

    def __str__(self) -> str:
        return f"{self.get_weekday_display()} {self.start_time:%H:%M}-{self.end_time:%H:%M}"


class PortfolioItem(models.Model):
    profile = models.ForeignKey(
        ProfessionalProfile, related_name="portfolio", on_delete=models.CASCADE
    )
    image_url = models.URLField(blank=True)
    caption = models.CharField(max_length=140, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = _("trabajo del portafolio")
        verbose_name_plural = _("portafolio")
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.caption or f"Trabajo #{self.pk}"
