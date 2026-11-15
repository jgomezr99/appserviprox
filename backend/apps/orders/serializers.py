from decimal import Decimal

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone

from apps.professionals.serializers import ProfessionalListSerializer
from apps.professionals.models import ProfessionalService
from apps.accounts.models import UserRole
from apps.service_requests.models import ServiceRequest
from apps.service_requests.services import professional_offers_service

from .finance import compute_discount, method_label, money, payment_gross
from .holds import assert_client_can_hire, assert_professional_can_work
from .models import Order, OrderEvent, Payment, Review, WorkEvidence
from .services import ALLOWED_TRANSITIONS, refresh_rating, is_assigned_professional, is_order_client, price_bounds, valid_price_bounds


class OrderTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    scheduled_for = serializers.DateTimeField(required=False)
    arrival_code = serializers.CharField(max_length=8, required=False, allow_blank=True, default="")


class OrderPriceSerializer(serializers.Serializer):
    final_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)


def _luhn_valid(number: str) -> bool:
    total = 0
    for index, digit in enumerate(reversed(number)):
        value = int(digit)
        if index % 2:
            value *= 2
            if value > 9:
                value -= 9
        total += value
    return total % 10 == 0


DECLINED_TEST_CARD = "4000000000000002"
DECLINED_TEST_REFERENCE = "RECHAZADO"


class DemoPaymentSerializer(serializers.Serializer):
    """Datos del formulario de pago de prueba. Nunca se guardan: solo se validan."""

    METHOD_CODES = {"credit": "DEV_CREDIT", "debit": "DEV_DEBIT", "transfer": "DEV_TRANSFER"}

    method = serializers.ChoiceField(choices=list(METHOD_CODES), required=False)
    card_number = serializers.CharField(max_length=32, required=False, allow_blank=True)
    card_holder = serializers.CharField(max_length=80, required=False, allow_blank=True)
    expiry = serializers.CharField(max_length=7, required=False, allow_blank=True)
    cvv = serializers.CharField(max_length=4, required=False, allow_blank=True)
    installments = serializers.IntegerField(min_value=1, max_value=36, required=False, default=1)
    bank = serializers.CharField(max_length=60, required=False, allow_blank=True)
    account_type = serializers.ChoiceField(choices=["savings", "checking"], required=False)
    document_type = serializers.ChoiceField(choices=["CC", "CE", "NIT", "PP"], required=False)
    document_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    transfer_reference = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate(self, attrs):
        method = attrs.get("method")
        if not method:
            return attrs
        errors = {}
        if method in ("credit", "debit"):
            number = "".join(ch for ch in attrs.get("card_number", "") if ch not in " -")
            if not number.isdigit() or not 13 <= len(number) <= 19 or not _luhn_valid(number):
                errors["card_number"] = "El número de tarjeta no es válido."
            if len((attrs.get("card_holder") or "").strip()) < 3:
                errors["card_holder"] = "Ingresa el nombre como aparece en la tarjeta."
            if not attrs.get("cvv", "").isdigit() or len(attrs["cvv"]) not in (3, 4):
                errors["cvv"] = "El código de seguridad debe tener 3 o 4 dígitos."
            expiry = attrs.get("expiry", "").replace(" ", "")
            try:
                month_text, year_text = expiry.split("/")
                month, year = int(month_text), int(year_text)
                year += 2000 if year < 100 else 0
                if not 1 <= month <= 12:
                    raise ValueError
                now = timezone.now()
                if (year, month) < (now.year, now.month):
                    errors["expiry"] = "La tarjeta está vencida."
            except ValueError:
                errors["expiry"] = "Usa el formato MM/AA."
        else:
            if not attrs.get("bank", "").strip():
                errors["bank"] = "Selecciona el banco."
            if not attrs.get("account_type"):
                errors["account_type"] = "Selecciona el tipo de cuenta."
            if not attrs.get("document_type"):
                errors["document_type"] = "Selecciona el tipo de documento."
            document = attrs.get("document_number", "")
            if not document.isalnum() or not 5 <= len(document) <= 15:
                errors["document_number"] = "El número de documento no es válido."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    @property
    def simulate_decline(self) -> bool:
        """Tarjeta o referencia de prueba que simula un pago rechazado."""
        data = self.validated_data
        if data.get("method") in ("credit", "debit"):
            return "".join(ch for ch in data.get("card_number", "") if ch not in " -") == DECLINED_TEST_CARD
        if data.get("method") == "transfer":
            return data.get("transfer_reference", "").strip().upper() == DECLINED_TEST_REFERENCE
        return False

    @property
    def payment_method(self) -> str:
        return self.METHOD_CODES.get(self.validated_data.get("method"), "DEV")


class OrderEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderEvent
        fields = ["id", "status", "status_label", "note", "created_at"]


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "order", "rating", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_order(self, order):
        if not is_order_client(order, self.context["request"].user):
            raise serializers.ValidationError("Solo el cliente puede calificar la orden.")
        if order.status != Order.Status.COMPLETED:
            raise serializers.ValidationError("La orden aun no esta completada.")
        return order

    def create(self, validated_data):
        review = super().create(validated_data)
        refresh_rating(review.order.professional)
        return review


class WorkEvidenceSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkEvidence
        fields = ["id", "image_url", "caption", "created_at"]

    def get_image_url(self, instance) -> str:
        request = self.context.get("request")
        path = f"/api/v1/orders/{instance.order_id}/evidence/{instance.id}/"
        return request.build_absolute_uri(path) if request else path


class OrderSerializer(serializers.ModelSerializer):
    viewer_role = serializers.SerializerMethodField()
    price_bounds = serializers.SerializerMethodField()
    can_set_final_price = serializers.SerializerMethodField()
    discount_preview = serializers.SerializerMethodField()
    amount_due = serializers.SerializerMethodField()
    payment_info = serializers.SerializerMethodField()
    available_transitions = serializers.SerializerMethodField()
    arrival_code = serializers.SerializerMethodField()
    professional = ProfessionalListSerializer(read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    review = ReviewSerializer(read_only=True)
    work_evidence = WorkEvidenceSerializer(many=True, read_only=True)
    workplace_latitude = serializers.FloatField(source="service_request.household.latitude", read_only=True)
    workplace_longitude = serializers.FloatField(source="service_request.household.longitude", read_only=True)
    workplace_address = serializers.CharField(source="service_request.household.address_line", read_only=True, default="")
    workplace_neighborhood = serializers.CharField(source="service_request.household.neighborhood", read_only=True, default="")
    workplace_city = serializers.CharField(source="service_request.household.city", read_only=True, default="")
    household_label = serializers.CharField(source="service_request.household.label", read_only=True, default="Tu Vivienda")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_status_label = serializers.CharField(source="get_payment_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "service_request",
            "professional",
            "status",
            "status_label",
            "available_transitions",
            "viewer_role",
            "price_bounds",
            "can_set_final_price",
            "discount_preview",
            "amount_due",
            "payment_info",
            "payment_status",
            "payment_status_label",
            "payment_confirmed_at",
            "payment_reference",
            "scheduled_for",
            "estimate_min",
            "estimate_max",
            "final_price",
            "client_notes",
            "arrival_code",
            "professional_latitude",
            "professional_longitude",
            "workplace_latitude",
            "workplace_longitude",
            "workplace_address",
            "workplace_neighborhood",
            "workplace_city",
            "household_label",
            "events",
            "review",
            "work_evidence",
            "created_at",
        ]
        read_only_fields = fields

    def get_discount_preview(self, obj):
        if obj.payment_status != Order.PaymentStatus.PENDING or not obj.final_price:
            return "0.00"
        return str(compute_discount(obj.final_price))

    def get_amount_due(self, obj):
        if obj.payment_status != Order.PaymentStatus.PENDING or not obj.final_price:
            return None
        return str(obj.final_price - compute_discount(obj.final_price))

    def get_payment_info(self, obj):
        """Pago registrado de la orden, visible para el cliente y el profesional."""
        if obj.payment_status == Order.PaymentStatus.PENDING:
            return None
        payments = [p for p in obj.payments.all() if p.status in (Payment.Status.APPROVED, Payment.Status.REFUNDED)]
        if not payments:
            return None
        payment = payments[0]
        request = self.context.get("request")
        return {
            "amount": str(money(Decimal(payment.amount_in_cents) / 100)),
            "discount": str(money(payment.discount_amount)),
            "subtotal": str(payment_gross(payment)),
            "method": method_label(payment.payment_method),
            "reference": payment.reference,
            "paid_at": obj.payment_confirmed_at,
            # Solo el cliente puede abrir el comprobante, que incluye sus datos personales.
            "receipt_id": payment.id if request and is_order_client(obj, request.user) else None,
        }

    def get_arrival_code(self, obj):
        request = self.context.get("request")
        return obj.arrival_code if request and is_order_client(obj, request.user) else ""

    def get_viewer_role(self, obj):
        request = self.context.get("request")
        if request and is_assigned_professional(obj, request.user):
            return "professional"
        if request and is_order_client(obj, request.user):
            return "client"
        return "staff" if request and request.user.role == UserRole.STAFF else "none"

    def get_price_bounds(self, obj):
        lower, upper = price_bounds(obj)
        return {"min": str(lower) if lower is not None else None, "max": str(upper) if upper is not None else None}

    def get_can_set_final_price(self, obj):
        request = self.context.get("request")
        return bool(request and is_assigned_professional(obj, request.user)
                    and obj.status not in {Order.Status.REQUESTED, Order.Status.CANCELLED}
                    and obj.payment_status != Order.PaymentStatus.PAID and valid_price_bounds(obj)
                    and not any(payment.status == "pending" for payment in obj.payments.all()))

    def get_available_transitions(self, obj):
        request = self.context.get("request")
        if request is None:
            return []
        user = request.user
        allowed = ALLOWED_TRANSITIONS.get(obj.status, set()) - {Order.Status.ACCEPTED}
        if obj.service_request.status != ServiceRequest.Status.ACCEPTED:
            allowed = allowed & {Order.Status.CANCELLED}
        if is_assigned_professional(obj, user) or getattr(user, "role", "") == "staff":
            return sorted(allowed)
        if is_order_client(obj, user) and obj.status in {Order.Status.REQUESTED, Order.Status.ACCEPTED, Order.Status.SCHEDULED}:
            return sorted(allowed & {Order.Status.CANCELLED})
        return []


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "service_request",
            "professional",
            "scheduled_for",
            "estimate_min",
            "estimate_max",
            "client_notes",
        ]
        read_only_fields = ["estimate_min", "estimate_max"]

    def validate_service_request(self, service_request):
        if service_request.client_id != self.context["request"].user.id:
            raise serializers.ValidationError("La solicitud no pertenece a este usuario.")
        assert_client_can_hire(self.context["request"].user)
        if service_request.status not in {ServiceRequest.Status.OPEN, ServiceRequest.Status.MATCHED}:
            raise serializers.ValidationError("La solicitud ya no permite crear una orden.")
        return service_request

    def validate(self, attrs):
        service_request = attrs["service_request"]
        professional = attrs["professional"]
        if self.context["request"].user.role != UserRole.CLIENT:
            raise serializers.ValidationError("Solo el cliente puede solicitar una orden.")
        if professional.user_id == service_request.client_id:
            raise serializers.ValidationError({"professional": "No puedes contratar tu propio perfil profesional."})
        assert_professional_can_work(professional)
        if service_request.selected_service_id and not professional_offers_service(
            professional, service_request.selected_service_id
        ):
            raise serializers.ValidationError(
                {"professional": "El profesional no ofrece el servicio seleccionado."}
            )
        if Order.objects.filter(
            service_request=service_request, professional=professional
        ).exists():
            raise serializers.ValidationError("Ya existe una orden para esta solicitud.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        service_request = ServiceRequest.objects.select_for_update().get(pk=validated_data["service_request"].pk)
        if service_request.status not in {ServiceRequest.Status.OPEN, ServiceRequest.Status.MATCHED}:
            raise serializers.ValidationError("La solicitud ya no permite crear una orden.")
        if service_request.professional_id not in {None, validated_data["professional"].id}:
            raise serializers.ValidationError("La solicitud ya está dirigida a otro profesional.")
        if service_request.orders.exists():
            raise serializers.ValidationError("Ya existe una orden para esta solicitud.")
        offering = ProfessionalService.objects.filter(profile=validated_data["professional"], service_id=service_request.selected_service_id).first()
        order = Order.objects.create(client=self.context["request"].user,
                                     estimate_min=offering.price_min if offering else None,
                                     estimate_max=offering.price_max if offering else None, **validated_data)
        OrderEvent.objects.create(
            order=order,
            status=order.status,
            note="Visita solicitada desde la app.",
            created_by=order.client,
        )
        service_request.professional = order.professional
        service_request.status = service_request.Status.OPEN
        service_request.save(update_fields=["professional", "status", "updated_at"])
        return order

    def to_representation(self, instance):
        return OrderSerializer(instance, context=self.context).data
