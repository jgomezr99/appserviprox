from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.professionals.models import ProfessionalProfile, ProfessionalService


class ProfessionalServiceMatchingTests(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.plumbing = ServiceCategory.objects.create(
            name="Plomeria",
            slug="plomeria",
            is_active=True,
        )
        self.electricity = ServiceCategory.objects.create(
            name="Electricidad",
            slug="electricidad",
            is_active=True,
        )
        self.leak_repair = Service.objects.create(
            category=self.plumbing,
            name="Reparacion de fuga",
            slug="reparacion-de-fuga",
            is_active=True,
        )
        self.faucet_install = Service.objects.create(
            category=self.plumbing,
            name="Instalacion de griferia",
            slug="instalacion-de-griferia",
            is_active=True,
        )
        self.outlet_install = Service.objects.create(
            category=self.electricity,
            name="Instalacion de tomacorriente",
            slug="instalacion-de-tomacorriente",
            is_active=True,
        )
        self.pro_user = User.objects.create_user(
            email="pro@example.com",
            username="pro",
            password="secret",
            role=UserRole.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.pro_user,
            display_name="Pro Plomeria",
            headline="Fugas residenciales",
            city="Bogota",
            is_active=True,
        )
        ProfessionalService.objects.create(
            profile=self.profile,
            service=self.leak_repair,
            price_min=90000,
            price_max=180000,
            observations="Cobro visita y materiales aparte.",
        )
        self.budget_user = User.objects.create_user(
            email="budget@example.com",
            username="budget",
            password="secret",
            role=UserRole.PROFESSIONAL,
        )
        self.budget_profile = ProfessionalProfile.objects.create(
            user=self.budget_user,
            display_name="Pro Economico",
            headline="Atencion economica",
            city="Bogota",
            is_active=True,
        )
        ProfessionalService.objects.create(
            profile=self.budget_profile,
            service=self.leak_repair,
            price_min=40000,
            price_max=70000,
        )
        self.open_price_user = User.objects.create_user(
            email="open-price@example.com",
            username="open-price",
            password="secret",
            role=UserRole.PROFESSIONAL,
        )
        self.open_price_profile = ProfessionalProfile.objects.create(
            user=self.open_price_user,
            display_name="Pro Sin Tarifa",
            headline="Pendiente por acordar",
            city="Bogota",
            is_active=True,
        )
        ProfessionalService.objects.create(
            profile=self.open_price_profile,
            service=self.leak_repair,
        )

    def results(self, response):
        payload = response.json()
        return payload["results"] if isinstance(payload, dict) and "results" in payload else payload

    def test_services_can_be_filtered_by_category(self):
        response = self.client_api.get(f"/api/v1/services/?category={self.plumbing.id}")

        self.assertEqual(response.status_code, 200)
        names = {item["name"] for item in self.results(response)}
        self.assertEqual(names, {"Reparacion de fuga", "Instalacion de griferia"})

    def test_professionals_filter_by_exact_service(self):
        response = self.client_api.get(f"/api/v1/professionals/?service={self.leak_repair.id}")

        self.assertEqual(response.status_code, 200)
        results = self.results(response)
        names = {item["display_name"] for item in results}
        self.assertEqual(names, {"Pro Plomeria", "Pro Economico", "Pro Sin Tarifa"})

    def test_professionals_do_not_match_unoffered_service_in_same_category(self):
        response = self.client_api.get(f"/api/v1/professionals/?service={self.faucet_install.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.results(response), [])

    def test_category_filter_remains_available(self):
        response = self.client_api.get("/api/v1/professionals/?category=plomeria")

        self.assertEqual(response.status_code, 200)
        results = self.results(response)
        names = {item["display_name"] for item in results}
        self.assertEqual(names, {"Pro Plomeria", "Pro Economico", "Pro Sin Tarifa"})

    def test_professional_service_points_to_service(self):
        professional_service = self.profile.services.get()

        self.assertEqual(professional_service.service, self.leak_repair)
        self.assertEqual(professional_service.service.category, self.plumbing)

    def test_professionals_filter_by_price_min(self):
        response = self.client_api.get(
            f"/api/v1/professionals/?service={self.leak_repair.id}&price_min=100000"
        )

        self.assertEqual(response.status_code, 200)
        names = {item["display_name"] for item in self.results(response)}
        self.assertEqual(names, {"Pro Plomeria"})

    def test_professionals_filter_by_price_max(self):
        response = self.client_api.get(
            f"/api/v1/professionals/?service={self.leak_repair.id}&price_max=80000"
        )

        self.assertEqual(response.status_code, 200)
        names = {item["display_name"] for item in self.results(response)}
        self.assertEqual(names, {"Pro Economico"})

    def test_professionals_filter_by_price_overlap_with_both_limits(self):
        response = self.client_api.get(
            f"/api/v1/professionals/?service={self.leak_repair.id}&price_min=100000&price_max=150000"
        )

        self.assertEqual(response.status_code, 200)
        results = self.results(response)
        names = {item["display_name"] for item in results}
        self.assertEqual(names, {"Pro Plomeria"})
        self.assertEqual(results[0]["matching_service"]["price_min"], "90000.00")
        self.assertEqual(results[0]["matching_service"]["price_max"], "180000.00")

    def test_professional_can_update_service_price_range(self):
        self.client_api.force_authenticate(user=self.pro_user)

        response = self.client_api.patch(
            "/api/v1/professionals/me/",
            {
                "service_offerings": [
                    {
                        "service": self.leak_repair.id,
                        "price_min": "95000",
                        "price_max": "210000",
                        "observaciones": "Cobro $45.000 por metro cuadrado.",
                        "years_experience": 7,
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        professional_service = self.profile.services.get(service=self.leak_repair)
        self.assertEqual(str(professional_service.price_min), "95000.00")
        self.assertEqual(str(professional_service.price_max), "210000.00")
        self.assertEqual(professional_service.observations, "Cobro $45.000 por metro cuadrado.")
        self.assertEqual(professional_service.years_experience, 7)
        self.assertEqual(
            response.json()["services"][0]["observaciones"],
            "Cobro $45.000 por metro cuadrado.",
        )

    def test_professional_can_publish_custom_service(self):
        self.client_api.force_authenticate(user=self.pro_user)

        response = self.client_api.patch(
            "/api/v1/professionals/me/",
            {
                "custom_services": [
                    {
                        "category": self.plumbing.id,
                        "name": "Cambio de sifon especial",
                        "price_min": "80000",
                        "price_max": "160000",
                        "observaciones": "Incluye sifon sencillo; materiales premium se cotizan aparte.",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        service = Service.objects.get(slug="cambio-de-sifon-especial")
        self.assertEqual(service.category, self.plumbing)
        offering = self.profile.services.get(service=service)
        self.assertEqual(str(offering.price_min), "80000.00")
        self.assertEqual(str(offering.price_max), "160000.00")
        self.assertEqual(
            offering.observations,
            "Incluye sifon sencillo; materiales premium se cotizan aparte.",
        )
