from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase

from config import auto_migrate


class AutoMigrateTests(SimpleTestCase):
    def setUp(self):
        auto_migrate.AutoMigrateMiddleware.checked = False
        self.addCleanup(setattr, auto_migrate.AutoMigrateMiddleware, "checked", False)

    @patch("config.auto_migrate.call_command")
    @patch("config.auto_migrate.pending_migrations", return_value=[("orders.0010", False)])
    def test_applies_pending_migrations_once_on_first_request(self, pending, command):
        middleware = auto_migrate.AutoMigrateMiddleware(lambda request: "ok")
        request = RequestFactory().get("/")
        self.assertEqual(middleware(request), "ok")
        self.assertEqual(middleware(request), "ok")
        command.assert_called_once()
        self.assertEqual(pending.call_count, 1)

    @patch("config.auto_migrate.call_command")
    @patch("config.auto_migrate.pending_migrations", return_value=[])
    def test_does_nothing_when_database_is_up_to_date(self, pending, command):
        auto_migrate.AutoMigrateMiddleware(lambda request: "ok")(RequestFactory().get("/"))
        command.assert_not_called()

    @patch("config.auto_migrate.call_command", side_effect=RuntimeError("boom"))
    @patch("config.auto_migrate.pending_migrations", return_value=[("orders.0010", False)])
    def test_a_failed_migration_does_not_break_requests(self, pending, command):
        self.assertEqual(auto_migrate.AutoMigrateMiddleware(lambda request: "ok")(RequestFactory().get("/")), "ok")
