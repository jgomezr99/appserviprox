"""Pruebas de los flujos que deben conservarse al cambiar infraestructura."""
import io
import tempfile
from urllib.parse import urlsplit

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.orders.models import Order
from apps.professionals.models import ProfessionalProfile, ProfessionalService
from apps.service_requests.models import ServiceRequest


class DeploymentFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = ServiceCategory.objects.create(name="Plomeria", slug="plomeria")
        cls.service = Service.objects.create(category=cls.category, name="Reparacion fuga",
            slug="reparacion-fuga", keywords=["fuga de agua"])
        cls.client_user = User.objects.create_user(email="client@validation.example", username="validation-client",
            password="Validation-81!", role=UserRole.CLIENT)
        cls.stranger = User.objects.create_user(email="stranger@validation.example", username="validation-stranger",
            password="Validation-81!", role=UserRole.CLIENT)
        cls.household = Household.objects.create(owner=cls.client_user, label="Casa", latitude=4.64, longitude=-74.06)
        cls.profiles = []
        for name, lat in [("near", 4.65), ("middle", 4.66), ("far", 4.80)]:
            user = User.objects.create_user(email=f"{name}@validation.example", username=f"validation-{name}",
                password="Validation-81!", role=UserRole.PROFESSIONAL)
            profile = ProfessionalProfile.objects.create(user=user, display_name=name,
                latitude=lat, longitude=-74.06, coverage_radius_km=10)
            ProfessionalService.objects.create(profile=profile, service=cls.service, price_min=50000)
            cls.profiles.append(profile)

    def setUp(self):
        self.api = APIClient()
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)

    def test_register_both_roles_jwt_profile_and_refresh(self):
        for role in [UserRole.CLIENT, UserRole.PROFESSIONAL]:
            email = f"new-{role}@validation.example"
            payload = {"email": email, "username": f"new-{role}", "role": role,
                "password": "Random-Validation-81!", "city": "Bogota"}
            response = self.api.post("/api/v1/auth/register/", payload, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertNotIn("password", response.data)
            response = self.api.post("/api/v1/auth/token/", {"email": email, "password": payload["password"]}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            tokens = response.data
            self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
            me = self.api.get("/api/v1/auth/me/")
            self.assertEqual(me.status_code, 200)
            self.assertEqual(me.data["role"], role)
            self.api.credentials()
            refreshed = self.api.post("/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
            self.assertEqual(refreshed.status_code, 200, refreshed.data)
            self.assertNotEqual(refreshed.data["refresh"], tokens["refresh"])
            self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
            self.assertEqual(self.api.get("/api/v1/auth/me/").status_code, 200)
            self.api.credentials()

    def test_proximity_filters_and_orders_existing_professionals(self):
        response = self.api.get(f"/api/v1/professionals/?lat=4.64&lng=-74.06&radius_km=5&service={self.service.id}")
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data["results"]
        self.assertEqual([item["id"] for item in results], [self.profiles[0].id, self.profiles[1].id])
        self.assertLess(float(results[0]["distance_km"]), float(results[1]["distance_km"]))

    def test_household_coordinates_persist(self):
        self.api.force_authenticate(user=self.client_user)
        response = self.api.patch(f"/api/v1/households/{self.household.id}/",
            {"address_line": "Calle 80 # 10-20", "latitude": 4.68, "longitude": -74.07}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.household.refresh_from_db()
        self.assertEqual(self.household.latitude, 4.68)
        self.assertEqual(self.household.longitude, -74.07)

    def test_evidence_is_private_and_completed_order_can_be_reviewed(self):
        profile = self.profiles[0]
        request = ServiceRequest.objects.create(client=self.client_user, household=self.household,
            selected_category=self.category, selected_service=self.service, professional=profile,
            description="Fuga de agua")
        order = Order.objects.create(service_request=request, client=self.client_user, professional=profile,
            status=Order.Status.IN_PROGRESS)
        buffer = io.BytesIO()
        Image.new("RGB", (2, 2)).save(buffer, format="PNG")
        upload = SimpleUploadedFile("evidence.png", buffer.getvalue(), content_type="image/png")
        self.api.force_authenticate(user=profile.user)
        response = self.api.post(f"/api/v1/orders/{order.id}/evidence/", {"image": upload}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        image_url = urlsplit(response.data["work_evidence"][0]["image_url"]).path
        self.assertTrue(image_url.startswith(f"/api/v1/orders/{order.id}/evidence/"))
        for user in [profile.user, self.client_user]:
            self.api.force_authenticate(user=user)
            image = self.api.get(image_url)
            self.assertEqual(image.status_code, 200)
            self.assertEqual(b"".join(image.streaming_content), buffer.getvalue())
            image.close()
        self.api.force_authenticate(user=self.stranger)
        self.assertEqual(self.api.get(image_url).status_code, 404)
        self.api.force_authenticate(user=None)
        self.assertEqual(self.api.get(image_url).status_code, 401)
        self.api.force_authenticate(user=self.client_user)
        paid = self.api.post(f"/api/v1/orders/{order.id}/confirm-demo-payment/")
        self.assertEqual(paid.status_code, 200)
        self.api.force_authenticate(user=profile.user)
        completed = self.api.post(f"/api/v1/orders/{order.id}/transition/", {"status": "completed"}, format="json")
        self.assertEqual(completed.status_code, 200, completed.data)
        self.api.force_authenticate(user=self.client_user)
        review = self.api.post("/api/v1/reviews/", {"order": order.id, "rating": 5, "comment": "Correcto"}, format="json")
        self.assertEqual(review.status_code, 201, review.data)
        profile.refresh_from_db()
        self.assertEqual(profile.rating_avg, 5)

