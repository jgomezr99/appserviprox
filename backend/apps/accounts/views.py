import secrets
import re
import logging
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PasswordResetCode, User, UserRole
from .serializers import RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class RequestPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
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
            send_mail(
                subject="Tu código para recuperar Serviprox",
                message=(
                    f"Tu código de recuperación es: {code}\n\n"
                    "Vence en 10 minutos. Si no solicitaste este cambio, ignora este correo."
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response(
            {"detail": "Si el correo existe, enviaremos un código de recuperación."},
            status=status.HTTP_200_OK,
        )


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        code = str(request.data.get("code", "")).strip()
        new_password = str(request.data.get("new_password", ""))
        reset = (
            PasswordResetCode.objects.filter(
                user__email__iexact=email,
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .select_related("user")
            .order_by("-created_at")
            .first()
        )
        normalized_code = re.sub(r"\D", "", code)
        if not reset or not check_password(normalized_code, reset.code_hash):
            raise ValidationError({"detail": "El código no es válido o ya venció."})
        if len(new_password) < 6:
            raise ValidationError({"detail": "La contraseña debe tener al menos 6 caracteres."})

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


class BecomeProfessionalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role == UserRole.STAFF:
            raise ValidationError({"detail": "El equipo Serviprox no puede cambiar a este rol."})

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

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


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
