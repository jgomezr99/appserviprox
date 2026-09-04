from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User, UserRole
from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


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
        return Response(serializer.data)


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
