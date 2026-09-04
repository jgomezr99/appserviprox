from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserRole(models.TextChoices):
    CLIENT = "client", _("Cliente")
    PROFESSIONAL = "professional", _("Profesional")
    STAFF = "staff", _("Equipo Serviprox")


class User(AbstractUser):
    """Usuario unico para clientes y profesionales; el rol decide el perfil."""

    email = models.EmailField(_("correo"), unique=True)
    role = models.CharField(
        _("rol"), max_length=20, choices=UserRole.choices, default=UserRole.CLIENT
    )
    phone = models.CharField(_("telefono"), max_length=30, blank=True)
    city = models.CharField(_("ciudad"), max_length=80, blank=True)
    is_identity_verified = models.BooleanField(_("identidad verificada"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = _("usuario")
        verbose_name_plural = _("usuarios")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.get_full_name() or self.email

    @property
    def initials(self) -> str:
        """Iniciales que el prototipo muestra en el avatar (ej. 'CR')."""
        parts = [p for p in (self.first_name, self.last_name) if p]
        if not parts:
            return self.email[:2].upper()
        return "".join(p[0] for p in parts[:2]).upper()

    @property
    def is_professional(self) -> bool:
        return self.role == UserRole.PROFESSIONAL
