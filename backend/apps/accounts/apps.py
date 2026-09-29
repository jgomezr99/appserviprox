from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Cuentas"

    def ready(self):
        from django.db.backends.signals import connection_created
        from django.dispatch import receiver

        @receiver(connection_created)
        def _configure_sqlite_wal(sender, connection, **kwargs):
            if connection.vendor == "sqlite":
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("PRAGMA journal_mode = WAL;")
                        cursor.execute("PRAGMA synchronous = NORMAL;")
                        cursor.execute("PRAGMA busy_timeout = 30000;")
                except Exception:
                    pass
