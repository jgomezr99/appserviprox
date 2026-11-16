from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import UserRole

User = get_user_model()


class RegisterAdminWorkerViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/admin/register-worker/"

    def test_rejects_invalid_worker_key(self):
        payload = {
            "worker_key": "wrong_key",
            "username": "worker1",
            "full_name": "Juan Perez",
            "email": "worker1@serviprox.com",
            "password": "Password123*",
            "area": "Defensoría",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Clave de trabajador incorrecta", res.data["detail"])

    def test_creates_admin_worker_successfully(self):
        payload = {
            "worker_key": "Juanpablo9*",
            "username": "admin_juanpablo",
            "full_name": "Juan Pablo Gómez",
            "email": "juanpablo.admin@serviprox.com",
            "phone": "3109876543",
            "password": "Password123*",
            "area": "Defensoría y Mesa Técnica",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["user"]["username"], "admin_juanpablo")
        self.assertEqual(res.data["user"]["role"], UserRole.STAFF)
        self.assertTrue(res.data["user"]["is_staff"])

        # Verificar que se creó y guardó en la base de datos
        user = User.objects.get(username="admin_juanpablo")
        self.assertEqual(user.email, "juanpablo.admin@serviprox.com")
        self.assertEqual(user.first_name, "Juan")
        self.assertEqual(user.last_name, "Pablo Gómez")
        self.assertEqual(user.phone, "3109876543")
        self.assertEqual(user.role, UserRole.STAFF)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("Password123*"))

        # Verificar que puede iniciar sesión (login) con usuario y contraseña
        login_res = self.client.post(
            "/api/v1/auth/token/",
            {"username": "admin_juanpablo", "password": "Password123*"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_res.data)

        # También verificar que puede iniciar sesión usando su correo electrónico
        login_email_res = self.client.post(
            "/api/v1/auth/token/",
            {"username": "juanpablo.admin@serviprox.com", "password": "Password123*"},
            format="json",
        )
        self.assertEqual(login_email_res.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_email_res.data)

    def test_promotes_existing_user_to_admin(self):
        User.objects.create_user(
            username="existing_client",
            email="existing_client@serviprox.com",
            password="OldPassword123*",
            role=UserRole.CLIENT,
            is_staff=False,
            is_superuser=False,
        )

        # Autorización por chat promueve el usuario a staff y superuser
        res = self.client.post(
            self.url,
            {
                "worker_key": "Juanpablo9*",
                "username": "existing_client",
                "full_name": "Nombre Actualizado",
                "email": "existing_client@serviprox.com",
                "password": "NewPassword123*",
                "area": "Defensoría y Mesa Técnica",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])

        updated_user = User.objects.get(username="existing_client")
        self.assertEqual(updated_user.role, UserRole.STAFF)
        self.assertTrue(updated_user.is_staff)
        self.assertTrue(updated_user.is_superuser)
