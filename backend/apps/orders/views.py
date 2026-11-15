import secrets
import math
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
import mimetypes

from django.http import FileResponse

from drf_spectacular.utils import extend_schema, OpenApiParameter

from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PlatformSettings

from .finance import apply_payment_update, compute_discount, record_declined_dev_payment
from .models import Order, Payment, Review, WorkEvidence
from .serializers import DemoPaymentSerializer, OrderCreateSerializer, OrderSerializer, ReviewSerializer, OrderTransitionSerializer, OrderPriceSerializer
from .services import InvalidTransition, confirm_development_payment, transition, set_final_price, is_assigned_professional, is_order_client, validate_price_range, price_bounds
from .wompi import build_checkout_url, verify_event, wompi_ready

PAY_AFTER_COMPLETION = "El pago se habilita cuando el profesional termina el trabajo."

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
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("professional__user", "service_request__household", "review").prefetch_related(
            "events", "work_evidence", "professional__services__service__category", "payments"
        )
        if getattr(user, "role", "") == "staff":
            return queryset
        if getattr(user, "is_professional", False):
            return queryset.filter(professional__user=user).exclude(client=user)
        return queryset.filter(client=user).exclude(professional__user=user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    @action(detail=True, methods=["post"], url_path="transition")
    def change_status(self, request, pk=None):
        order = self.get_object()
        payload = OrderTransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        try:
            order = transition(order, data.pop("status"), user=request.user, **data)
        except InvalidTransition as exc:
            return Response({"status": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="price")
    def price(self, request, pk=None):
        payload = OrderPriceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            order = set_final_price(self.get_object(), payload.validated_data["final_price"], request.user)
        except InvalidTransition as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="wompi-checkout")
    @transaction.atomic
    def wompi_checkout(self, request, pk=None):
        order = Order.objects.select_for_update().get(pk=self.get_object().pk)
        if not is_order_client(order, request.user):
            return Response({"detail": "Solo el cliente de la orden puede pagarla."}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_status != Order.PaymentStatus.PENDING:
            return Response({"detail": "La orden ya está pagada."}, status=status.HTTP_400_BAD_REQUEST)
        if order.status != Order.Status.COMPLETED:
            return Response({"detail": PAY_AFTER_COMPLETION}, status=status.HTTP_400_BAD_REQUEST)
        test_mode = PlatformSettings.test_payment_enabled()
        if not wompi_ready(test_mode):
            return Response({"detail": "Wompi no está configurado en el servidor."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        payments_cfg = PlatformSettings.load()["sections"].get("payments", {})
        if all(payments_cfg.get(f"{m}_enabled") is False for m in ("pse", "card", "transfer", "wallet")):
            return Response({"detail": "Los pagos en línea están desactivados por el administrador."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        amount = order.final_price
        if not amount:
            return Response({"detail": "El profesional debe registrar el valor final acordado antes de iniciar el pago."}, status=status.HTTP_400_BAD_REQUEST)
        missing_bounds = order.estimate_min is None or order.estimate_max is None
        order.estimate_min, order.estimate_max = price_bounds(order)
        try:
            validate_price_range(order, amount)
        except InvalidTransition as exc:
            return Response({"detail": str(exc)}, status=400)
        if missing_bounds:
            order.save(update_fields=["estimate_min", "estimate_max", "updated_at"])
        discount = compute_discount(amount)
        cents = int(((Decimal(amount) - discount) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if cents < 150000:
            return Response({"detail": "El monto mínimo de pago es $1.500 COP."}, status=status.HTTP_400_BAD_REQUEST)

        reference = f"SPX-{order.pk}-{secrets.token_hex(4)}"
        Payment.objects.create(
            order=order,
            client=request.user,
            reference=reference,
            amount_in_cents=cents,
            discount_amount=discount,
            currency="COP",
            test_mode=test_mode,
        )
        redirect_url = f"{settings.FRONTEND_URL}/cliente/historialpago?order={order.pk}" if settings.FRONTEND_URL else ""
        return Response(
            {
                "checkout_url": build_checkout_url(reference, cents, "COP", redirect_url, test_mode),
                "reference": reference,
                "amount_in_cents": cents,
            }
        )

    @action(detail=True, methods=["post"], url_path="confirm-demo-payment")
    def confirm_demo_payment(self, request, pk=None):
        if wompi_ready() and not settings.DEBUG and not PlatformSettings.test_payment_enabled():
            return Response({"detail": "El pago demo está deshabilitado."}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        if not is_order_client(order, request.user):
            return Response(
                {"detail": "Solo el cliente de la orden puede confirmar el pago."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if order.payment_status == Order.PaymentStatus.PENDING and order.status != Order.Status.COMPLETED:
            return Response({"detail": PAY_AFTER_COMPLETION}, status=status.HTTP_400_BAD_REQUEST)
        payload = DemoPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        if order.payment_status == Order.PaymentStatus.PENDING and payload.simulate_decline:
            declined = record_declined_dev_payment(order, user=request.user, method=payload.payment_method)
            return Response(
                {
                    "detail": "Pago rechazado. Verifica los datos o intenta con otro medio de pago.",
                    "payment_status": "declined",
                    "reference": declined.reference,
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        order = confirm_development_payment(order, user=request.user, method=payload.payment_method)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="location")
    def update_location(self, request, pk=None):
        order = self.get_object()
        if not is_assigned_professional(order, request.user):
            return Response({"detail": "Solo el profesional puede actualizar su ubicacion."}, status=403)
        if order.status != Order.Status.TRAVELING or order.service_request.status != "accepted":
            return Response({"detail": "La ubicación solo se comparte durante el desplazamiento."}, status=400)
        try:
            order.professional_latitude = float(request.data["latitude"])
            order.professional_longitude = float(request.data["longitude"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "latitude y longitude son obligatorios."}, status=400)
        if not (math.isfinite(order.professional_latitude) and math.isfinite(order.professional_longitude)
                and -90 <= order.professional_latitude <= 90 and -180 <= order.professional_longitude <= 180):
            return Response({"detail": "Las coordenadas no son válidas."}, status=400)
        order.save(update_fields=["professional_latitude", "professional_longitude", "updated_at"])
        if order.professional:
            order.professional.latitude = order.professional_latitude
            order.professional.longitude = order.professional_longitude
            order.professional.save(update_fields=["latitude", "longitude"])
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="evidence")
    def add_evidence(self, request, pk=None):
        order = self.get_object()
        if not is_assigned_professional(order, request.user):
            return Response({"detail": "Solo el profesional puede subir evidencia."}, status=403)
        if order.status in {Order.Status.REQUESTED, Order.Status.COMPLETED, Order.Status.CANCELLED}:
            return Response({"detail": "Esta orden no permite adjuntar evidencias."}, status=400)
        if not request.FILES.get("image"):
            return Response({"detail": "La foto es obligatoria."}, status=400)
        WorkEvidence.objects.create(order=order, image=request.FILES["image"], caption=request.data.get("caption", ""))
        # El queryset precarga evidencias: descartar esa lista anterior a la subida.
        getattr(order, "_prefetched_objects_cache", {}).pop("work_evidence", None)
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
        if payment.status in (Payment.Status.APPROVED, Payment.Status.REFUNDED):
            return Response({"detail": "Pago ya registrado."})
        if tx.get("amount_in_cents") != payment.amount_in_cents or tx.get("currency") != payment.currency:
            payment.status = Payment.Status.ERROR
            payment.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Monto no coincide."})

        apply_payment_update(
            payment,
            new_status,
            transaction_id=tx.get("id", ""),
            method=tx.get("payment_method_type", ""),
        )
        return Response({"detail": "Evento procesado."})
