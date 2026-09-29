from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


class ServiceCategory(models.Model):
    """Categoria visible en la grilla del prototipo (Plomeria, Electricidad...)."""

    name = models.CharField(_("nombre"), max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    description = models.CharField(_("descripcion"), max_length=200, blank=True)
    # Clave del icono usada por el frontend para pintar el SVG correspondiente.
    icon_key = models.CharField(_("icono"), max_length=40, blank=True)
    keywords = models.JSONField(
        _("palabras clave"),
        default=list,
        blank=True,
        help_text="Terminos que el diagnostico usa para sugerir esta categoria.",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("categoria de servicio")
        verbose_name_plural = _("categorias de servicio")
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Service(models.Model):
    """Servicio concreto dentro de una categoria, con su rango de tarifa."""

    category = models.ForeignKey(
        ServiceCategory, related_name="services", on_delete=models.CASCADE
    )
    name = models.CharField(_("nombre"), max_length=120)
    slug = models.SlugField(max_length=140, blank=True)
    description = models.TextField(_("descripcion"), blank=True)
    price_min = models.DecimalField(
        _("tarifa minima"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    price_max = models.DecimalField(
        _("tarifa maxima"), max_digits=12, decimal_places=2, null=True, blank=True
    )
    estimated_hours = models.DecimalField(
        _("horas estimadas"), max_digits=5, decimal_places=1, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("servicio")
        verbose_name_plural = _("servicios")
        ordering = ["category__sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "slug"], name="unique_service_slug_per_category"
            )
        ]

    def __str__(self) -> str:
        return f"{self.category.name} · {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
