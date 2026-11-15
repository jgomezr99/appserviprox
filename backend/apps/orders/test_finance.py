"""Flujo financiero: historial del cliente, ingresos del profesional y gestión del administrador."""
from decimal import Decimal
import io
import json
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import PlatformSettings, User, UserRole
from apps.catalog.models import Service, ServiceCategory
from apps.households.models import Household
from apps.professionals.models import ProfessionalProfile
from apps.service_requests.models import ServiceRequest

from .models import Order, Payment, Refund, Withdrawal

PASSWORD = "Finance-Test-81!"


@override_settings(DEBUG=True)
class FinanceFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        category = ServiceCategory.objects.create(name="Plomeria", slug="plomeria")
        cls.service = Service.objects.create(
            category=category, name="Reparacion fuga", slug="reparacion-fuga"
        )
        cls.client_user = User.objects.create_user(
            email="client@finance.example", username="fin-client", password=PASSWORD, role=UserRole.CLIENT
        )
        cls.other_client = User.objects.create_user(
            email="other@finance.example", username="fin-other", password=PASSWORD, role=UserRole.CLIENT
        )
        cls.staff = User.objects.create_user(
            email="staff@finance.example", username="fin-staff", password=PASSWORD, role=UserRole.STAFF
        )
        pro_user = User.objects.create_user(
            email="pro@finance.example", username="fin-pro", password=PASSWORD, role=UserRole.PROFESSIONAL
        )
        cls.profile = ProfessionalProfile.objects.create(user=pro_user, display_name="Pedro Pro")
        cls.pro_user = pro_user
        cls.household = Household.objects.create(owner=cls.client_user, label="Casa")

    def make_order(self, price="100000"):
        request = ServiceRequest.objects.create(
            client=self.client_user,
            household=self.household,
            selected_category=self.service.category,
            selected_service=self.service,
        )
        return Order.objects.create(
            service_request=request,
            professional=self.profile,
            client=self.client_user,
            final_price=Decimal(price),
        )

    def as_user(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    def pay_and_complete(self, order):
        Order.objects.filter(pk=order.pk).update(status=Order.Status.COMPLETED)
        response = self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/confirm-demo-payment/")
        self.assertEqual(response.status_code, 200, response.data)

    def set_discount(self, **values):
        data = PlatformSettings.load()
        data["sections"].setdefault("payments", {}).update(values)
        PlatformSettings.save_data(data)

    def test_discount_is_applied_to_payment_and_absorbed_by_the_platform(self):
        self.set_discount(discount_enabled=True, discount_type="percent", discount_value=5)
        order = self.make_order("100000")
        self.pay_and_complete(order)

        payment = order.payments.get()
        order.refresh_from_db()
        self.assertEqual(payment.amount_in_cents, 9500000)
        self.assertEqual(payment.discount_amount, Decimal("5000"))
        self.assertEqual(order.professional_amount, Decimal("90000.00"))
        self.assertEqual(order.commission_amount, Decimal("5000.00"))

        receipt = self.as_user(self.client_user).get(f"/api/v1/payments/{payment.id}/receipt/").data
        self.assertEqual(receipt["subtotal"], 100000)
        self.assertEqual(receipt["discount"], 5000)
        self.assertEqual(receipt["amount"], 95000)

    @patch("apps.orders.views.build_checkout_url", return_value="https://checkout.wompi.co/test")
    @patch("apps.orders.views.wompi_ready", return_value=True)
    def test_wompi_checkout_charges_discounted_amount(self, ready, checkout):
        self.set_discount(discount_enabled=True, discount_type="fixed", discount_value=4000)
        order = self.make_order("100000")
        Order.objects.filter(pk=order.pk).update(
            status=Order.Status.COMPLETED, estimate_min=Decimal("50000"), estimate_max=Decimal("200000")
        )

        response = self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/wompi-checkout/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["amount_in_cents"], 9600000)
        payment = order.payments.get()
        self.assertEqual(payment.discount_amount, Decimal("4000"))
        self.assertEqual(checkout.call_args.args[1], 9600000)

        order_data = self.as_user(self.client_user).get(f"/api/v1/orders/{order.id}/").data
        self.assertEqual(order_data["discount_preview"], "4000.00")
        self.assertEqual(order_data["amount_due"], "96000.00")

    def test_declined_test_card_records_declined_payment_and_keeps_order_pending(self):
        order = self.make_order("100000")
        Order.objects.filter(pk=order.pk).update(status=Order.Status.COMPLETED)
        body = {"method": "credit", "card_number": "4000 0000 0000 0002", "card_holder": "Cliente Prueba",
                "expiry": "12/45", "cvv": "123"}
        response = self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/confirm-demo-payment/", body, format="json")
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.data["payment_status"], "declined")
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(order.payments.get().status, Payment.Status.DECLINED)

        transfer = {"method": "transfer", "bank": "Bancolombia", "account_type": "savings", "document_type": "CC",
                    "document_number": "1234567890", "transfer_reference": "rechazado"}
        self.assertEqual(self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/confirm-demo-payment/", transfer, format="json").status_code, 402)

        body["card_number"] = "4242 4242 4242 4242"
        ok = self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/confirm-demo-payment/", body, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.payments.filter(status=Payment.Status.APPROVED).count(), 1)

    def test_paid_order_exposes_payment_info_to_both_parties_receipt_only_to_client(self):
        order = self.make_order("100000")
        self.pay_and_complete(order)
        payment = order.payments.get()

        mine = self.as_user(self.client_user).get(f"/api/v1/orders/{order.id}/").data["payment_info"]
        self.assertEqual(mine["amount"], "100000.00")
        self.assertEqual(mine["receipt_id"], payment.id)
        theirs = self.as_user(self.pro_user).get(f"/api/v1/orders/{order.id}/").data["payment_info"]
        self.assertEqual(theirs["amount"], "100000.00")
        self.assertEqual(theirs["method"], "Pago simulado")
        self.assertIsNone(theirs["receipt_id"])

        pending = self.make_order("50000")
        self.assertIsNone(self.as_user(self.client_user).get(f"/api/v1/orders/{pending.id}/").data["payment_info"])

    def test_admin_summary_and_payment_detail_come_from_the_database(self):
        self.set_discount(discount_enabled=True, discount_type="fixed", discount_value=4000)
        order = self.make_order("100000")
        self.pay_and_complete(order)
        payment = order.payments.get()
        api = self.as_user(self.staff)

        summary = api.get("/api/v1/admin/finance/summary/").data
        self.assertEqual(summary["collected"], 96000)
        self.assertEqual(summary["discounts_total"], 4000)
        self.assertEqual(summary["commissions"], 6000)
        self.assertEqual(summary["payments_total"], 1)

        listed = api.get("/api/v1/admin/payments/").data[0]
        self.assertEqual(listed["discount"], 4000)

        detail = api.get(f"/api/v1/admin/payments/{payment.id}/").data
        self.assertEqual((detail["subtotal"], detail["discount"], detail["amount"]), (100000, 4000, 96000))
        self.assertEqual((detail["commission_amount"], detail["professional_amount"]), (6000, 90000))
        self.assertEqual(detail["client_email"], self.client_user.email)
        self.assertEqual(detail["service"], order.service_request.selected_service.name)
        self.assertEqual(api.get("/api/v1/admin/payments/999999/").status_code, 404)
        self.assertEqual(self.as_user(self.client_user).get(f"/api/v1/admin/payments/{payment.id}/").status_code, 403)

    def test_discount_never_exceeds_platform_commission(self):
        self.set_discount(discount_enabled=True, discount_type="fixed", discount_value=50000)
        order = self.make_order("100000")
        self.pay_and_complete(order)
        payment = order.payments.get()
        order.refresh_from_db()
        self.assertEqual(payment.discount_amount, Decimal("10000.00"))
        self.assertEqual(order.commission_amount, Decimal("0.00"))
        self.assertEqual(order.professional_amount, Decimal("90000.00"))

    def test_no_discount_when_disabled(self):
        self.set_discount(discount_enabled=False, discount_type="percent", discount_value=5)
        order = self.make_order("100000")
        self.pay_and_complete(order)
        self.assertEqual(order.payments.get().discount_amount, Decimal("0"))

    @override_settings(WOMPI_PUBLIC_KEY="pub_prod_abc", WOMPI_PRIVATE_KEY="prv_prod_abc",
                       WOMPI_EVENTS_SECRET="ev", WOMPI_INTEGRITY_SECRET="in",
                       WOMPI_TEST_PUBLIC_KEY="", WOMPI_TEST_PRIVATE_KEY="")
    @patch("apps.orders.wompi.urllib.request.urlopen")
    def test_admin_connection_test_checks_wompi_and_method(self, urlopen):
        body = io.BytesIO(json.dumps({"data": {"name": "Serviprox SAS", "accepted_payment_methods": ["CARD", "PSE"]}}).encode())
        urlopen.return_value.__enter__.return_value = body
        api = self.as_user(self.staff)

        card = api.post("/api/v1/admin/payments/test-connection/", {"method": "card"}, format="json")
        self.assertEqual(card.status_code, 200)
        self.assertTrue(card.data["ok"], card.data)
        self.assertNotIn("pub_prod_abc", json.dumps(card.data))

        body.seek(0)
        transfer = api.post("/api/v1/admin/payments/test-connection/", {"method": "transfer"}, format="json")
        self.assertFalse(transfer.data["ok"])
        self.assertEqual(api.post("/api/v1/admin/payments/test-connection/", {"method": "x"}, format="json").status_code, 400)
        self.assertEqual(self.as_user(self.client_user).post("/api/v1/admin/payments/test-connection/", {"method": "card"}, format="json").status_code, 403)

    @override_settings(WOMPI_PUBLIC_KEY="", WOMPI_TEST_PUBLIC_KEY="")
    def test_admin_connection_test_reports_missing_keys(self):
        report = self.as_user(self.staff).post("/api/v1/admin/payments/test-connection/", {"method": "card"}, format="json").data
        self.assertFalse(report["ok"])
        self.assertEqual(report["checks"][0]["name"], "Llaves configuradas en el servidor")

    def test_admin_edits_payment_form_and_clients_receive_it(self):
        api = self.as_user(self.staff)
        form = {
            "title": "Paga seguro · {monto}", "note": "Tus datos no se guardan.",
            "submit_label": "Pagar ya", "transfer_submit_label": "Enviar transferencia",
            "show_installments": False, "show_transfer_reference": True,
            "button_color": "#112233", "button_text_color": "#ffffff", "button_size": "large",
            "button_align": "center", "button_shape": "pill",
            "approved": {"title": "¡Listo!", "message": "Pago aprobado", "color": "#15803d", "size": "large",
                         "style": "solid", "position": "form", "align": "center", "shape": "pill"},
            "declined": {"title": "Rechazado", "message": "Intenta de nuevo", "color": "#b91c1c"},
            "methods": [
                {"id": "transfer", "label": "Por transferencia", "enabled": True},
                {"id": "credit", "label": "Crédito", "enabled": True},
                {"id": "debit", "label": "Débito", "enabled": False},
            ],
        }
        ok = api.patch("/api/v1/admin/settings/", {"sections": {"payments": {"payment_form": form}}}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        public = APIClient().get("/api/v1/platform/settings/").data["payment_form"]
        self.assertEqual([m["id"] for m in public["methods"]], ["transfer", "credit", "debit"])
        self.assertEqual(public["submit_label"], "Pagar ya")
        self.assertFalse(public["show_installments"])
        self.assertEqual(public["button_align"], "center")
        self.assertEqual(public["declined"]["color"], "#b91c1c")
        self.assertEqual(public["declined"]["style"], "soft")
        self.assertEqual((public["approved"]["position"], public["approved"]["shape"]), ("form", "pill"))

        for bad in (
            {**form, "methods": []},
            {**form, "methods": [{"id": "bitcoin", "label": "x", "enabled": True}]},
            {**form, "methods": [{"id": "credit", "label": "a", "enabled": False}]},
            {**form, "title": 5},
            {**form, "approved": {"title": "x", "message": "y", "color": "#15803d", "style": "neon"}},
            {**form, "declined": {"title": "x", "message": "y", "color": "#b91c1c", "position": "sidebar"}},
            {**form, "button_color": "rojo"},
            {**form, "button_size": "gigante"},
            {**form, "declined": {"title": "x", "message": "y", "color": "javascript:alert(1)"}},
        ):
            response = api.patch("/api/v1/admin/settings/", {"sections": {"payments": {"payment_form": bad}}}, format="json")
            self.assertEqual(response.status_code, 400, bad)

    def test_admin_method_catalog_is_validated(self):
        api = self.as_user(self.staff)

        def save(payments):
            return api.patch("/api/v1/admin/settings/", {"sections": {"payments": payments}}, format="json")

        good = {
            "custom_methods": ["custom_efecty1"], "custom_efecty1_enabled": True,
            "method_ui": {"pse": {"name": "PSE Banco", "description": "d", "icon": "🏦", "color": "#112233"},
                          "custom_efecty1": {"name": "Efecty", "description": "Giro", "icon": "💵", "color": ""}},
            "method_order": ["custom_efecty1", "pse", "card"],
        }
        self.assertEqual(save(good).status_code, 200)
        self.assertEqual(PlatformSettings.load()["sections"]["payments"]["method_order"][0], "custom_efecty1")
        for bad in (
            {"custom_methods": ["efecty"]},
            {"custom_methods": [f"custom_abc{i}" for i in range(9)]},
            {"method_order": ["pse", "pse"]},
            {"method_order": ["inexistente"]},
            {"method_ui": {"pse": {"name": "", "description": "", "icon": "", "color": ""}}},
            {"method_ui": {"pse": {"name": "x", "description": "", "icon": "", "color": "rojo"}}},
        ):
            self.assertEqual(save(bad).status_code, 400, bad)

    @override_settings(WOMPI_PUBLIC_KEY="pub_prod_abc", WOMPI_PRIVATE_KEY="prv_prod_abc",
                       WOMPI_EVENTS_SECRET="ev", WOMPI_INTEGRITY_SECRET="in",
                       WOMPI_TEST_PUBLIC_KEY="", WOMPI_TEST_PRIVATE_KEY="")
    @patch("apps.orders.wompi.urllib.request.urlopen")
    def test_admin_health_and_stats(self, urlopen):
        urlopen.return_value.__enter__.return_value = io.BytesIO(
            json.dumps({"data": {"name": "Serviprox SAS", "accepted_payment_methods": ["CARD"]}}).encode()
        )
        self.set_discount()
        order = self.make_order("100000")
        for status_value in ["approved"] * 2 + ["declined"] * 4:
            Payment.objects.create(order=order, client=self.client_user, reference=f"R-{status_value}-{Payment.objects.count()}",
                                   amount_in_cents=10000000, status=status_value, payment_method="CARD")
        api = self.as_user(self.staff)

        health = api.get("/api/v1/admin/payments/health/").data
        self.assertEqual(health["merchant"], "Serviprox SAS")
        self.assertEqual(health["methods"]["card"]["status"], "ok")
        self.assertEqual(health["methods"]["pse"]["status"], "error")
        self.assertTrue(any("rechazados" in a["message"] for a in health["alerts"]))
        self.assertNotIn("pub_prod_abc", json.dumps(health))

        stats = api.get("/api/v1/admin/payments/stats/").data["methods"]["card"]
        self.assertEqual((stats["approved"], stats["declined"], stats["approval_rate"]), (2, 4, 33.3))
        self.assertEqual(stats["approved_amount"], 200000)
        self.assertEqual(self.as_user(self.client_user).get("/api/v1/admin/payments/health/").status_code, 403)

    def test_admin_validates_discount_settings(self):
        api = self.as_user(self.staff)
        bad = api.patch("/api/v1/admin/settings/", {"sections": {"payments": {"discount_enabled": True, "discount_type": "percent", "discount_value": 150}}}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = api.patch("/api/v1/admin/settings/", {"sections": {"payments": {"discount_enabled": True, "discount_type": "fixed", "discount_value": 5000}}}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(PlatformSettings.load()["sections"]["payments"]["discount_value"], 5000)

    def test_receipt_endpoint_returns_database_record_only_to_its_client(self):
        order = self.make_order()
        self.pay_and_complete(order)
        payment = order.payments.get()
        self.client_user.phone = "3001234567"
        self.client_user.document_id = "1234567890"
        self.client_user.save()

        data = self.as_user(self.client_user).get(f"/api/v1/payments/{payment.id}/receipt/").data
        self.assertEqual(data["id"], payment.id)
        self.assertEqual(data["client_phone"], "3001234567")
        self.assertEqual(data["client_document"], "1234567890")
        self.assertEqual(data["client_email"], self.client_user.email)
        self.assertEqual(data["amount"], 100000)
        self.assertEqual(data["service"], order.service_request.selected_service.name)
        self.assertEqual(data["service_category"], order.service_request.selected_category.name)
        self.assertIsNotNone(data["paid_at"])
        self.assertEqual(self.as_user(self.other_client).get(f"/api/v1/payments/{payment.id}/receipt/").status_code, 404)

    def test_client_history_lists_payment_with_receipt_data(self):
        order = self.make_order()
        self.pay_and_complete(order)

        rows = self.as_user(self.client_user).get("/api/v1/payments/history/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["amount"], 100000)
        self.assertEqual(rows[0]["service"], "Reparacion fuga")
        self.assertEqual(rows[0]["professional"], "Pedro Pro")
        self.assertTrue(rows[0]["receipt_available"])
        self.assertEqual(self.as_user(self.other_client).get("/api/v1/payments/history/").data, [])

    def test_commission_split_and_professional_earnings(self):
        order = self.make_order()
        self.pay_and_complete(order)
        order.refresh_from_db()
        self.assertEqual(order.commission_amount, Decimal("10000.00"))
        self.assertEqual(order.professional_amount, Decimal("90000.00"))

        data = self.as_user(self.pro_user).get("/api/v1/professional/earnings/").data
        self.assertEqual(data["summary"]["pending_settlement"], 90000)
        self.assertEqual(data["summary"]["available_balance"], 0)
        self.assertEqual(len(data["incomes"]), 1)
        self.assertEqual(self.as_user(self.client_user).get("/api/v1/professional/earnings/").status_code, 403)

    def test_settlement_withdrawal_and_transfer(self):
        order = self.make_order()
        self.pay_and_complete(order)
        admin = self.as_user(self.staff)

        self.assertEqual(self.as_user(self.client_user).post("/api/v1/admin/payouts/settle/", {"all": True}, format="json").status_code, 403)
        settled = admin.post("/api/v1/admin/payouts/settle/", {"all": True}, format="json")
        self.assertEqual(settled.data["settled"], 1)

        pro = self.as_user(self.pro_user)
        self.assertEqual(pro.get("/api/v1/professional/earnings/").data["summary"]["available_balance"], 90000)
        too_much = pro.post("/api/v1/professional/withdrawals/", {"amount": 95000, "destination": "Bancolombia ahorros 1234"}, format="json")
        self.assertEqual(too_much.status_code, 400)
        created = pro.post("/api/v1/professional/withdrawals/", {"amount": 60000, "destination": "Bancolombia ahorros 1234"}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(pro.get("/api/v1/professional/earnings/").data["summary"]["available_balance"], 30000)

        pay_without_reference = admin.post(f"/api/v1/admin/withdrawals/{created.data['id']}/resolve/", {"action": "pay"}, format="json")
        self.assertEqual(pay_without_reference.status_code, 400)
        paid = admin.post(f"/api/v1/admin/withdrawals/{created.data['id']}/resolve/", {"action": "pay", "reference": "TRF-001"}, format="json")
        self.assertEqual(paid.data["status"], Withdrawal.Status.PAID)
        earnings = pro.get("/api/v1/professional/earnings/").data
        self.assertEqual(len(earnings["transfers"]), 1)
        self.assertEqual(earnings["summary"]["withdrawn_total"], 60000)

    def test_rejected_withdrawal_releases_balance(self):
        order = self.make_order()
        self.pay_and_complete(order)
        self.as_user(self.staff).post("/api/v1/admin/payouts/settle/", {"all": True}, format="json")
        pro = self.as_user(self.pro_user)
        created = pro.post("/api/v1/professional/withdrawals/", {"amount": 50000, "destination": "Nequi 3001234567"}, format="json")
        self.as_user(self.staff).post(f"/api/v1/admin/withdrawals/{created.data['id']}/resolve/", {"action": "reject", "note": "Datos incorrectos"}, format="json")
        self.assertEqual(pro.get("/api/v1/professional/earnings/").data["summary"]["available_balance"], 90000)

    def test_refund_reverts_payment_and_blocks_after_withdrawal(self):
        order = self.make_order()
        self.pay_and_complete(order)
        admin = self.as_user(self.staff)
        admin.post("/api/v1/admin/payouts/settle/", {"all": True}, format="json")
        pro = self.as_user(self.pro_user)
        withdrawal = pro.post("/api/v1/professional/withdrawals/", {"amount": 60000, "destination": "Nequi 3001234567"}, format="json")
        self.assertEqual(withdrawal.status_code, 201)

        refund = admin.post("/api/v1/admin/refunds/", {"order_id": order.id, "reason": "Servicio no prestado"}, format="json")
        self.assertEqual(refund.status_code, 201, refund.data)
        blocked = admin.post(f"/api/v1/admin/refunds/{refund.data['id']}/resolve/", {"action": "approve"}, format="json")
        self.assertEqual(blocked.status_code, 400)

        admin.post(f"/api/v1/admin/withdrawals/{withdrawal.data['id']}/resolve/", {"action": "reject", "note": "Reembolso en curso"}, format="json")
        approved = admin.post(f"/api/v1/admin/refunds/{refund.data['id']}/resolve/", {"action": "approve"}, format="json")
        self.assertEqual(approved.data["status"], Refund.Status.APPROVED)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.REFUNDED)
        self.assertEqual(Payment.objects.get(order=order).status, Payment.Status.REFUNDED)
        self.assertEqual(pro.get("/api/v1/professional/earnings/").data["summary"]["available_balance"], 0)
        self.assertEqual(self.as_user(self.client_user).post(f"/api/v1/orders/{order.id}/confirm-demo-payment/").data["payment_status"], "refunded")

    def test_unpaid_completed_service_blocks_hiring_and_hides_professional(self):
        order = self.make_order()
        Order.objects.filter(pk=order.pk).update(status=Order.Status.COMPLETED)
        client = self.as_user(self.client_user)
        payload = {
            "household": self.household.id,
            "selected_category": self.service.category.id,
            "selected_service": self.service.id,
            "professional": self.profile.id,
            "description": "Otro servicio",
        }

        blocked = client.post("/api/v1/requests/", payload, format="json")
        self.assertEqual(blocked.status_code, 403, blocked.data)
        self.assertEqual(client.get("/api/v1/payments/hold/").data["orders"][0]["order_id"], order.id)

        listed = [p["id"] for p in APIClient().get("/api/v1/professionals/").data["results"]]
        self.assertNotIn(self.profile.id, listed)
        admin_listed = [p["id"] for p in self.as_user(self.staff).get("/api/v1/professionals/").data["results"]]
        self.assertIn(self.profile.id, admin_listed)

        self.assertEqual(client.post(f"/api/v1/orders/{order.id}/confirm-demo-payment/").status_code, 200)
        listed = [p["id"] for p in APIClient().get("/api/v1/professionals/").data["results"]]
        self.assertIn(self.profile.id, listed)

    def test_admin_summary_report_and_permissions(self):
        order = self.make_order()
        self.pay_and_complete(order)
        admin = self.as_user(self.staff)

        summary = admin.get("/api/v1/admin/finance/summary/").data
        self.assertEqual(summary["collected"], 100000)
        self.assertEqual(summary["commissions"], 10000)
        self.assertEqual(summary["eligible_settlement_orders"], 1)

        report = admin.get("/api/v1/admin/finance/report/")
        self.assertEqual(report.data["totals"]["commissions"], 10000)
        csv_report = admin.get("/api/v1/admin/finance/report/?export=csv")
        self.assertEqual(csv_report["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("Pedro Pro", csv_report.content.decode())
        self.assertEqual(admin.get("/api/v1/admin/finance/report/?from=nope").status_code, 400)

        for url in ("/api/v1/admin/finance/summary/", "/api/v1/admin/payments/", "/api/v1/admin/withdrawals/", "/api/v1/admin/refunds/"):
            self.assertEqual(self.as_user(self.client_user).get(url).status_code, 403, url)
