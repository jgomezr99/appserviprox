from unittest.mock import patch

from django.test import SimpleTestCase

from .platform_guard import lock_key, lockout_policy, register_failed_login


class LoginLockoutPolicyTests(SimpleTestCase):
    @patch("apps.accounts.platform_guard.PlatformSettings.load")
    def test_default_lockout_is_two_minutes(self, load_settings):
        load_settings.return_value = {"sections": {}}

        self.assertEqual(lockout_policy(), (5, 2))

    def test_failed_login_uses_two_minute_lock_timeout(self):
        identity = "client@example.com"
        settings = {"sections": {"security": {"max_attempts": "1", "lock": "2 minutos"}}}

        with (
            patch("apps.accounts.platform_guard.PlatformSettings.load", return_value=settings),
            patch("apps.accounts.platform_guard.cache.get", return_value=0),
            patch("apps.accounts.platform_guard.cache.set") as set_cache,
        ):
            register_failed_login(identity)

        set_cache.assert_called_once_with(lock_key(identity), True, 120)
