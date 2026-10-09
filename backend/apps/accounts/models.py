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
    document_id = models.CharField(_("documento de identidad"), max_length=50, blank=True, default="")
    address = models.CharField(_("direccion principal"), max_length=255, blank=True, default="")
    avatar_url = models.URLField(_("url de avatar"), blank=True, default="")
    is_identity_verified = models.BooleanField(_("identidad verificada"), default=False)

    onboarding_completed = models.BooleanField(_("onboarding completado"), default=False)
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


class PasswordResetCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_codes")
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ClientProfile(models.Model):
    """Perfil exclusivo para clientes en la base de datos."""

    user = models.OneToOneField(
        User, related_name="client_profile", on_delete=models.CASCADE
    )
    emergency_contact_name = models.CharField(
        _("contacto de emergencia"), max_length=120, blank=True, default=""
    )
    emergency_contact_phone = models.CharField(
        _("telefono de emergencia"), max_length=30, blank=True, default=""
    )
    preferred_payment_method = models.CharField(
        _("metodo de pago preferido"), max_length=50, blank=True, default="cash"
    )
    service_notes = models.TextField(
        _("preferencias o notas de servicio"), blank=True, default=""
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("perfil de cliente")
        verbose_name_plural = _("perfiles de clientes")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Cliente: {self.user.get_full_name() or self.user.email}"


class ClientManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(role=UserRole.CLIENT)


class ClientUser(User):
    """Vista de base de datos dedicada a clientes."""
    objects = ClientManager()

    class Meta:
        proxy = True
        verbose_name = _("cliente")
        verbose_name_plural = _("clientes")


class ProfessionalManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(role=UserRole.PROFESSIONAL)


class ProfessionalUser(User):
    """Vista de base de datos dedicada a usuarios profesionales."""
    objects = ProfessionalManager()

    class Meta:
        proxy = True
        verbose_name = _("profesional (cuenta)")
        verbose_name_plural = _("profesionales (cuentas)")


class AdminAuditLog(models.Model):
    """Registro de auditoría para trazabilidad de acciones administrativas."""

    admin_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs_authored",
    )
    admin_name = models.CharField(_("nombre del administrador"), max_length=150, default="Superadministrador")
    action = models.CharField(_("acción realizada"), max_length=150)
    target = models.CharField(_("elemento o usuario afectado"), max_length=255)
    reason = models.TextField(_("motivo o justificación"), blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = _("registro de auditoría")
        verbose_name_plural = _("registros de auditoría")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.admin_name}: {self.action} -> {self.target}"

