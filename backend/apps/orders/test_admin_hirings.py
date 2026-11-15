from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Notification, User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.pqrs.models import PQRReport
from apps.professionals.models import ProfessionalProfile, ProfessionalService
from apps.service_requests.models import ServiceRequest

from .models import Order, OrderAdminNote, Review


class AdminHiringTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        category = ServiceCategory.objects.create(name="Plomeria", slug="plomeria")
        cls.service = Service.objects.create(category=category, name="Reparacion fuga", slug="reparacion-fuga")
        cls.client_user = User.objects.create_user(
            email="c@x.co", username="c", password="x", role=UserRole.CLIENT, first_name="Ana", last_name="Lopez"
        )
        cls.staff = User.objects.create_user(email="s@x.co", username="s", password="x", role=UserRole.STAFF, is_staff=True)
        pro_user = User.objects.create_user(email="p@x.co", username="p", password="x", role=UserRole.PROFESSIONAL)
        cls.profile = ProfessionalProfile.objects.create(user=pro_user, display_name="Pedro Pro", latitude=4.65, longitude=-74.06)
        ProfessionalService.objects.create(profile=cls.profile, service=cls.service, price_min=50000)
        cls.household = Household.objects.create(
            owner=cls.client_user, label="Casa", city="Medellín", neighborhood="El Poblado", latitude=4.66, longitude=-74.07
        )

    def api(self, user=None):
        client = APIClient()
        client.force_authenticate(user or self.staff)
        return client

    def make_request(self, **extra):
        return ServiceRequest.objects.create(
            client=self.client_user, household=self.household, selected_category=self.service.category,
            selected_service=self.service, description="Fuga en la cocina", **extra,
        )

    def make_order(self, status=Order.Status.ACCEPTED, price="100000", **extra):
        return Order.objects.create(
            service_request=self.make_request(professional=self.profile, status=ServiceRequest.Status.ACCEPTED),
            professional=self.profile, client=self.client_user, status=status,
            final_price=Decimal(price) if price else None, **extra,
        )

    def age(self, order, **delta):
        Order.objects.filter(pk=order.pk).update(updated_at=timezone.now() - timedelta(**delta))

    def test_only_staff_can_use_the_module(self):
        order = self.make_order()
        for url in ("/api/v1/admin/hirings/", "/api/v1/admin/hirings/summary/", f"/api/v1/admin/hirings/{order.id}/"):
            self.assertEqual(self.api(self.client_user).get(url).status_code, 403)

    def test_list_filters_search_and_pagination(self):
        accepted = self.make_order()
        done = self.make_order(status=Order.Status.COMPLETED)
        Order.objects.filter(pk=done.pk).update(payment_status=Order.PaymentStatus.PAID)
        data = self.api().get("/api/v1/admin/hirings/?page_size=1").data
        self.assertEqual((data["count"], len(data["results"])), (2, 1))
        row = self.api().get(f"/api/v1/admin/hirings/?q=%23{accepted.id}").data["results"][0]
        self.assertEqual(row["id"], accepted.id)
        self.assertEqual(row["client"]["name"], "Ana Lopez")
        self.assertEqual(row["professional"]["name"], "Pedro Pro")
        self.assertEqual((row["service"], row["city"], row["final_price"]), ("Reparacion fuga", "Medellín", 100000.0))
        self.assertEqual(self.api().get("/api/v1/admin/hirings/?status=completed").data["count"], 1)
        self.assertEqual(self.api().get("/api/v1/admin/hirings/?payment=paid").data["count"], 1)
        self.assertEqual(self.api().get("/api/v1/admin/hirings/?city=medell").data["count"], 2)
        self.assertEqual(self.api().get("/api/v1/admin/hirings/?city=cali").data["count"], 0)
        self.assertEqual(self.api().get("/api/v1/admin/hirings/?q=pedro").data["count"], 2)

    def test_summary_alerts_and_filtering_by_alert(self):
        stalled = self.make_order(status=Order.Status.IN_PROGRESS)
        self.age(stalled, hours=60)
        unpaid = self.make_order(status=Order.Status.COMPLETED)
        self.age(unpaid, hours=30)
        fresh = self.make_order()
        reviewed = self.make_order(status=Order.Status.COMPLETED)
        Review.objects.create(order=reviewed, rating=5)

        summary = self.api().get("/api/v1/admin/hirings/summary/").data
        self.assertEqual(summary["total"], 4)
        self.assertEqual(summary["completed"], 2)
        self.assertEqual(summary["value_total"], 400000)
        self.assertEqual(summary["avg_ticket"], 100000)
        self.assertEqual(len(summary["daily"]), 30)
        self.assertEqual(summary["daily"][-1]["count"], 4)
        self.assertEqual(summary["top_services"][0], {"name": "Reparacion fuga", "count": 4})
        self.assertEqual(summary["top_professionals"][0]["name"], "Pedro Pro")
        keys = {a["key"]: a["count"] for a in summary["alerts"]}
        self.assertEqual(keys, {"stalled": 1, "unpaid": 1})

        listed = self.api().get("/api/v1/admin/hirings/?alert=stalled").data["results"]
        self.assertEqual([r["id"] for r in listed], [stalled.id])
        self.assertEqual(listed[0]["alerts"], ["stalled"])
        self.assertEqual(self.api().get(f"/api/v1/admin/hirings/?q=%23{fresh.id}").data["results"][0]["alerts"], [])

    def test_detail_cancel_notes_and_pqr(self):
        order = self.make_order()
        api = self.api()
        detail = api.get(f"/api/v1/admin/hirings/{order.id}/").data
        self.assertEqual(detail["address"], "El Poblado, Medellín")
        self.assertTrue(detail["can_cancel"])
        self.assertFalse(detail["can_settle"])
        self.assertEqual(api.get("/api/v1/admin/hirings/999999/").status_code, 404)

        self.assertEqual(api.post(f"/api/v1/admin/hirings/{order.id}/notes/", {"text": "x"}, format="json").status_code, 400)
        note = api.post(f"/api/v1/admin/hirings/{order.id}/notes/", {"text": "Llamar al cliente"}, format="json")
        self.assertEqual(note.status_code, 201)
        self.assertEqual(OrderAdminNote.objects.get().author_name, "s@x.co")
        self.assertEqual(api.get(f"/api/v1/admin/hirings/{order.id}/").data["notes"][0]["text"], "Llamar al cliente")

        bad = api.post(f"/api/v1/admin/hirings/{order.id}/pqr/", {"type": "otra", "description": "x" * 20}, format="json")
        self.assertEqual(bad.status_code, 400)
        pqr = api.post(f"/api/v1/admin/hirings/{order.id}/pqr/", {"type": "queja", "description": "El profesional no llegó"}, format="json")
        self.assertEqual(pqr.status_code, 201)
        created = PQRReport.objects.get()
        self.assertEqual((created.pqr_type, created.client_email, created.contractor_name), ("queja", "c@x.co", "Pedro Pro"))
        self.assertEqual(created.related_to, f"Contratación #{order.id}")

        self.assertEqual(api.post(f"/api/v1/admin/hirings/{order.id}/cancel/", {"reason": "no"}, format="json").status_code, 400)
        ok = api.post(f"/api/v1/admin/hirings/{order.id}/cancel/", {"reason": "Cliente no responde"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertIn("Cancelada por administración", order.events.last().note)
        self.assertEqual(api.post(f"/api/v1/admin/hirings/{order.id}/cancel/", {"reason": "Otra vez ok"}, format="json").status_code, 400)

    def test_paid_order_cannot_be_cancelled_and_can_be_settled(self):
        order = self.make_order(status=Order.Status.COMPLETED)
        Order.objects.filter(pk=order.pk).update(payment_status=Order.PaymentStatus.PAID)
        detail = self.api().get(f"/api/v1/admin/hirings/{order.id}/").data
        self.assertTrue(detail["can_settle"])
        in_progress = self.make_order(status=Order.Status.IN_PROGRESS)
        Order.objects.filter(pk=in_progress.pk).update(payment_status=Order.PaymentStatus.PAID)
        self.assertIn("reembolso", self.api().get(f"/api/v1/admin/hirings/{in_progress.id}/").data["cancel_blocked_reason"])
        response = self.api().post(f"/api/v1/admin/hirings/{in_progress.id}/cancel/", {"reason": "Quiero cancelar"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_open_requests_and_manual_assignment(self):
        orphan = self.make_request()
        waiting = self.make_request(professional=self.profile)
        taken = self.make_request(professional=self.profile, status=ServiceRequest.Status.ACCEPTED)
        api = self.api()

        everything = api.get("/api/v1/admin/hirings/requests/").data
        self.assertEqual({r["id"] for r in everything["results"]}, {orphan.id, waiting.id})
        self.assertEqual(api.get("/api/v1/admin/hirings/requests/?kind=no_professional").data["results"][0]["id"], orphan.id)
        self.assertEqual(api.get("/api/v1/admin/hirings/requests/?kind=awaiting").data["results"][0]["id"], waiting.id)

        options = api.get(f"/api/v1/admin/hirings/requests/{orphan.id}/professionals/").data
        self.assertEqual([o["name"] for o in options], ["Pedro Pro"])
        self.assertIsNotNone(options[0]["distance_km"])

        stranger = ProfessionalProfile.objects.create(
            user=User.objects.create_user(email="o@x.co", username="o", password="x", role=UserRole.PROFESSIONAL),
            display_name="Sin servicio",
        )
        url = f"/api/v1/admin/hirings/requests/{orphan.id}/assign/"
        self.assertEqual(api.post(url, {"professional_id": stranger.id}, format="json").status_code, 400)
        self.assertEqual(api.post(url, {"professional_id": 99999}, format="json").status_code, 400)
        ok = api.post(url, {"professional_id": self.profile.id}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        orphan.refresh_from_db()
        self.assertEqual(orphan.professional_id, self.profile.id)
        self.assertTrue(Notification.objects.filter(user=self.profile.user, target_id=str(orphan.id)).exists())
        self.assertEqual(api.post(f"/api/v1/admin/hirings/requests/{taken.id}/assign/", {"professional_id": self.profile.id}, format="json").status_code, 404)
