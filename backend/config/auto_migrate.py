"""Aplica migraciones pendientes en desarrollo local (SQLite) para que la API no falle tras actualizar el código."""
import logging
import threading

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

logger = logging.getLogger(__name__)
_lock = threading.Lock()


def pending_migrations() -> list:
    executor = MigrationExecutor(connection)
    return executor.migration_plan(executor.loader.graph.leaf_nodes())


def apply_pending_migrations() -> bool:
    """Devuelve True si había migraciones pendientes y se aplicaron."""
    if not pending_migrations():
        return False
    logger.warning("Hay migraciones pendientes; aplicándolas automáticamente (modo desarrollo).")
    call_command("migrate", interactive=False, verbosity=0)
    return True


class AutoMigrateMiddleware:
    """Revisa una sola vez, en la primera petición, que la base de datos esté al día."""

    checked = False

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not AutoMigrateMiddleware.checked:
            with _lock:
                if not AutoMigrateMiddleware.checked:
                    try:
                        apply_pending_migrations()
                    except Exception:  # noqa: BLE001 - un fallo aquí no debe tumbar la API
                        logger.exception("No se pudieron aplicar las migraciones automáticamente.")
                    AutoMigrateMiddleware.checked = True
        return self.get_response(request)
