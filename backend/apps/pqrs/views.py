from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import PQRReport, PQRMessage, AppProblemReport
from .serializers import (
    PQRReportSerializer,
    PQRMessageSerializer,
    AppProblemReportSerializer,
)


class PQRViewSet(viewsets.ModelViewSet):
    queryset = PQRReport.objects.all().prefetch_related("messages")
    serializer_class = PQRReportSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        email = self.request.query_params.get("email")
        user = self.request.user
        if email:
            return qs.filter(Q(client__email__iexact=email) | Q(client_email__iexact=email))
        if user and user.is_authenticated:
            if user.is_staff:
                return qs
            return qs.filter(Q(client=user) | Q(client_email__iexact=user.email))
        return qs.none()

    def get_object(self):
        # Allow lookup by pk or by numeric id extracted from "pqr-123"
        pk = self.kwargs.get("pk", "")
        if isinstance(pk, str) and pk.startswith("pqr-"):
            num_part = pk.replace("pqr-", "")
            if num_part.isdigit():
                return PQRReport.objects.prefetch_related("messages").get(id=int(num_part))
        return super().get_object()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        extra_kwargs = {}
        client_email = serializer.validated_data.get("client_email")
        if not user and client_email:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            found_user = User.objects.filter(email__iexact=client_email).first()
            if found_user:
                extra_kwargs["client"] = found_user
                if not serializer.validated_data.get("client_name"):
                    full_name = f"{found_user.first_name} {found_user.last_name}".strip()
                    if full_name:
                        extra_kwargs["client_name"] = full_name
                if not serializer.validated_data.get("client_phone") and found_user.phone:
                    extra_kwargs["client_phone"] = found_user.phone
                if not serializer.validated_data.get("client_document_id") and getattr(found_user, "document_id", None):
                    extra_kwargs["client_document_id"] = found_user.document_id
                if not serializer.validated_data.get("client_address") and getattr(found_user, "address", None):
                    extra_kwargs["client_address"] = found_user.address

        if user:
            extra_kwargs["client"] = user
            full_name = f"{user.first_name} {user.last_name}".strip()
            if not serializer.validated_data.get("client_name") and full_name:
                extra_kwargs["client_name"] = full_name
            if not serializer.validated_data.get("client_phone") and user.phone:
                extra_kwargs["client_phone"] = user.phone
            if not serializer.validated_data.get("client_email") and user.email:
                extra_kwargs["client_email"] = user.email
            if not serializer.validated_data.get("client_document_id") and getattr(user, "document_id", None):
                extra_kwargs["client_document_id"] = user.document_id
            if not serializer.validated_data.get("client_address") and getattr(user, "address", None):
                extra_kwargs["client_address"] = user.address

        # Resolve contractor FK to ProfessionalProfile in database
        contractor_ref = str(serializer.validated_data.get("contractor_id_ref", ""))
        from apps.professionals.models import ProfessionalProfile
        prof = None
        if contractor_ref:
            if contractor_ref.isdigit():
                prof = ProfessionalProfile.objects.filter(id=int(contractor_ref)).first()
            if not prof:
                prof = ProfessionalProfile.objects.filter(slug=contractor_ref).first()
            if not prof:
                contractor_name = serializer.validated_data.get("contractor_name", "")
                if contractor_name:
                    prof = ProfessionalProfile.objects.filter(display_name__icontains=contractor_name).first()
        if prof:
            extra_kwargs["contractor"] = prof
            if not serializer.validated_data.get("contractor_name"):
                extra_kwargs["contractor_name"] = prof.display_name
            if not serializer.validated_data.get("contractor_company") and prof.headline:
                extra_kwargs["contractor_company"] = prof.headline
            if not serializer.validated_data.get("contractor_specialty") and prof.specialty_label:
                extra_kwargs["contractor_specialty"] = prof.specialty_label
            if not serializer.validated_data.get("contractor_avatar") and prof.avatar_url:
                extra_kwargs["contractor_avatar"] = prof.avatar_url

        pqr = serializer.save(**extra_kwargs)
        # Create initial system notification message
        PQRMessage.objects.create(
            pqr=pqr,
            sender="system",
            sender_name="Servicio Contratista Bogotá",
            sender_role="Sistema de Radicación Oficial",
            text=f"Radicado formal {pqr.radicado_number} registrado ante la Defensoría del Consumidor (Ley 1480). El contratista {pqr.contractor_company} ha sido notificado para descargos (48h hábiles).",
        )

    @action(detail=True, methods=["post"], url_path="messages")
    def add_message(self, request, pk=None):
        pqr = self.get_object()
        text = request.data.get("text", "").strip()
        if not text:
            return Response({"error": "El mensaje no puede estar vacío."}, status=status.HTTP_400_BAD_REQUEST)

        sender = request.data.get("sender", "client")
        user = request.user if request.user.is_authenticated else None
        default_sender = (user.get_full_name() or user.username) if user else (pqr.client_name or "Cliente")
        sender_name = request.data.get("senderName", request.data.get("sender_name", default_sender))
        sender_role = request.data.get("senderRole", request.data.get("sender_role", "Cliente"))

        msg = PQRMessage.objects.create(
            pqr=pqr,
            sender=sender,
            sender_name=sender_name,
            sender_role=sender_role,
            text=text,
        )

        return Response(PQRMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_pqr(self, request, pk=None):
        pqr = self.get_object()
        pqr.status = "resuelto"
        pqr.admin_resolution_notes = "Desistimiento voluntario por parte del usuario."
        pqr.save()
        return Response(PQRReportSerializer(pqr).data)


class AppProblemViewSet(viewsets.ModelViewSet):
    queryset = AppProblemReport.objects.all()
    serializer_class = AppProblemReportSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        email = self.request.query_params.get("email")
        user = self.request.user
        if email:
            return qs.filter(Q(user__email__iexact=email) | Q(user_email__iexact=email))
        if user and user.is_authenticated:
            if user.is_staff:
                return qs
            return qs.filter(Q(user=user) | Q(user_email__iexact=user.email))
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        extra = {}
        user_email = serializer.validated_data.get("user_email")

        if not user and user_email:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            found_user = User.objects.filter(email__iexact=user_email).first()
            if found_user:
                extra["user"] = found_user
                if not serializer.validated_data.get("reported_by"):
                    full_name = found_user.get_full_name() or found_user.username
                    if full_name:
                        extra["reported_by"] = full_name

        if user:
            extra["user"] = user
            if user.email and not user_email:
                extra["user_email"] = user.email
            full_name = user.get_full_name() or user.username
            if not serializer.validated_data.get("reported_by") and full_name:
                extra["reported_by"] = full_name

        serializer.save(**extra)

