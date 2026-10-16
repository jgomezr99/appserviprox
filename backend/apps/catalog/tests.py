from pathlib import Path
from unittest.mock import patch

from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import AdminAuditLog, User, UserRole
from apps.diagnosis.models import DiagnosticSession
from apps.professionals.models import ProfessionalProfile, ProfessionalService

from .models import Service, ServiceCategory


@override_settings(SECURE_SSL_REDIRECT=False)
class AdminCatalogTests(TestCase):
    root = "/api/v1/admin/catalog/"

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="catalog-admin", email="catalog-admin@example.com",
            password="Catalog-test-2026!", role=UserRole.STAFF,
        )
        cls.customer = User.objects.create_user(
            username="catalog-client", email="catalog-client@example.com", role=UserRole.CLIENT,
        )
        cls.professional = User.objects.create_user(
            username="catalog-pro", email="catalog-pro@example.com", role=UserRole.PROFESSIONAL,
        )
        cls.category = ServiceCategory.objects.create(name="Plomería", keywords=["agua"])
        cls.service = Service.objects.create(
            category=cls.category, name="Reparación de tuberías", keywords=["fuga de agua"],
            price_min="10000.00", price_max="50000.00",
        )

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    @staticmethod
    def results(response):
        payload = response.json()
        return payload.get("results", []) if isinstance(payload, dict) else payload

    def test_admin_access_with_real_jwt(self):
        api = APIClient()
        token = RefreshToken.for_user(self.admin)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        response = api.get(self.root + "categories/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.results(response)[0]["keywords"], ["agua"])

    def test_admin_overview_serializes_sqlite_database_path_as_json(self):
        # SQLite usa pathlib.Path en settings; antes fallaba al renderizar JSON.
        database_path = Path("/app/db.sqlite3")
        with patch.dict(connection.settings_dict, {"NAME": database_path}):
            response = self.api.get("/api/v1/admin/overview/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["database"]["database_name"], str(database_path))

    def test_catalog_and_existing_admin_endpoints_require_administrator(self):
        paths = [self.root + "categories/", self.root + "services/", "/api/v1/admin/overview/", "/api/v1/admin/users/"]
        for user, expected in [(None, 401), (self.customer, 403), (self.professional, 403)]:
            self.api.force_authenticate(user)
            for path in paths:
                with self.subTest(user=user, path=path):
                    self.assertEqual(self.api.get(path).status_code, expected)
            self.assertEqual(self.api.post(self.root + "suggestions/preview/", {"description": "fuga de agua"}, format="json").status_code, expected)
            self.assertEqual(self.api.post("/api/v1/admin/action/", {}, format="json").status_code, expected)
        self.assertFalse(AdminAuditLog.objects.exists())

    def test_non_admin_cannot_mutate_catalog(self):
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.api.post(self.root + "categories/", {"name": "Intrusión"}, format="json").status_code, 403)
        self.assertEqual(self.api.patch(self.root + f"services/{self.service.pk}/", {"keywords": ["otro"]}, format="json").status_code, 403)
        self.assertEqual(self.api.delete(self.root + f"services/{self.service.pk}/").status_code, 403)
        self.service.refresh_from_db()
        self.assertEqual(self.service.keywords, ["fuga de agua"])

    def test_superuser_is_allowed_and_inactive_staff_is_rejected(self):
        root_user = User.objects.create_user(
            username="catalog-root", email="catalog-root@example.com", is_superuser=True,
        )
        self.api.force_authenticate(root_user)
        self.assertEqual(self.api.get(self.root + "categories/").status_code, 200)
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.get(self.root + "categories/").status_code, 403)

    def test_category_create_edit_delete_and_real_admin_audit(self):
        response = self.api.post(self.root + "categories/", {
            "name": "Electricidad", "description": "Instalaciones", "icon_key": "flash",
            "keywords": [" CÁBLE   suelto ", "cable suelto", "corto circuito"],
            "sort_order": 3, "is_active": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        category_id, slug = response.data["id"], response.data["slug"]
        self.assertEqual(response.data["keywords"], ["CÁBLE suelto", "corto circuito"])
        log = AdminAuditLog.objects.get()
        self.assertEqual(log.admin_user, self.admin)
        response = self.api.patch(self.root + f"categories/{category_id}/", {"name": "Instalación eléctrica", "keywords": ["sin luz"]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], slug)
        self.assertEqual(response.data["keywords"], ["sin luz"])
        self.assertEqual(self.api.delete(self.root + f"categories/{category_id}/").status_code, 204)
        self.assertFalse(ServiceCategory.objects.filter(pk=category_id).exists())
        self.assertEqual(AdminAuditLog.objects.count(), 3)

    def test_duplicate_category_name_is_validation_error_without_audit(self):
        response = self.api.post(self.root + "categories/", {"name": self.category.name}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(AdminAuditLog.objects.exists())

    def test_slug_collisions_and_service_identifiers_survive_renaming(self):
        first = self.api.post(self.root + "categories/", {"name": "Gas natural"}, format="json")
        second = self.api.post(self.root + "categories/", {"name": "Gas-natural"}, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertNotEqual(first.data["slug"], second.data["slug"])
        first = self.api.post(self.root + "services/", {"category": self.category.pk, "name": "Reparar grifo"}, format="json")
        second = self.api.post(self.root + "services/", {"category": self.category.pk, "name": "Reparar grifo"}, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(first.data["slug"], second.data["slug"])
        changed = self.api.patch(self.root + f"services/{first.data['id']}/", {"name": "Reparación de llave", "keywords": ["llave goteando"]}, format="json")
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.data["slug"], first.data["slug"])
        self.assertEqual(changed.data["keywords"], ["llave goteando"])

    def test_keywords_reject_non_text_blank_oversized_or_non_list_input(self):
        for keywords in [[None], [3], [True], ["   "], ["x" * 121], [str(i) for i in range(51)], "fuga", {}]:
            with self.subTest(keywords=keywords):
                response = self.api.patch(self.root + f"services/{self.service.pk}/", {"keywords": keywords}, format="json")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(AdminAuditLog.objects.exists())

    def test_service_validates_prices_and_category_on_partial_updates(self):
        for payload in [{"price_min": "60000.00"}, {"price_max": "1.00"}, {"price_min": "-1"}, {"estimated_hours": "-1"}, {"category": 999999}]:
            with self.subTest(payload=payload):
                response = self.api.patch(self.root + f"services/{self.service.pk}/", payload, format="json")
                self.assertEqual(response.status_code, 400, response.data)
        response = self.api.patch(self.root + f"services/{self.service.pk}/", {"price_min": None, "price_max": None}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["price_min"])

    def test_service_move_rejects_slug_collision(self):
        other_category = ServiceCategory.objects.create(name="Otra categoría")
        Service.objects.create(category=other_category, name="Otra reparación", slug=self.service.slug)
        response = self.api.patch(self.root + f"services/{self.service.pk}/", {"category": other_category.pk}, format="json")
        self.assertEqual(response.status_code, 400)
        self.service.refresh_from_db()
        self.assertEqual(self.service.category_id, self.category.pk)

    def test_category_with_services_cannot_be_deleted(self):
        response = self.api.delete(self.root + f"categories/{self.category.pk}/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Service.objects.filter(pk=self.service.pk).exists())
        self.assertFalse(AdminAuditLog.objects.exists())

    def test_professional_offer_prevents_cascading_service_delete(self):
        profile = ProfessionalProfile.objects.create(user=self.professional, display_name="Profesional")
        offer = ProfessionalService.objects.create(profile=profile, service=self.service)
        response = self.api.delete(self.root + f"services/{self.service.pk}/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(ProfessionalService.objects.filter(pk=offer.pk).exists())

    def test_diagnostic_history_prevents_service_and_category_delete(self):
        category = ServiceCategory.objects.create(name="Categoría histórica")
        session = DiagnosticSession.objects.create(
            description="Consulta anterior", suggested_category=category, suggested_service=self.service,
        )
        self.assertEqual(self.api.delete(self.root + f"categories/{category.pk}/").status_code, 409)
        self.assertEqual(self.api.delete(self.root + f"services/{self.service.pk}/").status_code, 409)
        session.refresh_from_db()
        self.assertEqual(session.suggested_category_id, category.pk)
        self.assertEqual(session.suggested_service_id, self.service.pk)

    def test_unreferenced_service_can_be_deleted(self):
        self.assertEqual(self.api.delete(self.root + f"services/{self.service.pk}/").status_code, 204)
        self.assertFalse(Service.objects.filter(pk=self.service.pk).exists())

    def test_deactivation_hides_service_publicly_but_keeps_admin_and_history(self):
        session = DiagnosticSession.objects.create(description="Consulta anterior", suggested_service=self.service)
        response = self.api.patch(self.root + f"services/{self.service.pk}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.results(self.api.get("/api/v1/services/")), [])
        category_detail = self.api.get(f"/api/v1/categories/{self.category.slug}/")
        self.assertEqual(category_detail.data["services"], [])
        self.assertEqual(len(self.results(self.api.get(self.root + "services/"))), 1)
        session.refresh_from_db()
        self.assertEqual(session.suggested_service_id, self.service.pk)
        preview = self.api.post(self.root + "suggestions/preview/", {"description": "fuga de agua"}, format="json")
        self.assertEqual(preview.data["service_ranking"], [])

    def test_deactivating_category_hides_its_services_from_new_searches(self):
        self.assertEqual(self.api.patch(self.root + f"categories/{self.category.pk}/", {"is_active": False}, format="json").status_code, 200)
        self.assertEqual(self.results(self.api.get("/api/v1/categories/")), [])
        self.assertEqual(self.results(self.api.get("/api/v1/services/")), [])
        response = self.api.post(self.root + "suggestions/preview/", {"description": "fuga de agua"}, format="json")
        self.assertIsNone(response.data["suggested_category"])
        self.assertIsNone(response.data["suggested_service"])
        self.assertFalse(self.results(self.api.get(self.root + "services/"))[0]["category_active"])

    def test_preview_uses_saved_keywords_and_same_engine_as_customer_without_creating_session(self):
        description = "El lavaplatos está goteando"
        self.api.patch(self.root + f"services/{self.service.pk}/", {"keywords": ["lavaplatos goteando", "lavaplatos"]}, format="json")
        response = self.api.post(self.root + "suggestions/preview/", {"description": description}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["suggested_service"]["id"], self.service.pk)
        self.assertIn("lavaplatos", response.data["service_ranking"][0]["matched_terms"])
        self.assertFalse(DiagnosticSession.objects.exists())
        self.api.force_authenticate(self.customer)
        customer_response = self.api.post("/api/v1/diagnosis/sessions/", {"description": description}, format="json")
        self.assertEqual(customer_response.status_code, 201, customer_response.data)
        for key in ["suggested_category", "suggested_service", "confidence", "rationale", "ranking", "service_ranking"]:
            self.assertEqual(response.data[key], customer_response.data[key], key)
        self.assertEqual(DiagnosticSession.objects.count(), 1)

    def test_preview_validates_description_and_handles_no_match(self):
        for description in ["", "1234", "x" * 1001]:
            self.assertEqual(self.api.post(self.root + "suggestions/preview/", {"description": description}, format="json").status_code, 400)
        response = self.api.post(self.root + "suggestions/preview/", {"description": "xyzzy qwerty"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["suggested_category"])
        self.assertEqual(response.data["service_ranking"], [])
        self.assertFalse(DiagnosticSession.objects.exists())
