"""Regresiones del flujo real: enviar, aceptar, desplazarse, trabajar y cerrar."""
import importlib
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import PlatformSettings, User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.orders.models import Order, OrderEvent, Payment
from apps.professionals.models import ProfessionalProfile, ProfessionalService
from apps.service_requests.models import ServiceRequest, RequestCandidate


@override_settings(
    DEBUG=True, SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["testserver"],
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class ServiceWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = User.objects.create_user(email="client@workflow.example", username="workflow-client", password="test", role=UserRole.CLIENT)
        cls.worker = User.objects.create_user(email="pro@workflow.example", username="workflow-pro", password="test", role=UserRole.PROFESSIONAL)
        cls.stranger = User.objects.create_user(email="other@workflow.example", username="workflow-other", password="test", role=UserRole.CLIENT)
        cls.category = ServiceCategory.objects.create(name="Plomería", slug="workflow-plomeria")
        cls.service = Service.objects.create(name="Reparar fuga", slug="workflow-fuga", category=cls.category)
        cls.home = Household.objects.create(owner=cls.customer, label="Casa", address_line="Calle 80 # 10-20")
        cls.profile = ProfessionalProfile.objects.create(user=cls.worker, display_name="Profesional de prueba", accepts_urgent=True)
        ProfessionalService.objects.create(profile=cls.profile, service=cls.service, price_min=50000, price_max=90000)

    def setUp(self):
        self.api = APIClient()

    def send_request(self, urgency="this_week", directed=True):
        self.api.force_authenticate(self.customer)
        payload = {"household": self.home.pk, "selected_service": self.service.pk, "description": "Fuga debajo del lavamanos", "urgency": urgency}
        if directed:
            payload["professional"] = self.profile.pk
        response = self.api.post("/api/v1/requests/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def accepted_order(self):
        request = self.send_request()
        self.api.force_authenticate(self.worker)
        response = self.api.post(f"/api/v1/requests/{request['id']}/accept/")
        self.assertEqual(response.status_code, 200, response.data)
        return Order.objects.get(pk=response.data["order"]["id"])

    def advance(self, order, status, **details):
        return self.api.post(f"/api/v1/orders/{order.pk}/transition/", {"status": status, **details}, format="json")

    def test_all_modalities_wait_for_professional_acceptance(self):
        for urgency in ServiceRequest.Urgency.values:
            with self.subTest(urgency=urgency):
                data = self.send_request(urgency)
                self.assertEqual(data["status"], "open")
                self.assertIsNone(data["order"])
                self.assertFalse(Order.objects.filter(service_request_id=data["id"]).exists())
        self.home.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertIsNone(self.home.latitude)
        self.assertIsNone(self.profile.latitude)

    def test_unassigned_request_never_fabricates_an_order(self):
        data = self.send_request(directed=False)
        self.assertIsNone(data["professional"])
        self.assertIsNone(data["order"])
        stored = self.api.get(f"/api/v1/requests/{data['id']}/")
        self.assertIsNone(stored.data["order"])

    def test_acceptance_creates_only_one_accepted_order_with_price_snapshot(self):
        order = self.accepted_order()
        self.assertEqual(order.status, "accepted")
        self.assertEqual(order.payment_status, "pending")
        self.assertEqual(order.estimate_min, Decimal("50000"))
        self.assertEqual(order.estimate_max, Decimal("90000"))
        self.assertEqual(list(order.events.values_list("status", flat=True)), ["accepted"])
        duplicate = self.api.post(f"/api/v1/requests/{order.service_request_id}/accept/")
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(Order.objects.filter(service_request=order.service_request).count(), 1)

    def test_full_workflow_closes_execution_before_payment_and_can_be_reviewed(self):
        order = self.accepted_order()
        scheduled = (timezone.now() + timedelta(days=2)).isoformat()
        for status, details in [
            ("scheduled", {"scheduled_for": scheduled}), ("traveling", {}),
            ("arrived", {"arrival_code": order.arrival_code}), ("in_progress", {}),
            ("break", {}), ("in_progress", {}),
        ]:
            response = self.advance(order, status, **details)
            self.assertEqual(response.status_code, 200, response.data)
        price = self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "75000"}, format="json")
        self.assertEqual(price.status_code, 200, price.data)
        completed = self.advance(order, "completed")
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["status"], "completed")
        self.assertEqual(completed.data["payment_status"], "pending")
        self.assertEqual(completed.data["available_transitions"], [])
        self.assertTrue(any(event["status"] == "completed" for event in completed.data["events"]))
        order.service_request.refresh_from_db()
        self.assertEqual(order.service_request.status, "closed")
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.jobs_completed, 1)
        self.api.force_authenticate(self.customer)
        review = self.api.post("/api/v1/reviews/", {"order": order.pk, "rating": 4, "comment": "Trabajo finalizado"}, format="json")
        self.assertEqual(review.status_code, 201, review.data)
        recovered = self.api.get(f"/api/v1/orders/{order.pk}/")
        self.assertEqual(recovered.data["review"]["rating"], 4)
        self.assertEqual(recovered.data["payment_status"], "pending")

    def test_customer_cannot_advance_or_set_professional_price(self):
        order = self.accepted_order()
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.advance(order, "traveling").status_code, 403)
        self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "50000"}, format="json").status_code, 403)
        detail = self.api.get(f"/api/v1/orders/{order.pk}/")
        self.assertEqual(detail.data["available_transitions"], ["cancelled"])

    def test_arrival_requires_customer_code_and_professional_cannot_read_it(self):
        order = self.accepted_order()
        self.assertEqual(self.advance(order, "traveling").status_code, 200)
        detail = self.api.get(f"/api/v1/orders/{order.pk}/")
        self.assertEqual(detail.data["arrival_code"], "")
        wrong = self.advance(order, "arrived", arrival_code="incorrect")
        self.assertEqual(wrong.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, "traveling")
        self.api.force_authenticate(self.customer)
        code = self.api.get(f"/api/v1/orders/{order.pk}/").data["arrival_code"]
        self.assertEqual(code, order.arrival_code)
        self.api.force_authenticate(self.worker)
        self.assertEqual(self.advance(order, "arrived", arrival_code=code).status_code, 200)

    def test_invalid_skips_and_schedule_dates_return_specific_errors(self):
        order = self.accepted_order()
        skipped = self.advance(order, "completed")
        self.assertEqual(skipped.status_code, 400)
        self.assertIn("No se puede pasar", skipped.data["status"])
        for details in [{}, {"scheduled_for": (timezone.now() - timedelta(hours=1)).isoformat()}]:
            self.assertEqual(self.advance(order, "scheduled", **details).status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, "accepted")

    def test_customer_can_cancel_before_departure_but_not_while_traveling(self):
        order = self.accepted_order()
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.advance(order, "cancelled").status_code, 200)
        order.service_request.refresh_from_db()
        self.assertEqual(order.service_request.status, "cancelled")
        other = self.accepted_order()
        self.assertEqual(self.advance(other, "traveling").status_code, 200)
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.advance(other, "cancelled").status_code, 403)

    def test_location_only_during_travel_and_with_valid_coordinates(self):
        order = self.accepted_order()
        url = f"/api/v1/orders/{order.pk}/location/"
        self.assertEqual(self.api.post(url, {"latitude": 4.65, "longitude": -74.06}, format="json").status_code, 400)
        self.advance(order, "traveling")
        for lat, lng in [(91, 0), (0, -181), ("NaN", 0), (0, "Infinity")]:
            self.assertEqual(self.api.post(url, {"latitude": lat, "longitude": lng}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"latitude": 0, "longitude": 0}, format="json").status_code, 200)
        self.advance(order, "arrived", arrival_code=order.arrival_code)
        self.assertEqual(self.api.post(url, {"latitude": 4.65, "longitude": -74.06}, format="json").status_code, 400)

    def test_terminal_order_cannot_reopen_or_accept_more_location_and_evidence(self):
        order = self.accepted_order()
        Order.objects.filter(pk=order.pk).update(status="in_progress")
        self.assertEqual(self.advance(order, "completed").status_code, 200)
        count = order.events.count()
        self.assertEqual(self.advance(order, "traveling").status_code, 400)
        self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/location/", {"latitude": 4, "longitude": -74}, format="json").status_code, 400)
        self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/evidence/", {}, format="multipart").status_code, 400)
        self.assertEqual(order.events.count(), count)

    def test_price_can_be_registered_after_completion_but_is_locked_during_payment(self):
        order = self.accepted_order()
        Order.objects.filter(pk=order.pk).update(status="in_progress")
        self.advance(order, "completed")
        url = f"/api/v1/orders/{order.pk}/price/"
        self.assertEqual(self.api.post(url, {"final_price": "80000"}, format="json").status_code, 200)
        Payment.objects.create(order=order, client=self.customer, reference="workflow-payment", amount_in_cents=8000000)
        self.assertEqual(self.api.post(url, {"final_price": "90000"}, format="json").status_code, 400)
        Payment.objects.filter(order=order).update(status="approved")
        Order.objects.filter(pk=order.pk).update(payment_status="paid")
        self.assertEqual(self.api.post(url, {"final_price": "90000"}, format="json").status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.final_price, Decimal("80000"))

    def test_price_rejects_negative_zero_nonfinite_and_excess_precision(self):
        order = self.accepted_order()
        for amount in ["0", "-1", "NaN", "Infinity", "1.001", "10000000000"]:
            self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": amount}, format="json").status_code, 400)

    @patch("apps.orders.views.build_checkout_url", return_value="https://checkout.wompi.co/test")
    @patch("apps.orders.views.wompi_ready", return_value=True)
    def test_checkout_uses_final_price_instead_of_silently_charging_estimate(self, ready, checkout):
        # Conservar el contrato real de configuración, también usado al contratar.
        PlatformSettings.objects.create(data={"sections": {"payments": {"card_enabled": True}}})
        order = self.accepted_order()
        self.api.force_authenticate(self.customer)
        url = f"/api/v1/orders/{order.pk}/wompi-checkout/"
        self.assertEqual(self.api.post(url).status_code, 400)
        self.assertFalse(Payment.objects.filter(order=order).exists())
        checkout.assert_not_called()
        self.api.force_authenticate(self.worker)
        self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "75000"}, format="json")
        self.api.force_authenticate(self.customer)
        response = self.api.post(url, {"final_price": "1", "amount_in_cents": 1}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["amount_in_cents"], 7500000)
        self.assertEqual(Payment.objects.get(order=order).amount_in_cents, 7500000)
        checkout.assert_called_once()

    def test_unrelated_account_cannot_open_or_change_service(self):
        order = self.accepted_order()
        self.api.force_authenticate(self.stranger)
        self.assertEqual(self.api.get(f"/api/v1/orders/{order.pk}/").status_code, 404)
        self.assertEqual(self.api.get(f"/api/v1/requests/{order.service_request_id}/").status_code, 404)
        self.assertEqual(self.advance(order, "traveling").status_code, 404)

    def test_generic_updates_cannot_bypass_workflow_or_reassign_accepted_request(self):
        order = self.accepted_order()
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.api.patch(f"/api/v1/requests/{order.service_request_id}/", {"professional": None}, format="json").status_code, 405)
        self.assertEqual(self.api.patch(f"/api/v1/orders/{order.pk}/", {"status": "completed"}, format="json").status_code, 405)

    def test_client_with_professional_profile_cannot_hire_itself_or_be_a_candidate(self):
        own = ProfessionalProfile.objects.create(user=self.customer, display_name="Mi perfil profesional")
        ProfessionalService.objects.create(profile=own, service=self.service, price_min=50000, price_max=90000)
        self.api.force_authenticate(self.customer)
        response = self.api.post("/api/v1/requests/", {"household": self.home.pk, "selected_service": self.service.pk,
            "professional": own.pk, "description": "Mi solicitud"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("professional", response.data)
        self.assertFalse(ServiceRequest.objects.exists())
        data = self.send_request(directed=False)
        self.assertFalse(RequestCandidate.objects.filter(request_id=data["id"], professional=own).exists())
        RequestCandidate.objects.create(request_id=data["id"], professional=own)
        self.api.post(f"/api/v1/requests/{data['id']}/refresh_candidates/")
        self.assertFalse(RequestCandidate.objects.filter(request_id=data["id"], professional=own).exists())
        response = self.api.get("/api/v1/professionals/")
        profiles = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertNotIn(own.pk, [item["id"] for item in profiles])
        self.assertTrue(self.api.get(f"/api/v1/professionals/{own.pk}/").data["is_own_profile"])

    def test_legacy_order_creation_cannot_hire_self_or_supply_its_own_price_bounds(self):
        own = ProfessionalProfile.objects.create(user=self.customer, display_name="Mi perfil profesional")
        ProfessionalService.objects.create(profile=own, service=self.service, price_min=50000, price_max=90000)
        data = self.send_request(directed=False)
        payload = {"service_request": data["id"], "professional": own.pk, "estimate_min": "1", "estimate_max": "999999", "final_price": "1"}
        self.assertEqual(self.api.post("/api/v1/orders/", payload, format="json").status_code, 400)
        payload["professional"] = self.profile.pk
        response = self.api.post("/api/v1/orders/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.estimate_min, Decimal("50000"))
        self.assertEqual(order.estimate_max, Decimal("90000"))
        self.assertIsNone(order.final_price)

    def test_professional_cannot_accept_legacy_self_request(self):
        home = Household.objects.create(owner=self.worker, label="Casa propia")
        request = ServiceRequest.objects.create(client=self.worker, household=home, selected_service=self.service,
            selected_category=self.category, professional=self.profile, description="Solicitud propia")
        self.api.force_authenticate(self.worker)
        response = self.api.post(f"/api/v1/requests/{request.pk}/accept/")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Order.objects.filter(service_request=request).exists())

    def test_price_is_readonly_for_client_even_if_request_body_impersonates_professional(self):
        order = self.accepted_order()
        url = f"/api/v1/orders/{order.pk}/price/"
        self.assertEqual(self.api.post(url, {"final_price": "75000"}, format="json").status_code, 200)
        self.api.force_authenticate(self.customer)
        response = self.api.get(f"/api/v1/orders/{order.pk}/")
        self.assertEqual(response.data["viewer_role"], "client")
        self.assertFalse(response.data["can_set_final_price"])
        forged = self.api.post(url, {"final_price": "50000", "role": "professional", "professional": self.profile.pk}, format="json")
        self.assertEqual(forged.status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.final_price, Decimal("75000"))

    def test_final_price_respects_both_published_bounds_inclusively(self):
        order = self.accepted_order()
        url = f"/api/v1/orders/{order.pk}/price/"
        for amount in ["50000", "90000"]:
            self.assertEqual(self.api.post(url, {"final_price": amount}, format="json").status_code, 200)
        for amount in ["49999.99", "90000.01"]:
            response = self.api.post(url, {"final_price": amount}, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        order.refresh_from_db()
        self.assertEqual(order.final_price, Decimal("90000"))

    def test_accepted_price_range_does_not_change_with_later_profile_edits(self):
        order = self.accepted_order()
        ProfessionalService.objects.filter(profile=self.profile, service=self.service).update(price_min=10000, price_max=20000)
        url = f"/api/v1/orders/{order.pk}/price/"
        self.assertEqual(self.api.post(url, {"final_price": "75000"}, format="json").status_code, 200)
        self.assertEqual(self.api.post(url, {"final_price": "15000"}, format="json").status_code, 400)

    def test_legacy_missing_price_bounds_are_completed_once_from_published_offering(self):
        order = self.accepted_order()
        Order.objects.filter(pk=order.pk).update(estimate_min=None, estimate_max=None)
        response = self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "75000"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        order.refresh_from_db()
        self.assertEqual((order.estimate_min, order.estimate_max), (Decimal("50000"), Decimal("90000")))

    def test_price_cannot_be_confirmed_without_complete_valid_bounds(self):
        order = self.accepted_order()
        for lower, upper in [(None, None), (Decimal("90000"), Decimal("50000"))]:
            Order.objects.filter(pk=order.pk).update(estimate_min=lower, estimate_max=upper)
            ProfessionalService.objects.filter(profile=self.profile, service=self.service).update(price_min=lower, price_max=upper)
            response = self.api.get(f"/api/v1/orders/{order.pk}/")
            self.assertFalse(response.data["can_set_final_price"])
            self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "75000"}, format="json").status_code, 400)

    def test_changing_to_client_role_revokes_professional_authority(self):
        from rest_framework.exceptions import PermissionDenied
        from apps.orders.services import set_final_price, transition
        order = self.accepted_order()
        self.worker.role = UserRole.CLIENT
        self.worker.save(update_fields=["role"])
        self.api.force_authenticate(self.worker)
        self.assertEqual(self.api.get(f"/api/v1/orders/{order.pk}/").status_code, 404)
        self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/price/", {"final_price": "75000"}, format="json").status_code, 404)
        with self.assertRaises(PermissionDenied):
            set_final_price(order, Decimal("75000"), self.worker)
        with self.assertRaises(PermissionDenied):
            transition(order, "traveling", self.worker)

    def test_legacy_self_order_is_not_operable_or_reviewable_in_client_mode(self):
        home = Household.objects.create(owner=self.worker, label="Casa propia")
        request = ServiceRequest.objects.create(client=self.worker, household=home, selected_service=self.service,
            selected_category=self.category, professional=self.profile, status="accepted")
        order = Order.objects.create(client=self.worker, professional=self.profile, service_request=request, status="in_progress")
        self.worker.role = UserRole.CLIENT
        self.worker.save(update_fields=["role"])
        self.api.force_authenticate(self.worker)
        self.assertEqual(self.api.get(f"/api/v1/orders/{order.pk}/").status_code, 404)
        for action, payload in [("price", {"final_price": "75000"}), ("transition", {"status": "completed"}),
                                ("location", {"latitude": 4, "longitude": -74}), ("evidence", {})]:
            self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/{action}/", payload, format="json").status_code, 404)
        Order.objects.filter(pk=order.pk).update(status="completed")
        self.assertEqual(self.api.post("/api/v1/reviews/", {"order": order.pk, "rating": 5}, format="json").status_code, 400)

    @patch("apps.orders.views.build_checkout_url")
    @patch("apps.orders.views.wompi_ready", return_value=True)
    def test_checkout_rejects_legacy_out_of_range_final_price(self, ready, checkout):
        PlatformSettings.objects.create(data={"sections": {"payments": {"card_enabled": True}}})
        order = self.accepted_order()
        Order.objects.filter(pk=order.pk).update(final_price=Decimal("90000.01"))
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.api.post(f"/api/v1/orders/{order.pk}/wompi-checkout/").status_code, 400)
        self.assertFalse(Payment.objects.filter(order=order).exists())
        checkout.assert_not_called()

    def test_rejecting_legacy_requested_order_cancels_it(self):
        data = self.send_request()
        order = Order.objects.create(client=self.customer, professional=self.profile, service_request_id=data["id"])
        self.api.force_authenticate(self.worker)
        response = self.api.post(f"/api/v1/requests/{data['id']}/reject/")
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, "cancelled")
        self.assertEqual(response.data["status"], "rejected")

    def test_legacy_create_order_endpoint_keeps_request_answerable(self):
        data = self.send_request()
        response = self.api.post("/api/v1/orders/", {"service_request": data["id"], "professional": self.profile.pk}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "requested")
        self.api.force_authenticate(self.worker)
        accepted = self.api.post(f"/api/v1/requests/{data['id']}/accept/")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data["order"]["status"], "accepted")

    def test_migration_repairs_only_automatic_departures_without_professional_activity(self):
        note = "Solicitud enviada al profesional. En camino a la ubicación del cliente."
        to_repair = []
        for request_status in ["open", "accepted", "rejected"]:
            data = self.send_request()
            ServiceRequest.objects.filter(pk=data["id"]).update(status=request_status)
            order = Order.objects.create(client=self.customer, professional=self.profile, service_request_id=data["id"], status="traveling")
            OrderEvent.objects.create(order=order, status="traveling", note=note, created_by=self.customer)
            to_repair.append(order)
        untouched = self.accepted_order()
        Order.objects.filter(pk=untouched.pk).update(status="traveling")
        OrderEvent.objects.create(order=untouched, status="traveling", created_by=self.worker, note=note)
        migration = importlib.import_module("apps.orders.migrations.0006_reconcile_premature_orders")
        migration.reconcile_premature_orders(apps, SimpleNamespace(connection=connection))
        for order, expected in zip(to_repair, ["requested", "accepted", "cancelled"]):
            order.refresh_from_db()
            self.assertEqual(order.status, expected)
        untouched.refresh_from_db()
        self.assertEqual(untouched.status, "traveling")

    def test_migration_restores_answerability_of_legacy_matched_request(self):
        data = self.send_request(directed=False)
        ServiceRequest.objects.filter(pk=data["id"]).update(status="matched")
        order = Order.objects.create(client=self.customer, professional=self.profile, service_request_id=data["id"])
        migration = importlib.import_module("apps.orders.migrations.0006_reconcile_premature_orders")
        migration.reconcile_premature_orders(apps, SimpleNamespace(connection=connection))
        request = ServiceRequest.objects.get(pk=data["id"])
        self.assertEqual(request.status, "open")
        self.assertEqual(request.professional_id, self.profile.pk)
        self.api.force_authenticate(self.worker)
        self.assertEqual(self.api.get(f"/api/v1/requests/{request.pk}/").status_code, 200)
        response = self.api.post(f"/api/v1/requests/{request.pk}/accept/")
        self.assertEqual(response.status_code, 200, response.data)
        order.refresh_from_db()
        self.assertEqual(order.status, "accepted")
