from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class PropertyType(models.TextChoices):
    APARTMENT = "apartment", _("Apartamento")
    HOUSE = "house", _("Casa")
    OFFICE = "office", _("Oficina")
    COMMERCIAL = "commercial", _("Local comercial")


class Household(models.Model):
    """Direccion del cliente: origen del radio de busqueda del mapa."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="households", on_delete=models.CASCADE
    )
    label = models.CharField(_("nombre"), max_length=80, default="Mi hogar")
    property_type = models.CharField(
        _("tipo"), max_length=20, choices=PropertyType.choices, default=PropertyType.APARTMENT
    )
    address_line = models.CharField(_("direccion"), max_length=200, blank=True)
    neighborhood = models.CharField(_("barrio"), max_length=100, blank=True)
    city = models.CharField(_("ciudad"), max_length=80, default="Bogota")
    country = models.CharField(_("pais"), max_length=80, default="Colombia")
    latitude = models.FloatField(_("latitud"))
    longitude = models.FloatField(_("longitud"))
    area_m2 = models.PositiveIntegerField(_("area m2"), null=True, blank=True)
    build_year = models.PositiveSmallIntegerField(_("anio de construccion"), null=True, blank=True)
    notes = models.TextField(_("notas de acceso"), blank=True)
    is_default = models.BooleanField(_("principal"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("hogar")
        verbose_name_plural = _("hogares")
        ordering = ["-is_default", "-created_at"]

    def __str__(self) -> str:
        return f"{self.label} · {self.short_location}"

    @property
    def short_location(self) -> str:
        """Texto del pill de ubicacion, ej. 'Kennedy, Bogota'."""
        return ", ".join(part for part in (self.neighborhood, self.city) if part)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Household.objects.filter(owner=self.owner).exclude(pk=self.pk).update(
                is_default=False
            )
