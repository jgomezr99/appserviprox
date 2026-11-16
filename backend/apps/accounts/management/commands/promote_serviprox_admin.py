from getpass import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.accounts.models import UserRole


class Command(BaseCommand):
    help = "Habilita una cuenta existente como personal administrativo de Serviprox."

    def add_arguments(self, parser):
        parser.add_argument("identity", help="Correo o nombre de usuario de la cuenta")
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Confirma explícitamente la asignación del rol administrativo",
        )
        parser.add_argument(
            "--superuser",
            action="store_true",
            help="Concede también permisos de superusuario",
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Solicita una contraseña nueva sin mostrarla en pantalla",
        )

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError("Agrega --confirm para habilitar permisos administrativos.")

        User = get_user_model()
        identity = options["identity"].strip()
        matches = list(
            User.objects.filter(
                Q(username__iexact=identity) | Q(email__iexact=identity)
            )[:2]
        )
        if not matches:
            raise CommandError("No se encontró una cuenta con ese correo o usuario.")
        if len(matches) > 1:
            raise CommandError("La cuenta es ambigua; usa su correo exacto.")

        user = matches[0]
        if options["reset_password"]:
            password = getpass("Nueva contraseña: ")
            confirmation = getpass("Confirma la nueva contraseña: ")
            if not password or password != confirmation:
                raise CommandError("Las contraseñas no coinciden o están vacías.")
            try:
                validate_password(password, user=user)
            except ValidationError as error:
                raise CommandError("; ".join(error.messages)) from error
            user.set_password(password)

        user.role = UserRole.STAFF
        user.is_staff = True
        if options["superuser"]:
            user.is_superuser = True
        update_fields = ["role", "is_staff", "is_superuser"]
        if options["reset_password"]:
            update_fields.append("password")
        user.save(update_fields=update_fields)

        self.stdout.write(
            self.style.SUCCESS(
                f"Cuenta {user.username} habilitada como personal administrativo."
            )
        )
