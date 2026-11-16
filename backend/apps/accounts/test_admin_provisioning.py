from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.accounts.models import User, UserRole


class AdminProvisioningTests(TestCase):
    def test_createsuperuser_receives_staff_role(self):
        user = User.objects.create_superuser(
            username="root",
            email="root@example.com",
            password="test-password",
        )

        self.assertEqual(user.role, UserRole.STAFF)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_command_promotes_existing_account_without_resetting_password(self):
        user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="existing-password",
        )

        call_command(
            "promote_serviprox_admin",
            "admin",
            "--confirm",
            stdout=StringIO(),
        )
        user.refresh_from_db()

        self.assertEqual(user.role, UserRole.STAFF)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("existing-password"))

    def test_command_requires_explicit_confirmation(self):
        User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="existing-password",
        )

        with self.assertRaises(CommandError):
            call_command("promote_serviprox_admin", "admin", stdout=StringIO())

    @patch("apps.accounts.management.commands.promote_serviprox_admin.getpass")
    def test_command_can_reset_password_without_storing_it_in_arguments(self, prompt):
        user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="existing-password",
        )
        prompt.side_effect = ["A-new-unique-password-2026!", "A-new-unique-password-2026!"]

        call_command(
            "promote_serviprox_admin",
            "admin",
            "--confirm",
            "--reset-password",
            stdout=StringIO(),
        )
        user.refresh_from_db()

        self.assertTrue(user.check_password("A-new-unique-password-2026!"))
