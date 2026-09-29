import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.orders.models import Order, OrderEvent
from apps.orders.services import confirm_development_payment
from apps.professionals.models import ProfessionalProfile, ProfessionalService
from apps.service_requests.models import ServiceRequest, ServiceRequestImage


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class DirectedServiceRequestTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.client_user = User.objects.create_user(
            email="client@example.com",
            username="client",
            password="secret",
            role=UserRole.CLIENT,
            first_name="Camila",
            last_name="Rojas",
        )
        self.other_client = User.objects.create_user(
            email="other-client@example.com",
            username="other-client",
            password="secret",
            role=UserRole.CLIENT,
        )
        self.pro_user = User.objects.create_user(
            email="pro@example.com",
            username="pro",
            password="secret",
            role=UserRole.PROFESSIONAL,
        )
        self.other_pro_user = User.objects.create_user(
            email="other-pro@example.com",
            username="other-pro",
            password="secret",
            role=UserRole.PROFESSIONAL,
        )
        self.category = ServiceCategory.objects.create(
            name="Plomeria",
            slug="plomeria",
            is_active=True,
        )
        self.service = Service.objects.create(
            category=self.category,
            name="Reparacion de fuga",
            slug="reparacion-de-fuga",
            is_active=True,
        )
        self.other_service = Service.objects.create(
            category=self.category,
            name="Instalacion de griferia",
            slug="instalacion-de-griferia",
            is_active=True,
        )
        self.household = Household.objects.create(
            owner=self.client_user,
            label="Casa principal",
            city="Bogota",
            neighborhood="Kennedy",
        )
        self.other_household = Household.objects.create(
            owner=self.other_client,
            label="Casa ajena",
            city="Bogota",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.pro_user,
            display_name="Carlos Rodriguez",
            headline="Plomeria residencial",
            city="Bogota",
            is_active=True,
        )
        self.other_profile = ProfessionalProfile.objects.create(
            user=self.other_pro_user,
            display_name="Ana Torres",
            headline="Instalaciones",
            city="Bogota",
            is_active=True,
        )
        ProfessionalService.objects.create(profile=self.profile, service=self.service)
        ProfessionalService.objects.create(
            profile=self.other_profile,
            service=self.other_service,
        )

    def image_file(self, name="evidence.png"):
        return SimpleUploadedFile(
            name,
            (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4"
                b"\x89\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02"
                b"\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
            ),
            content_type="image/png",
        )

    def create_direct_request(self, professional=None, service=None, user=None, images=None):
        self.api.force_authenticate(user=user or self.client_user)
        payload = {
            "household": self.household.id,
            "selected_service": (service or self.service).id,
            "professional": (professional or self.profile).id,
            "description": "Hay una fuga debajo del lavaplatos.",
            "urgency": ServiceRequest.Urgency.THIS_WEEK,
        }
        if images is not None:
            payload["images"] = images
        response = self.api.post(
            "/api/v1/requests/",
            payload,
            format="multipart" if images is not None else "json",
        )
        return response

    def test_client_creates_directed_request_with_real_service(self):
        response = self.create_direct_request()

        self.assertEqual(response.status_code, 201)
        service_request = ServiceRequest.objects.get()
        self.assertEqual(service_request.client, self.client_user)
        self.assertEqual(service_request.household, self.household)
        self.assertEqual(service_request.selected_service, self.service)
        self.assertEqual(service_request.selected_category, self.category)
        self.assertEqual(service_request.professional, self.profile)
        self.assertIsNone(service_request.suggested_category)

    def test_client_creates_request_with_images(self):
        response = self.create_direct_request(images=[self.image_file("leak-a.png"), self.image_file("leak-b.png")])

        self.assertEqual(response.status_code, 201)
        service_request = ServiceRequest.objects.get()
        self.assertEqual(service_request.images.count(), 2)
        self.assertEqual(response.json()["images"][0]["id"], service_request.images.first().id)

    def test_authorized_users_can_read_request_images(self):
        response = self.create_direct_request(images=[self.image_file()])
        self.assertEqual(response.status_code, 201)
        service_request = ServiceRequest.objects.get()
        image = service_request.images.get()

        self.api.force_authenticate(user=self.client_user)
        client_response = self.api.get(f"/api/v1/requests/{service_request.id}/images/{image.id}/")
        self.assertEqual(client_response.status_code, 200)

        self.api.force_authenticate(user=self.pro_user)
        pro_response = self.api.get(f"/api/v1/requests/{service_request.id}/images/{image.id}/")
        self.assertEqual(pro_response.status_code, 200)

    def test_third_parties_cannot_read_request_images(self):
        response = self.create_direct_request(images=[self.image_file()])
        self.assertEqual(response.status_code, 201)
        service_request = ServiceRequest.objects.get()
        image = service_request.images.get()

        self.api.force_authenticate(user=self.other_client)
        client_response = self.api.get(f"/api/v1/requests/{service_request.id}/images/{image.id}/")
        self.assertEqual(client_response.status_code, 404)

        self.api.force_authenticate(user=self.other_pro_user)
        pro_response = self.api.get(f"/api/v1/requests/{service_request.id}/images/{image.id}/")
        self.assertEqual(pro_response.status_code, 404)

    def test_client_cannot_create_request_with_incompatible_professional(self):
        response = self.create_direct_request(professional=self.other_profile)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ServiceRequest.objects.count(), 0)

    def test_client_only_lists_own_requests(self):
        own = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Propia",
        )
        ServiceRequest.objects.create(
            client=self.other_client,
            household=self.other_household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Ajena",
        )

        self.api.force_authenticate(user=self.client_user)
        response = self.api.get("/api/v1/requests/")

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertEqual(ids, [own.id])

    def test_professional_only_lists_directed_requests(self):
        directed = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Para Carlos",
        )
        ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.other_service,
            professional=self.other_profile,
            description="Para Ana",
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.get("/api/v1/requests/")

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertEqual(ids, [directed.id])

    def test_professional_accepts_request_and_order_is_created(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Aceptar esta solicitud",
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(f"/api/v1/requests/{service_request.id}/accept/")

        self.assertEqual(response.status_code, 200)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.ACCEPTED)
        order = Order.objects.get(service_request=service_request)
        self.assertEqual(order.professional, self.profile)
        self.assertEqual(order.status, Order.Status.ACCEPTED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)

    def test_accepting_request_keeps_images_available(self):
        response = self.create_direct_request(images=[self.image_file()])
        self.assertEqual(response.status_code, 201)
        service_request = ServiceRequest.objects.get()

        self.api.force_authenticate(user=self.pro_user)
        accept_response = self.api.post(f"/api/v1/requests/{service_request.id}/accept/")

        self.assertEqual(accept_response.status_code, 200)
        self.assertEqual(ServiceRequestImage.objects.filter(service_request=service_request).count(), 1)
        self.assertEqual(len(accept_response.json()["images"]), 1)

    def test_professional_rejects_request(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Rechazar esta solicitud",
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(f"/api/v1/requests/{service_request.id}/reject/")

        self.assertEqual(response.status_code, 200)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.REJECTED)
        self.assertEqual(Order.objects.count(), 0)

    def test_rejecting_request_does_not_create_payment(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Rechazo sin pago",
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(f"/api/v1/requests/{service_request.id}/reject/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Order.objects.count(), 0)

    def test_other_professional_cannot_answer_request(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Privada",
        )

        self.api.force_authenticate(user=self.other_pro_user)
        response = self.api.post(f"/api/v1/requests/{service_request.id}/accept/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Order.objects.count(), 0)

    def test_double_acceptance_does_not_create_duplicate_orders(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Doble click",
        )

        self.api.force_authenticate(user=self.pro_user)
        first = self.api.post(f"/api/v1/requests/{service_request.id}/accept/")
        second = self.api.post(f"/api/v1/requests/{service_request.id}/accept/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(Order.objects.filter(service_request=service_request).count(), 1)

    def test_confirm_demo_payment_is_idempotent(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Pago demo",
        )
        self.api.force_authenticate(user=self.pro_user)
        self.api.post(f"/api/v1/requests/{service_request.id}/accept/")
        order = Order.objects.get(service_request=service_request)

        self.api.force_authenticate(user=self.client_user)
        first = self.api.post(f"/api/v1/orders/{order.id}/confirm-demo-payment/")
        second = self.api.post(f"/api/v1/orders/{order.id}/confirm-demo-payment/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.payment_reference, f"DEV-{order.id}")

    def test_order_cannot_complete_without_confirmed_payment(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Sin pago",
        )
        order = Order.objects.create(
            service_request=service_request,
            professional=self.profile,
            client=self.client_user,
            status=Order.Status.IN_PROGRESS,
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(
            f"/api/v1/orders/{order.id}/transition/",
            {"status": Order.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.IN_PROGRESS)
        self.assertFalse(OrderEvent.objects.filter(order=order, status=Order.Status.COMPLETED).exists())

    def test_order_can_complete_with_confirmed_payment(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            description="Con pago",
        )
        order = Order.objects.create(
            service_request=service_request,
            professional=self.profile,
            client=self.client_user,
            status=Order.Status.IN_PROGRESS,
        )
        confirm_development_payment(order, user=self.client_user)

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(
            f"/api/v1/orders/{order.id}/transition/",
            {"status": Order.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
        self.assertTrue(OrderEvent.objects.filter(order=order, status=Order.Status.COMPLETED).exists())

    def test_invalid_transition_fails(self):
        service_request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.category,
            selected_service=self.service,
            professional=self.profile,
            status=ServiceRequest.Status.ACCEPTED,
            description="Ya aceptada",
        )

        self.api.force_authenticate(user=self.pro_user)
        response = self.api.post(f"/api/v1/requests/{service_request.id}/reject/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
