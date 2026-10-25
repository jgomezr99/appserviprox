import secrets
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
import mimetypes

from django.http import FileResponse

from drf_spectacular.utils import extend_schema, OpenApiParameter

from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.platform_views import IsPlatformStaff
from apps.accounts.models import PlatformSettings

from .models import Order, Payment, Review, WorkEvidence
from .serializers import OrderCreateSerializer, OrderSerializer, ReviewSerializer
from .services import InvalidTransition, confirm_development_payment, transition
from .wompi import build_checkout_url, verify_event, wompi_ready

WOMPI_STATUS = {
    "APPROVED": Payment.Status.APPROVED,
    "DECLINED": Payment.Status.DECLINED,
    "VOIDED": Payment.Status.VOIDED,
    "ERROR": Payment.Status.ERROR,
}


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("professional", "service_request").prefetch_related(
            "events", "professional__services__service__category"
        )
        if getattr(user, "role", "") == "staff":
            return queryset
        if getattr(user, "is_professional", False):
            return queryset.filter(professional__user=user)
        return queryset.filter(client=user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    @action(detail=True, methods=["post"], url_path="transition")
    def change_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in Order.Status.values:
            return Response(
                {"status": "Estado desconocido."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            order = transition(order, new_status, user=request.user, note=request.data.get("note", ""))
        except InvalidTransition as exc:
            return Response({"status": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="wompi-checkout")
    def wompi_checkout(self, request, pk=None):
        order = self.get_object()
        if order.client_id != request.user.id:
            return Response({"detail": "Solo el cliente de la orden puede pagarla."}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_status == Order.PaymentStatus.PAID:
            return Response({"detail": "La orden ya está pagada."}, status=status.HTTP_400_BAD_REQUEST)
        if not wompi_ready():
            return Response({"detail": "Wompi no está configurado en el servidor."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        payments_cfg = PlatformSettings.load()["sections"].get("payments", {})
        if all(payments_cfg.get(f"{m}_enabled") is False for m in ("pse", "card", "transfer", "wallet")):
            return Response({"detail": "Los pagos en línea están desactivados por el administrador."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        amount = order.final_price or order.estimate_max or order.estimate_min
        if not amount:
            return Response({"detail": "La orden aún no tiene un monto definido."}, status=status.HTTP_400_BAD_REQUEST)
        cents = int((Decimal(amount) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if cents < 150000:
            return Response({"detail": "El monto mínimo de pago es $1.500 COP."}, status=status.HTTP_400_BAD_REQUEST)

        reference = f"SPX-{order.pk}-{secrets.token_hex(4)}"
        Payment.objects.create(
            order=order, client=request.user, reference=reference, amount_in_cents=cents, currency="COP"
        )
        redirect_url = f"{settings.FRONTEND_URL}/cliente/historialpago?order={order.pk}" if settings.FRONTEND_URL else ""
        return Response(
            {
                "checkout_url": build_checkout_url(reference, cents, "COP", redirect_url),
                "reference": reference,
                "amount_in_cents": cents,
            }
        )

    @action(detail=True, methods=["post"], url_path="confirm-demo-payment")
    def confirm_demo_payment(self, request, pk=None):
        if wompi_ready() and not settings.DEBUG:
            return Response({"detail": "El pago demo está deshabilitado."}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        if order.client_id != request.user.id:
            return Response(
                {"detail": "Solo el cliente de la orden puede confirmar el pago."},
                status=status.HTTP_403_FORBIDDEN,
            )
        order = confirm_development_payment(order, user=request.user)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="location")
    def update_location(self, request, pk=None):
        order = self.get_object()
        if order.professional.user_id != request.user.id:
            return Response({"detail": "Solo el profesional puede actualizar su ubicacion."}, status=403)
        try:
            order.professional_latitude = float(request.data["latitude"])
            order.professional_longitude = float(request.data["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "latitude y longitude son obligatorios."}, status=400)
        order.save(update_fields=["professional_latitude", "professional_longitude", "updated_at"])
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="evidence")
    def add_evidence(self, request, pk=None):
        order = self.get_object()
        if order.professional.user_id != request.user.id:
            return Response({"detail": "Solo el profesional puede subir evidencia."}, status=403)
        if not request.FILES.get("image"):
            return Response({"detail": "La foto es obligatoria."}, status=400)
        WorkEvidence.objects.create(order=order, image=request.FILES["image"], caption=request.data.get("caption", ""))
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data, status=201)

    @extend_schema(parameters=[OpenApiParameter("evidence_id", int, location=OpenApiParameter.PATH)])
    @action(detail=True, methods=["get"], url_path=r"evidence/(?P<evidence_id>[^/.]+)")
    def evidence_image(self, request, pk=None, evidence_id=None):
        order = self.get_object()
        evidence = order.work_evidence.filter(pk=evidence_id).first()
        if evidence is None:
            return Response({"detail": "Imagen no encontrada."}, status=404)
        content_type = mimetypes.guess_type(evidence.image.name)[0] or "application/octet-stream"
        response = FileResponse(evidence.image.open("rb"), content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        return response


class ReviewViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    queryset = Review.objects.none()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(order__client=self.request.user)


class WompiEventsView(APIView):
    """Webhook de Wompi: confirma pagos solo si el checksum del evento es válido."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        body = request.data
        if not verify_event(body):
            return Response({"detail": "Firma inválida."}, status=status.HTTP_401_UNAUTHORIZED)
        if body.get("event") != "transaction.updated":
            return Response({"detail": "Evento ignorado."})

        tx = body.get("data", {}).get("transaction", {})
        payment = Payment.objects.select_for_update().filter(reference=tx.get("reference")).first()
        new_status = WOMPI_STATUS.get(tx.get("status"))
        if not payment or not new_status:
            return Response({"detail": "Sin cambios."})
        if payment.status == Payment.Status.APPROVED:
            return Response({"detail": "Pago ya registrado."})
        if tx.get("amount_in_cents") != payment.amount_in_cents or tx.get("currency") != payment.currency:
            payment.status = Payment.Status.ERROR
            payment.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Monto no coincide."})

        payment.status = new_status
        payment.wompi_transaction_id = str(tx.get("id", ""))[:80]
        payment.payment_method = str(tx.get("payment_method_type", ""))[:40]
        payment.save()

        if new_status == Payment.Status.APPROVED:
            order = Order.objects.select_for_update().get(pk=payment.order_id)
            order.payment_status = Order.PaymentStatus.PAID
            order.payment_confirmed_at = timezone.now()
            order.payment_reference = payment.reference
            order.save(update_fields=["payment_status", "payment_confirmed_at", "payment_reference", "updated_at"])
        return Response({"detail": "Evento procesado."})


class AdminPaymentListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        rows = Payment.objects.select_related("client", "order")[:20]
        return Response(
            [
                {
                    "id": p.id,
                    "date": p.created_at.isoformat(),
                    "reference": p.reference,
                    "method": p.payment_method or "—",
                    "user": (p.client.get_full_name() or p.client.email) if p.client else "—",
                    "amount": p.amount_in_cents / 100,
                    "status": p.status,
                    "status_label": p.get_status_display(),
                }
                for p in rows
            ]
        )
