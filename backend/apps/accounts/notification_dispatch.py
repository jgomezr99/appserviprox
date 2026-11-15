"""Envío de las notificaciones de la plataforma por correo, según Configuración > Notificaciones."""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification, PlatformSettings

logger = logging.getLogger(__name__)


def email_notifications_enabled(data: dict) -> bool:
    return bool(data["features"].get("email_notifications", True)) \
        and bool(data["sections"].get("notifications", {}).get("email_enabled", True))


def send_notification_email(notification_id: int) -> bool:
    notification = Notification.objects.select_related("user").filter(pk=notification_id).first()
    user = notification.user if notification else None
    if not user or not user.email or not user.is_active:
        return False
    if not email_notifications_enabled(PlatformSettings.load()):
        return False
    try:
        send_mail(
            subject=notification.title,
            message=f"Hola {user.first_name or user.username},\n\n{notification.text}\n\nEquipo Serviprox",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("No se pudo enviar el correo de la notificación %s", notification_id)
        return False
    return True


@receiver(post_save, sender=Notification, dispatch_uid="serviprox_notification_email")
def _email_new_notification(sender, instance, created, **kwargs):
    if created and instance.user_id:
        transaction.on_commit(lambda: send_notification_email(instance.pk))
