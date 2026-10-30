"""Checks de seguridad y contratos de despliegue sobre BD de prueba."""
from unittest.mock import patch
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, override_settings
from config.settings import parse_postgres_database_url


class DatabaseUrlTests(SimpleTestCase):
    def test_parses_managed_postgres_url(self):
        credentials, port, sslmode = parse_postgres_database_url(
            "postgresql://user%40example:pass%2Fword@db.example.com:6432/serviprox?sslmode=require"
        )

        self.assertEqual(
            credentials,
            {
                "POSTGRES_DB": "serviprox",
                "POSTGRES_USER": "user@example",
                "POSTGRES_PASSWORD": "pass/word",
                "POSTGRES_HOST": "db.example.com",
            },
        )
        self.assertEqual(port, "6432")
        self.assertEqual(sslmode, "require")

    def test_rejects_non_postgres_database_url(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "DATABASE_URL debe empezar por postgres:// o postgresql://.",
        ):
            parse_postgres_database_url("mysql://user:password@db.example.com/serviprox")


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
