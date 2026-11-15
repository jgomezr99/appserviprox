import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.professionals.models import ProfessionalProfile

PASSWORD = "Become-Pro-Test-81!"
PDF = b"%PDF-1.4 certificado de prueba"
URL = "/api/v1/auth/become-professional/"


class BecomeProfessionalCertificateTests(TestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)

        self.user = User.objects.create_user(
            email="cliente@cert.example", username="cert-client", password=PASSWORD, role=UserRole.CLIENT
        )
        self.staff = User.objects.create_user(
            email="staff@cert.example", username="cert-staff", password=PASSWORD, role=UserRole.STAFF
        )
        self.stranger = User.objects.create_user(
            email="otro@cert.example", username="cert-other", password=PASSWORD, role=UserRole.CLIENT
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def upload(self, name="titulo.pdf", content=PDF, **extra):
        data = {"profession": "Electricista", "certificate": SimpleUploadedFile(name, content)}
        data.update(extra)
        return self.api.post(URL, data, format="multipart")

    def test_certificate_and_profession_are_required(self):
        response = self.api.post(URL, {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("certificate", response.data)
        self.assertIn("profession", response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, UserRole.CLIENT)
        self.assertFalse(ProfessionalProfile.objects.filter(user=self.user).exists())

    def test_rejects_wrong_type_fake_content_and_large_files(self):
        self.assertEqual(self.upload("virus.exe", b"MZ\x90\x00").status_code, 400)
        self.assertEqual(self.upload("falso.pdf", b"no soy un pdf").status_code, 400)
        self.assertEqual(self.upload("grande.pdf", PDF + b"0" * (5 * 1024 * 1024)).status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, UserRole.CLIENT)

    def test_valid_certificate_switches_role_and_stores_file(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["role"], UserRole.PROFESSIONAL)
        self.assertTrue(response.data["has_professional_certificate"])
        profile = ProfessionalProfile.objects.get(user=self.user)
        self.assertEqual(profile.certificate_profession, "Electricista")
        self.assertFalse(profile.is_verified)

    def test_returning_professional_does_not_need_a_new_certificate(self):
        self.assertEqual(self.upload().status_code, 200)
        self.api.post("/api/v1/auth/become-client/")
        again = self.api.post(URL)
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(again.data["role"], UserRole.PROFESSIONAL)

    def test_only_owner_and_staff_can_download_certificate(self):
        self.upload()
        profile = ProfessionalProfile.objects.get(user=self.user)
        url = f"/api/v1/professionals/{profile.id}/certificate/"

        owner_response = self.api.get(url)
        self.assertEqual(owner_response.status_code, 200)
        self.assertEqual(b"".join(owner_response.streaming_content), PDF)
        staff = APIClient()
        staff.force_authenticate(user=self.staff)
        staff_response = staff.get(url)
        self.assertEqual(staff_response.status_code, 200)
        self.assertEqual(b"".join(staff_response.streaming_content), PDF)
        stranger = APIClient()
        stranger.force_authenticate(user=self.stranger)
        self.assertEqual(stranger.get(url).status_code, 404)
        self.assertEqual(APIClient().get(url).status_code, 401)

    def register(self, **extra):
        data = {
            "email": "nuevo@cert.example",
            "username": "nuevo.pro",
            "role": UserRole.PROFESSIONAL,
            "password": PASSWORD,
        }
        data.update(extra)
        return APIClient().post("/api/v1/auth/register/", data, format="multipart")

    def test_professional_registration_requires_certificate(self):
        response = self.register()
        self.assertEqual(response.status_code, 400)
        self.assertIn("certificate", response.data)
        self.assertFalse(User.objects.filter(email="nuevo@cert.example").exists())

        fake = self.register(profession="Plomero", certificate=SimpleUploadedFile("falso.pdf", b"nada"))
        self.assertEqual(fake.status_code, 400)

    def test_professional_registration_stores_certificate(self):
        response = self.register(profession="Plomero", certificate=SimpleUploadedFile("t.pdf", PDF))
        self.assertEqual(response.status_code, 201, response.data)
        profile = ProfessionalProfile.objects.get(user__email="nuevo@cert.example")
        self.assertEqual(profile.certificate_profession, "Plomero")
        self.assertTrue(profile.certificate_file)
        self.assertFalse(profile.is_verified)

    def test_client_registration_does_not_need_certificate(self):
        response = self.register(role=UserRole.CLIENT, email="cli@cert.example", username="cli.nuevo")
        self.assertEqual(response.status_code, 201, response.data)
