import hashlib
from urllib.parse import parse_qs, urlparse

from django.test import SimpleTestCase, override_settings

from .wompi import build_checkout_url, verify_event, wompi_ready

PROD_KEYS = {
    "WOMPI_PUBLIC_KEY": "pub_prod_public",
    "WOMPI_INTEGRITY_SECRET": "prod_integrity",
    "WOMPI_EVENTS_SECRET": "prod_events",
}
TEST_KEYS = {
    "WOMPI_TEST_PUBLIC_KEY": "pub_test_public",
    "WOMPI_TEST_INTEGRITY_SECRET": "test_integrity",
    "WOMPI_TEST_EVENTS_SECRET": "test_events",
}


def signed_event(secret: str) -> dict:
    data = {"transaction": {"id": "1", "status": "APPROVED", "amount_in_cents": 150000}}
    timestamp = 1700000000
    raw = "1" + "APPROVED" + "150000" + str(timestamp) + secret
    return {
        "event": "transaction.updated",
        "data": data,
        "timestamp": timestamp,
        "signature": {
            "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
            "checksum": hashlib.sha256(raw.encode()).hexdigest(),
        },
    }


@override_settings(**PROD_KEYS, **TEST_KEYS)
class WompiTestModeTests(SimpleTestCase):
    def test_test_mode_uses_sandbox_keys_and_signature(self):
        url = build_checkout_url("REF-1", 150000, "COP", test_mode=True)
        query = parse_qs(urlparse(url).query)
        self.assertEqual(query["public-key"], ["pub_test_public"])
        expected = hashlib.sha256(b"REF-1150000COPtest_integrity").hexdigest()
        self.assertEqual(query["signature:integrity"], [expected])

    def test_production_mode_keeps_production_keys(self):
        url = build_checkout_url("REF-2", 150000, "COP", test_mode=False)
        self.assertEqual(parse_qs(urlparse(url).query)["public-key"], ["pub_prod_public"])

    @override_settings(WOMPI_TEST_PUBLIC_KEY="pub_prod_leaked")
    def test_test_mode_refuses_production_public_key(self):
        self.assertFalse(wompi_ready(test_mode=True))

    def test_test_mode_ready_only_with_sandbox_credentials(self):
        self.assertTrue(wompi_ready(test_mode=True))

    @override_settings(WOMPI_TEST_INTEGRITY_SECRET="")
    def test_test_mode_not_ready_without_integrity_secret(self):
        self.assertFalse(wompi_ready(test_mode=True))

    def test_webhook_accepts_test_events_secret(self):
        self.assertTrue(verify_event(signed_event("test_events")))

    def test_webhook_accepts_production_events_secret(self):
        self.assertTrue(verify_event(signed_event("prod_events")))

    def test_webhook_rejects_unknown_secret_and_malformed_body(self):
        self.assertFalse(verify_event(signed_event("otro_secreto")))
        self.assertFalse(verify_event({"signature": {}}))
