from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.city_stats import city_of
from apps.accounts.models import User, UserRole
from apps.households.models import Household
from apps.professionals.models import ProfessionalProfile


class CityStatsTests(TestCase):
    def test_city_matching_ignores_accents_case_and_whole_words(self):
        self.assertEqual(city_of("Bogotá D.C."), "bogota")
        self.assertEqual(city_of("MEDELLÍN"), "medellin")
        self.assertEqual(city_of("Santiago de Cali"), "cali")
        self.assertEqual(city_of("Chía"), "cundinamarca")
        self.assertEqual(city_of("California"), None)
        self.assertEqual(city_of(""), None)

    def test_admin_report_returns_households_profiles_and_points_per_city(self):
        owner = User.objects.create_user(email="c@x.co", username="c", password="x", role=UserRole.CLIENT)
        Household.objects.create(owner=owner, label="A", city="Medellín", neighborhood="el poblado", latitude=6.2087, longitude=-75.5707)
        Household.objects.create(owner=owner, label="B", city="Medellin", neighborhood="El Poblado")
        Household.objects.create(owner=owner, label="C", city="Cali", neighborhood="San Fernando", latitude=3.4372, longitude=-76.5225)
        Household.objects.create(owner=owner, label="D", city="Pasto")
        pro = User.objects.create_user(email="p@x.co", username="p", password="x", role=UserRole.PROFESSIONAL)
        ProfessionalProfile.objects.create(user=pro, display_name="Pro", city="Cartagena", latitude=10.4, longitude=-75.5)

        staff = User.objects.create_user(email="s@x.co", username="s", password="x", role=UserRole.STAFF, is_staff=True)
        api = APIClient()
        api.force_authenticate(staff)
        data = api.get("/api/v1/admin/reports-stats/").data
        cities = {c["id"]: c for c in data["cities"]}

        self.assertEqual([c["id"] for c in data["cities"]], ["bogota", "medellin", "cali", "cartagena", "cundinamarca"])
        self.assertEqual(cities["medellin"]["households"], 2)
        self.assertEqual(cities["medellin"]["zones"], [{"name": "El Poblado", "count": 2}])
        self.assertEqual(len(cities["medellin"]["points"]), 1)
        self.assertEqual(cities["medellin"]["located"], 1)
        self.assertEqual(cities["cali"]["households"], 1)
        self.assertEqual(cities["cartagena"]["professionals"], 1)
        self.assertEqual(cities["cartagena"]["points"][0]["kind"], "pro")
        self.assertEqual(data["cities_other"]["households"], 1)
        self.assertEqual(cities["bogota"]["center"], [4.711, -74.0721])
