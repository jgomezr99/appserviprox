import hashlib
import hmac
import json
import urllib.error
import urllib.request
from urllib.parse import quote, urlencode

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


# Método del panel administrativo -> código de método de pago en Wompi.
WOMPI_METHOD_CODES = {
    "card": "CARD",
    "pse": "PSE",
    "transfer": "BANCOLOMBIA_TRANSFER",
    "wallet": "NEQUI",
}


def wompi_lookup() -> dict:
    """Una sola consulta a Wompi: llaves, modo y métodos de pago habilitados del comercio.

    Nunca devuelve llaves ni secretos.
    """
    checks: list[dict] = []

    def add(name: str, ok: bool, detail: str) -> bool:
        checks.append({"name": name, "ok": ok, "detail": detail})
        return ok

    use_test = not settings.WOMPI_PUBLIC_KEY and bool(settings.WOMPI_TEST_PUBLIC_KEY)
    prefix = "WOMPI_TEST_" if use_test else "WOMPI_"
    public_key = getattr(settings, f"{prefix}PUBLIC_KEY")
    secrets_present = {
        "Llave pública": public_key,
        "Llave privada": getattr(settings, f"{prefix}PRIVATE_KEY"),
        "Secreto de eventos": getattr(settings, f"{prefix}EVENTS_SECRET"),
        "Secreto de integridad": getattr(settings, f"{prefix}INTEGRITY_SECRET"),
    }
    missing = [label for label, value in secrets_present.items() if not value]
    add(
        "Llaves configuradas en el servidor",
        not missing,
        "Completas." if not missing else "Faltan: " + ", ".join(missing) + ".",
    )
    result = {"checks": checks, "mode": "", "merchant": None, "accepted": [], "configured": bool(public_key)}
    if not public_key:
        return result

    expected = "pub_test_" if use_test else "pub_prod_"
    result["mode"] = "Pruebas (sandbox)" if use_test else "Producción"
    add(
        "Modo de la integración",
        public_key.startswith(expected),
        result["mode"] if public_key.startswith(expected) else "La llave pública no corresponde al modo configurado.",
    )

    host = "sandbox.wompi.co" if public_key.startswith("pub_test_") else "production.wompi.co"
    try:
        with urllib.request.urlopen(  # noqa: S310 (host fijo)
            f"https://{host}/v1/merchants/{quote(public_key, safe='')}", timeout=10
        ) as response:
            merchant = (json.load(response) or {}).get("data") or {}
    except urllib.error.HTTPError as exc:
        add("Conexión con Wompi", False, "Wompi rechazó la llave pública." if exc.code in (404, 422) else f"Wompi respondió con error {exc.code}.")
        return result
    except (urllib.error.URLError, TimeoutError, ValueError):
        add("Conexión con Wompi", False, "No se pudo contactar a Wompi. Revisa la conexión del servidor.")
        return result

    add("Conexión con Wompi", True, f"Comercio: {merchant.get('name') or merchant.get('legal_name') or 'verificado'}.")
    result["merchant"] = merchant
    result["accepted"] = merchant.get("accepted_payment_methods") or []
    return result


def wompi_method_check(lookup: dict, method: str) -> dict:
    """Estado de un método según la consulta a Wompi: {ok, detail}."""
    failed = next((c for c in lookup["checks"] if not c["ok"]), None)
    if failed:
        return {"ok": False, "detail": f"{failed['name']}: {failed['detail']}"}
    code = WOMPI_METHOD_CODES.get(method, "")
    if code and code not in lookup["accepted"]:
        return {"ok": False, "detail": f"{code} no está habilitado en tu cuenta de Wompi."}
    return {"ok": True, "detail": "Conectado y habilitado en Wompi."}


def wompi_connection_report(method: str) -> dict:
    """Comprueba la conexión real con Wompi y si el comercio acepta el método indicado."""
    lookup = wompi_lookup()
    checks = list(lookup["checks"])
    if lookup["merchant"] is not None:
        code = WOMPI_METHOD_CODES.get(method, "")
        if code:
            ok = code in lookup["accepted"]
            checks.append(
                {
                    "name": "Método habilitado en el comercio",
                    "ok": ok,
                    "detail": f"{code} habilitado." if ok else f"{code} no está habilitado en tu cuenta de Wompi.",
                }
            )
    if not lookup["configured"]:
        return {"ok": False, "mode": "", "checks": checks, "detail": "Wompi no está configurado en el servidor."}
    ok = all(check["ok"] for check in checks)
    return {"ok": ok, "mode": lookup["mode"], "checks": checks, "detail": "Conexión correcta con Wompi." if ok else "La conexión tiene problemas."}
