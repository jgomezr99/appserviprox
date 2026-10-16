"""Checks de seguridad y contratos de despliegue sobre BD de prueba."""
from unittest.mock import patch
from django.test import TestCase, override_settings


@override_settings(
    DEBUG=False,
    ALLOWED_HOSTS=["testserver"],
    SECURE_SSL_REDIRECT=True,
    SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    CORS_ALLOW_ALL_ORIGINS=False,
    CORS_ALLOWED_ORIGINS=["https://serviproxweb.netlify.app", "https://localhost", "capacitor://localhost"],
    CORS_ALLOWED_ORIGIN_REGEXES=[],
)
class DeploymentTests(TestCase):
    def test_health_has_no_engine_or_credentials(self):
        response = self.client.get("/api/v1/health/", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "connected"})

    def test_health_failure_is_generic(self):
        with patch("config.urls.logger.exception"), patch("config.urls.connection.ensure_connection", side_effect=RuntimeError("private-value")):
            response = self.client.get("/health/", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-value", response.content.decode())

    def test_http_redirects_to_https(self):
        self.assertEqual(self.client.get("/api/v1/health/").status_code, 301)

    def test_cors_allows_only_exact_origins(self):
        for origin in ["https://serviproxweb.netlify.app", "https://localhost", "capacitor://localhost"]:
            response = self.client.options("/api/v1/auth/token/", HTTP_ORIGIN=origin,
                HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST", HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type")
            self.assertEqual(response["Access-Control-Allow-Origin"], origin)
        response = self.client.options("/api/v1/auth/token/", HTTP_ORIGIN="https://evil.example.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST")
        self.assertNotIn("Access-Control-Allow-Origin", response)

    def test_404_is_generic_json(self):
        response = self.client.get("/api/v1/missing-resource/", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Recurso no encontrado."})
