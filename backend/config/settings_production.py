"""Perfil exclusivo de la VM."""
from urllib.parse import urlsplit
from django.core.exceptions import ImproperlyConfigured
from .settings import *  # noqa: F403

if DEBUG:
    raise ImproperlyConfigured("Produccion requiere DJANGO_DEBUG=False.")
if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith("django-insecure-"):
    raise ImproperlyConfigured("DJANGO_SECRET_KEY debe ser aleatoria y de al menos 50 caracteres.")
if DATABASE_ENGINE != "postgres":
    raise ImproperlyConfigured("Produccion requiere SERVIPROX_DATABASE=postgres.")
if MEDIA_STORAGE != "filesystem":
    raise ImproperlyConfigured("La VM usa filesystem y volumen persistente.")
if not os.getenv("DJANGO_ALLOWED_HOSTS") or any(
    host == "*" or host.startswith(".") or "/" in host for host in ALLOWED_HOSTS
):
    raise ImproperlyConfigured("Configura DJANGO_ALLOWED_HOSTS con hosts explicitos.")
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("Configura origen HTTPS real de Netlify en CORS_ALLOWED_ORIGINS.")
for origin in CORS_ALLOWED_ORIGINS:
    parsed = urlsplit(origin)
    if origin == "capacitor://localhost":
        continue
    if parsed.scheme != "https" or not parsed.netloc or "*" in origin or parsed.path:
        raise ImproperlyConfigured("CORS requiere origenes HTTPS exactos o capacitor://localhost.")

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGIN_REGEXES = []
CORS_ALLOW_CREDENTIALS = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = env_int("DJANGO_SECURE_HSTS_SECONDS", 3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "EXCEPTION_HANDLER": "config.errors.api_exception_handler",
}
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_TIMEOUT = 15
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"production": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "production"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django": {"handlers": ["console"], "level": "WARNING", "propagate": False}},
}
