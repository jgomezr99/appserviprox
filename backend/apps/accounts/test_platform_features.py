from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Notification, PlatformSettings, User, UserRole
from apps.professionals.models import ProfessionalProfile

PASSWORD = "Prueba-12345!"


def set_features(**features):
    data = PlatformSettings.load()
    data["features"].update(features)
    PlatformSettings.save_data(data)


def set_section(name, **values):
    data = PlatformSettings.load()
    data["sections"].setdefault(name, {}).update(values)
    PlatformSettings.save_data(data)


class MaintenanceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(email="c@x.co", username="c", password=PASSWORD, role=UserRole.CLIENT)
        cls.staff = User.objects.create_user(
            email="s@x.co", username="s", password=PASSWORD, role=UserRole.STAFF, is_staff=True
        )

    def api(self, user=None, **extra):
        client = APIClient(**extra)
        if user:
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
        return client

    def household_payload(self):
        return {"label": "Casa", "address_line": "Calle 1", "city": "Bogotá", "neighborhood": "Chapinero"}

    def test_writes_are_blocked_for_regular_users_but_reads_work(self):
        set_features(maintenance=True)
        api = self.api(self.client_user)

        blocked = api.post("/api/v1/households/", self.household_payload(), format="json")

        self.assertEqual(blocked.status_code, 503)
        self.assertTrue(blocked.json()["maintenance"])
        self.assertIn("mantenimiento", blocked.json()["detail"])
        self.assertEqual(api.get("/api/v1/households/").status_code, 200)
        self.assertEqual(self.api().post("/api/v1/auth/register/", {}, format="json").status_code, 503)

    def test_staff_and_allowed_ips_keep_working(self):
        set_features(maintenance=True)
        set_section("maintenance", ips=["10.1.1.1"])

        staff = self.api(self.staff).post("/api/v1/households/", self.household_payload(), format="json")
        allowed = self.api(self.client_user, REMOTE_ADDR="10.1.1.1").post(
            "/api/v1/households/", self.household_payload(), format="json"
        )

        self.assertNotEqual(staff.status_code, 503)
        self.assertNotEqual(allowed.status_code, 503)

    def test_login_and_admin_routes_are_not_cut_by_the_middleware(self):
        set_features(maintenance=True)

        login = self.api().post("/api/v1/auth/token/", {"username": "c", "password": "mala"}, format="json")
        reset = self.api().post("/api/v1/auth/password-reset/request/", {"email": "c@x.co"}, format="json")

        self.assertNotEqual(login.status_code, 503)
        self.assertNotEqual(reset.status_code, 503)
        self.assertEqual(self.api(self.staff).post(
            "/api/v1/admin/system-action/", {"action": "toggle_maintenance", "enabled": False}, format="json"
        ).status_code, 200)

    def test_everything_works_when_maintenance_is_off(self):
        response = self.api(self.client_user).post("/api/v1/households/", self.household_payload(), format="json")

        self.assertNotEqual(response.status_code, 503)


class FeatureSwitchTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(email="c@x.co", username="c", password=PASSWORD, role=UserRole.CLIENT)

    def api(self):
        client = APIClient()
        client.force_authenticate(self.client_user)
        return client

    def test_disabled_pqr_blocks_problem_reports(self):
        set_features(pqr=False)

        response = self.api().post("/api/v1/app-problems/", {"title": "x", "description": "y"}, format="json")

        self.assertEqual(response.status_code, 403)

    def test_problem_reports_can_be_created_when_pqr_is_enabled(self):
        response = self.api().post("/api/v1/app-problems/", {"title": "x", "description": "No carga el mapa"}, format="json")

        self.assertEqual(response.status_code, 201, response.content)

    def test_disabled_benefits_block_redemptions_but_not_history(self):
        pro_user = User.objects.create_user(email="p@x.co", username="p", password=PASSWORD, role=UserRole.PROFESSIONAL)
        ProfessionalProfile.objects.create(user=pro_user, display_name="Pedro")
        api = APIClient()
        api.force_authenticate(pro_user)
        set_features(benefits=False)

        redeem = api.post("/api/v1/professionals/benefit-redemptions/", {"benefit_id": "a"}, format="json")
        history = api.get("/api/v1/professionals/benefit-redemptions/")

        self.assertEqual(redeem.status_code, 403)
        self.assertEqual(history.status_code, 200)

    def test_disabled_store_blocks_new_products(self):
        set_features(products=False)

        response = self.api().post("/api/v1/store/products/", {"title": "Taladro", "description": "d", "price": 1000, "category": "Herramientas", "city": "Bogotá"}, format="json")

        self.assertEqual(response.status_code, 403)


class EmailNotificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="c@x.co", username="c", password=PASSWORD, role=UserRole.CLIENT, first_name="Ana"
        )

    def notify(self):
        with self.captureOnCommitCallbacks(execute=True):
            Notification.objects.create(user=self.user, title="Pago recibido", text="Recibimos tu pago.")

    def test_notification_is_emailed_when_enabled(self):
        self.notify()

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["c@x.co"])
        self.assertIn("Recibimos tu pago.", mail.outbox[0].body)

    def test_no_email_when_feature_is_off(self):
        set_features(email_notifications=False)
        self.notify()

        self.assertEqual(len(mail.outbox), 0)

    def test_no_email_when_channel_is_off(self):
        set_section("notifications", email_enabled=False)
        self.notify()

        self.assertEqual(len(mail.outbox), 0)

    def test_admin_bell_notifications_without_user_are_not_emailed(self):
        with self.captureOnCommitCallbacks(execute=True):
            Notification.objects.create(title="Nueva queja", text="x")

        self.assertEqual(len(mail.outbox), 0)
