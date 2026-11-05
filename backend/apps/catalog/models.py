from django.conf import settings
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
    keywords = models.JSONField(
        _("palabras clave"),
        default=list,
        blank=True,
        help_text="Terminos y sinonimos para encontrar este servicio en la busqueda orientada.",
    )
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


class StoreProduct(models.Model):
    """Producto publicado por un usuario en la tienda de herramientas y suministros."""

    class Category(models.TextChoices):
        TOOLS = "Herramientas", "Herramientas"
        SAFETY = "Seguridad y EPP", "Seguridad y EPP"
        MATERIALS = "Materiales", "Materiales"
        PARTS = "Repuestos", "Repuestos"
        EQUIPMENT = "Equipos", "Equipos"
        TECHNOLOGY = "Tecnología", "Tecnología"
        FURNITURE = "Muebles", "Muebles"
        CLOTHING = "Ropa", "Ropa"
        APPLIANCES = "Electrodomésticos", "Electrodomésticos"
        HOME = "Hogar y decoración", "Hogar y decoración"
        OTHER = "Otros", "Otros"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="store_products",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    title = models.CharField(_("titulo"), max_length=140)
    category = models.CharField(_("categoria"), max_length=40, choices=Category.choices)
    price = models.PositiveIntegerField(_("precio (COP)"))
    description = models.TextField(_("descripcion"), blank=True)
    seller_name = models.CharField(_("vendedor"), max_length=140)
    seller_role = models.CharField(_("rol del vendedor"), max_length=40)
    phone = models.CharField(_("telefono"), max_length=40, blank=True)
    city = models.CharField(_("ciudad"), max_length=80, blank=True)
    image = models.ImageField(_("imagen"), upload_to="store-products/%Y/%m/", blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("producto de tienda")
        verbose_name_plural = _("productos de tienda")
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return self.title
