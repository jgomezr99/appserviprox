import hashlib
import hmac
from urllib.parse import urlencode

from django.conf import settings

CHECKOUT_URL = "https://checkout.wompi.co/p/"


def wompi_keys(test_mode: bool = False) -> dict:
    if test_mode:
        return {
            "public": settings.WOMPI_TEST_PUBLIC_KEY,
            "integrity": settings.WOMPI_TEST_INTEGRITY_SECRET,
        }
    return {"public": settings.WOMPI_PUBLIC_KEY, "integrity": settings.WOMPI_INTEGRITY_SECRET}


def wompi_ready(test_mode: bool = False) -> bool:
    keys = wompi_keys(test_mode)
    # El modo de prueba nunca debe usar llaves de producción.
    if test_mode and not keys["public"].startswith("pub_test_"):
        return False
    return bool(keys["public"] and keys["integrity"])


def integrity_signature(reference: str, amount_in_cents: int, currency: str, test_mode: bool = False) -> str:
    raw = f"{reference}{amount_in_cents}{currency}{wompi_keys(test_mode)['integrity']}"
    return hashlib.sha256(raw.encode()).hexdigest()


def build_checkout_url(
    reference: str, amount_in_cents: int, currency: str, redirect_url: str = "", test_mode: bool = False
) -> str:
    params = {
        "public-key": wompi_keys(test_mode)["public"],
        "currency": currency,
        "amount-in-cents": amount_in_cents,
        "reference": reference,
        "signature:integrity": integrity_signature(reference, amount_in_cents, currency, test_mode),
    }
    if redirect_url:
        params["redirect-url"] = redirect_url
    return f"{CHECKOUT_URL}?{urlencode(params)}"


def _event_checksum_matches(body: dict, secret: str) -> bool:
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


def verify_event(body: dict) -> bool:
    """Valida el checksum de un evento de Wompi con el secreto de producción o de prueba."""
    try:
        return any(
            secret and _event_checksum_matches(body, secret)
            for secret in (settings.WOMPI_EVENTS_SECRET, settings.WOMPI_TEST_EVENTS_SECRET)
        )
    except (KeyError, TypeError, AttributeError):
        return False
