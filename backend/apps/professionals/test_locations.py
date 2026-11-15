from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.professionals.geo import city_center
from apps.professionals.models import ProfessionalProfile


class CityCenterTests(SimpleTestCase):
    def test_recognizes_cities_with_accents_and_suffixes(self):
        self.assertEqual(city_center("Bogotá D.C."), (4.7110, -74.0721))
        self.assertEqual(city_center("medellin"), (6.2442, -75.5812))
        self.assertEqual(city_center("Santiago de Cali"), (3.4516, -76.5320))
        self.assertIsNone(city_center("Ciudad desconocida"))


class ProfessionalWithoutGpsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@x.co", username="p", password="Prueba-12345!", role=UserRole.PROFESSIONAL)
        self.viewer = User.objects.create_user(email="c@x.co", username="c", password="Prueba-12345!", role=UserRole.CLIENT)

    def search(self, lat, lng):
        api = APIClient()
        api.force_authenticate(self.viewer)
        data = api.get("/api/v1/professionals/", {"lat": lat, "lng": lng, "radius_km": 50}).json()
        return data["results"] if isinstance(data, dict) else data

    def test_new_professional_appears_on_the_map_of_their_city_as_approximate(self):
        ProfessionalProfile.objects.create(user=self.user, display_name="Pablo", city="Medellín", coverage_radius_km=25)

        results = self.search(6.25, -75.57)

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]["location_approximate"])

    def test_real_gps_replaces_the_approximate_location(self):
        profile = ProfessionalProfile.objects.create(user=self.user, display_name="Pablo", city="Medellín", coverage_radius_km=25)
        api = APIClient()
        api.force_authenticate(self.user)

        api.post("/api/v1/professionals/location/", {"latitude": 6.2100, "longitude": -75.5700}, format="json")
        profile.refresh_from_db()
        results = self.search(6.25, -75.57)

        self.assertEqual((profile.latitude, profile.longitude), (6.21, -75.57))
        self.assertFalse(results[0]["location_approximate"])

    def test_unknown_city_stays_without_coordinates(self):
        profile = ProfessionalProfile.objects.create(user=self.user, display_name="Pablo", city="Pueblo Raro")

        self.assertIsNone(profile.latitude)
