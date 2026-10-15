import hashlib
import hmac
from urllib.parse import urlencode

from django.conf import settings

CHECKOUT_URL = "https://checkout.wompi.co/p/"


def wompi_ready() -> bool:
    return bool(settings.WOMPI_PUBLIC_KEY and settings.WOMPI_INTEGRITY_SECRET)


def integrity_signature(reference: str, amount_in_cents: int, currency: str) -> str:
    raw = f"{reference}{amount_in_cents}{currency}{settings.WOMPI_INTEGRITY_SECRET}"
    return hashlib.sha256(raw.encode()).hexdigest()


def build_checkout_url(reference: str, amount_in_cents: int, currency: str, redirect_url: str = "") -> str:
    params = {
        "public-key": settings.WOMPI_PUBLIC_KEY,
        "currency": currency,
        "amount-in-cents": amount_in_cents,
        "reference": reference,
        "signature:integrity": integrity_signature(reference, amount_in_cents, currency),
    }
    if redirect_url:
        params["redirect-url"] = redirect_url
    return f"{CHECKOUT_URL}?{urlencode(params)}"


def verify_event(body: dict) -> bool:
    """Valida el checksum de un evento de Wompi con el secreto de eventos."""
    secret = settings.WOMPI_EVENTS_SECRET
    if not secret:
        return False
    try:
        signature = body["signature"]
        values = []
        for prop in signature["properties"]:
            node = body["data"]
            for part in prop.split("."):
                node = node[part]
            values.append(str(node))
        raw = "".join(values) + str(body["timestamp"]) + secret
        expected = hashlib.sha256(raw.encode()).hexdigest()
        return hmac.compare_digest(expected, str(signature["checksum"]).lower())
    except (KeyError, TypeError, AttributeError):
        return False
