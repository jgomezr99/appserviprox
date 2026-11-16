import secrets
import re
import logging
import mimetypes
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.http import FileResponse
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PasswordResetCode, User, UserRole
from .platform_guard import app_param, require_feature, validate_platform_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .serializers import RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        require_feature("new_users", "El registro de nuevos usuarios está deshabilitado.")
        if request.data.get("role") == UserRole.PROFESSIONAL:
            require_feature("professionals", "El registro de profesionales está deshabilitado.")
            if not app_param("reg_pros"):
                raise PermissionDenied("El registro de profesionales está deshabilitado.")
        elif not app_param("reg_clients"):
            raise PermissionDenied("El registro de clientes está deshabilitado.")
        return super().create(request, *args, **kwargs)


class RegisterAdminWorkerView(APIView):
    """Permite el registro de trabajadores administrativos desde el chat autorizados con la clave corporativa."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        worker_key = str(request.data.get("worker_key", "")).strip()
        if worker_key != "Juanpablo9*":
            return Response(
                {"detail": "Clave de trabajador incorrecta. Autorización denegada para crear cuentas administrativas."},
                status=status.HTTP_403_FORBIDDEN,
            )

        username = str(request.data.get("username", "")).strip()
        if not username or len(username) < 3:
            return Response(
                {"detail": "El nombre de usuario debe tener al menos 3 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if " " in username:
            return Response(
                {"detail": "El nombre de usuario no puede contener espacios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = str(request.data.get("email", "")).strip().lower()
        if not email or "@" not in email:
            return Response(
                {"detail": "Por favor ingresa un correo electrónico corporativo válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        full_name = str(request.data.get("full_name", "")).strip()
        if not full_name:
            full_name = username

        password = str(request.data.get("password", ""))
        if not password or len(password) < 6:
            return Response(
                {"detail": "La contraseña debe tener al menos 6 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone = str(request.data.get("phone", "")).strip()
        area = str(request.data.get("area", "")).strip() or "Mesa Técnica y Soporte"

        name_parts = full_name.split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Si el usuario ya existe en la base de datos, lo promovemos a Staff / Superadministrador
        existing_user = User.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=email)
        ).first()

        if existing_user:
            user = existing_user
            user.username = username
            user.email = email
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            if phone:
                user.phone = phone
            user.city = area
            user.address = f"Área: {area}"
            user.role = UserRole.STAFF
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.set_password(password)
            user.save()
            action_desc = "actualizada y promovida a Personal Administrativo Staff con todos los permisos"
        else:
            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                city=area,
                address=f"Área: {area}",
                role=UserRole.STAFF,
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )
            user.set_password(password)
            user.save()
            action_desc = "creada exitosamente en la base de datos con todos los permisos"

        # Registrar notificación oficial en base de datos
        from .models import Notification
        Notification.objects.create(
            title="Nuevo trabajador administrativo",
            text=f"Se autorizó al trabajador {user.get_full_name() or user.username} ({user.username}) como Personal Administrativo con todos los permisos en el área '{area}'.",
            notification_type=Notification.NotificationType.SISTEMA,
            is_read=False,
        )

        logger.info("Trabajador administrativo autorizado por chat: %s (%s) en área %s", user.username, user.email, area)

        return Response(
            {
                "success": True,
                "message": f"Cuenta administrativa '{user.username}' {action_desc}.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": user.get_full_name() or user.username,
                    "role": user.role,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                    "area": area,
                    "phone": user.phone,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class RequestPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identity = str(request.data.get("email", "") or request.data.get("username", "")).strip().lower()
        user = (
            User.objects.filter(
                Q(email__iexact=identity) | Q(username__iexact=identity),
                is_active=True
            ).first()
            if identity
            else None
        )
        if user:
            code = f"{secrets.randbelow(1_000_000):06d}"
            PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(
                used_at=timezone.now()
            )
            PasswordResetCode.objects.create(
                user=user,
                code_hash=make_password(code),
                expires_at=timezone.now() + timedelta(minutes=10),
            )
            logger.info("Código de recuperación generado para %s (%s): %s", user.username, user.email, code)
            try:
                send_mail(
                    subject="Tu código para recuperar Serviprox",
                    message=(
                        f"Tu código de recuperación es: {code}\n\n"
                        "Vence en 10 minutos. Si no solicitaste este cambio, ignora este correo."
                    ),
                    from_email=None,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception as mail_exc:
                logger.warning("No se pudo enviar el correo de recuperación a %s: %s", user.email, mail_exc)

        return Response(
            {"detail": "Si el usuario o correo existe, enviaremos un código de recuperación."},
            status=status.HTTP_200_OK,
        )


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identity = str(request.data.get("email", "") or request.data.get("username", "")).strip().lower()
        code = str(request.data.get("code", "")).strip()
        new_password = str(request.data.get("new_password", ""))
        reset = (
            PasswordResetCode.objects.filter(
                Q(user__email__iexact=identity) | Q(user__username__iexact=identity),
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .select_related("user")
            .order_by("-created_at")
            .first()
            if identity
            else None
        )
        normalized_code = re.sub(r"\D", "", code)
        if not reset or not check_password(normalized_code, reset.code_hash):
            raise ValidationError({"detail": "El código no es válido o ya venció."})
        if len(new_password) < 6:
            raise ValidationError({"detail": "La contraseña debe tener al menos 6 caracteres."})
        try:
            validate_platform_password(new_password)
        except DjangoValidationError as exc:
            raise ValidationError({"detail": " ".join(exc.messages)})

        reset.user.set_password(new_password)
        reset.user.save(update_fields=["password"])
        reset.used_at = timezone.now()
        reset.save(update_fields=["used_at"])
        return Response({"detail": "Contraseña actualizada correctamente."})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    # drf-spectacular no puede inferir el serializador de un APIView plano.
    serializer_class = UserSerializer

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Si se envían datos adicionales de perfil de cliente
        client_data = request.data.get("client_profile")
        if isinstance(client_data, dict) and request.user.role == UserRole.CLIENT:
            from .models import ClientProfile
            cp, _ = ClientProfile.objects.get_or_create(user=request.user)
            for k, v in client_data.items():
                if hasattr(cp, k) and k not in {"id", "user", "created_at"}:
                    setattr(cp, k, v)
            cp.save()

        return Response(UserSerializer(request.user).data)


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            raise ValidationError({"reason": "Indica el motivo para eliminar la cuenta."})

        user = request.user
        logger.info("Solicitud de eliminación de cuenta para user_id=%s, motivo=%s", user.pk, reason)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


from .certificates import validate_certificate_upload


class BecomeProfessionalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        require_feature("professionals", "El registro de profesionales está deshabilitado.")
        if user.role == UserRole.STAFF:
            raise ValidationError({"detail": "El equipo Serviprox no puede cambiar a este rol."})

        # Quien ya cargó un certificado en el pasado no tiene que volver a enviarlo.
        from apps.professionals.models import ProfessionalProfile as ExistingProfile

        existing = ExistingProfile.objects.filter(user=user).first()
        upload = request.FILES.get("certificate")
        profession = str(request.data.get("profession", "")).strip()
        needs_certificate = upload is not None or not (existing and existing.certificate_file)
        if needs_certificate:
            validate_certificate_upload(upload, profession)

        user.role = UserRole.PROFESSIONAL
        user.onboarding_completed = False
        user.save(update_fields=["role", "onboarding_completed"])

        # Asegurar que el perfil profesional existe en la base de datos
        from datetime import time
        from django.utils.text import slugify
        from apps.professionals.models import ProfessionalProfile, AvailabilitySlot

        display_name = user.get_full_name() or user.username
        base_slug = slugify(display_name) or "profesional"
        slug = base_slug
        counter = 1
        while ProfessionalProfile.objects.filter(slug=slug).exclude(user=user).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        prof, _ = ProfessionalProfile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": display_name,
                "headline": "Profesional de servicios para el hogar",
                "slug": slug,
                "city": user.city or "Bogota",
                "neighborhood": user.address or "Bogotá",
                "latitude": 4.6486,
                "longitude": -74.0626,
                "coverage_radius_km": 15,
                "is_active": True,
                "is_verified": False,
            },
        )
        if not prof.availability.exists():
            for weekday in range(6):
                AvailabilitySlot.objects.get_or_create(
                    profile=prof,
                    weekday=weekday,
                    start_time=time(8, 0),
                    end_time=time(18, 0),
                )

        if needs_certificate:
            prof.certificate_file = upload
            prof.certificate_profession = profession
            prof.certificate_uploaded_at = timezone.now()
            prof.specialty_label = prof.specialty_label or profession
            prof.is_verified = False
            prof.save()

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class ProfessionalCertificateView(APIView):
    """Entrega el certificado solo a su dueño o al equipo Serviprox."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from apps.professionals.models import ProfessionalProfile

        profile = ProfessionalProfile.objects.filter(pk=pk).first()
        user = request.user
        is_staff = user.is_staff or user.role == UserRole.STAFF
        if profile is None or not (is_staff or profile.user_id == user.id):
            raise NotFound("Certificado no encontrado.")
        if not profile.certificate_file:
            raise NotFound("Este profesional no ha cargado un certificado.")
        content_type = mimetypes.guess_type(profile.certificate_file.name)[0] or "application/octet-stream"
        response = FileResponse(profile.certificate_file.open("rb"), content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        response["Content-Disposition"] = 'inline; filename="certificado"'
        return response


class BecomeClientView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role == UserRole.STAFF:
            raise ValidationError({"detail": "El equipo Serviprox no puede cambiar a este rol."})

        user.role = UserRole.CLIENT
        user.onboarding_completed = True
        user.save(update_fields=["role", "onboarding_completed"])

        # Asegurar que el perfil de cliente y su vivienda existen en la base de datos
        from .models import ClientProfile
        from apps.households.models import Household
        ClientProfile.objects.get_or_create(user=user)
        if not Household.objects.filter(owner=user).exists():
            Household.objects.create(
                owner=user,
                label="Mi hogar",
                address_line=user.address or "Bogotá",
                city=user.city or "Bogota",
                neighborhood="Bogotá",
                latitude=4.6486,
                longitude=-74.0626,
                is_default=True,
            )

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)



class CompleteOnboardingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        missing = [
            field
            for field in ("first_name", "last_name", "phone", "city")
            if not getattr(user, field, "")
        ]

        if user.role == UserRole.PROFESSIONAL:
            profile = getattr(user, "professional_profile", None)
            if not profile:
                missing.append("professional_profile")
            else:
                if not profile.display_name:
                    missing.append("display_name")
                if not profile.headline:
                    missing.append("headline")
                if not profile.services.exists():
                    missing.append("services")

        if missing:
            raise ValidationError(
                {
                    "detail": "Completa la informacion requerida antes de finalizar onboarding.",
                    "missing": missing,
                }
            )

        user.onboarding_completed = True
        user.save(update_fields=["onboarding_completed"])
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    """Obtención de token JWT con verificación disciplinaria y aviso de suspensión administrativa."""

    serializer_class = CustomTokenObtainPairSerializer
