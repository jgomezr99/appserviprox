import re

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied

from .models import PlatformSettings


def require_feature(name: str, message: str) -> None:
    """Rechaza la operación si el administrador desactivó la función."""
    if not PlatformSettings.load()["features"].get(name, True):
        raise PermissionDenied(message)


def app_param(key: str, default=True):
    return PlatformSettings.load()["sections"].get("app_params", {}).get(key, default)


def validate_platform_password(value: str) -> None:
    """Aplica la política de contraseñas definida en Configuración > Seguridad."""
    cfg = PlatformSettings.load()["sections"].get("security", {})
    if not cfg.get("pw_enforce", True):
        return
    errors = []
    min_len = int(cfg.get("pw_min", 8) or 8)
    if len(value) < min_len:
        errors.append(f"La contraseña debe tener al menos {min_len} caracteres.")
    if cfg.get("pw_upper", True) and not re.search(r"[A-Z]", value):
        errors.append("Debe incluir una letra mayúscula.")
    if cfg.get("pw_lower", True) and not re.search(r"[a-z]", value):
        errors.append("Debe incluir una letra minúscula.")
    if cfg.get("pw_number", True) and not re.search(r"\d", value):
        errors.append("Debe incluir un número.")
    if cfg.get("pw_special", True) and not re.search(r"[^\w\s]", value):
        errors.append("Debe incluir un carácter especial (!@#$%).")
    if errors:
        raise DjangoValidationError(errors)


def _first_int(text, default: int) -> int:
    match = re.search(r"\d+", str(text))
    return int(match.group()) if match else default


def lockout_policy() -> tuple[int, int]:
    """(intentos máximos, minutos de bloqueo)"""
    cfg = PlatformSettings.load()["sections"].get("security", {})
    attempts = _first_int(cfg.get("max_attempts", "5"), 5)
    lock = str(cfg.get("lock", "30 minutos"))
    minutes = _first_int(lock, 30)
    if "hora" in lock:
        minutes *= 60
    return attempts, minutes


def lock_key(identity: str) -> str:
    return f"login_lock:{identity.lower()}"


def fail_key(identity: str) -> str:
    return f"login_fail:{identity.lower()}"


def register_failed_login(identity: str) -> None:
    attempts, minutes = lockout_policy()
    count = cache.get(fail_key(identity), 0) + 1
    if count >= attempts:
        cache.set(lock_key(identity), True, minutes * 60)
        cache.delete(fail_key(identity))
    else:
        cache.set(fail_key(identity), count, minutes * 60)
