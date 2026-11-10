import csv
import io
from datetime import date, datetime, time

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.platform_views import IsPlatformStaff

from .finance import (
    FinanceError,
    apply_payment_update,
    backfill_splits,
    create_refund,
    create_withdrawal,
    fetch_wompi_transaction,
    is_settleable,
    method_label,
    monthly_series,
    money,
    order_price,
    platform_summary,
    professional_balance,
    resolve_refund,
    resolve_withdrawal,
    settle_orders,
)
from .holds import CLIENT_HOLD_MESSAGE, PROFESSIONAL_HOLD_MESSAGE, unpaid_completed_orders
from .models import Order, Payment, Refund, Withdrawal
from .wompi import wompi_ready

PAGE_LIMIT = 200
WOMPI_STATUS = {
    "APPROVED": Payment.Status.APPROVED,
    "DECLINED": Payment.Status.DECLINED,
    "VOIDED": Payment.Status.VOIDED,
    "ERROR": Payment.Status.ERROR,
}


def num(value) -> float:
    return float(money(value))


def number_map(data: dict) -> dict:
    return {k: num(v) if hasattr(v, "quantize") else v for k, v in data.items()}


def person_name(user) -> str:
    if not user:
        return "—"
    return user.get_full_name() or user.email


def service_label(order: Order) -> str:
    request = order.service_request
    if request.selected_service_id:
        return request.selected_service.name
    return request.selected_category.name


def iso(value):
    return value.isoformat() if value else None


def bad_request(exc: Exception) -> Response:
    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def payment_row(p: Payment) -> dict:
    order = p.order
    return {
        "id": p.id,
        "order_id": p.order_id,
        "date": iso(p.created_at),
        "reference": p.reference,
        "method": method_label(p.payment_method),
        "user": person_name(p.client),
        "professional": order.professional.display_name,
        "service": service_label(order),
        "amount": p.amount_in_cents / 100,
        "status": p.status,
        "status_label": p.get_status_display(),
        "can_verify": p.status in (Payment.Status.PENDING, Payment.Status.ERROR)
        and not p.reference.startswith("DEV-"),
    }


def related_payments():
    return Payment.objects.select_related(
        "client",
        "order__professional",
        "order__service_request__selected_service",
        "order__service_request__selected_category",
    )


class PaymentHoldView(APIView):
    """Indica si la cuenta está suspendida por un servicio terminado sin pagar."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = "professional" if getattr(user, "role", "") == "professional" else "client"
        orders = unpaid_completed_orders(user).select_related(
            "service_request__selected_service", "service_request__selected_category"
        )
        if role == "client":
            orders = orders.filter(client=user)
        else:
            orders = orders.filter(professional__user=user)
        items = [
            {
                "order_id": o.id,
                "service": service_label(o),
                "amount": num(order_price(o)),
            }
            for o in orders[:20]
        ]
        message = ""
        if items:
            message = CLIENT_HOLD_MESSAGE if role == "client" else PROFESSIONAL_HOLD_MESSAGE
        return Response({"hold": bool(items), "role": role, "message": message, "orders": items})


# ── Cliente ─────────────────────────────────────────────────────────────────


class ClientPaymentHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = related_payments().filter(client=request.user)[:PAGE_LIMIT]
        data = []
        for p in rows:
            row = payment_row(p)
            row["receipt_available"] = p.status in (
                Payment.Status.APPROVED,
                Payment.Status.REFUNDED,
            )
            row["client_email"] = request.user.email
            row["client_name"] = person_name(request.user)
            row["scheduled_for"] = iso(p.order.scheduled_for)
            row["order_status_label"] = p.order.get_status_display()
            data.append(row)
        return Response(data)


# ── Profesional ─────────────────────────────────────────────────────────────


def professional_profile(request):
    return getattr(request.user, "professional_profile", None)


def withdrawal_row(w: Withdrawal) -> dict:
    return {
        "id": w.id,
        "professional": w.professional.display_name,
        "amount": num(w.amount),
        "destination": w.destination,
        "status": w.status,
        "status_label": w.get_status_display(),
        "transfer_reference": w.transfer_reference,
        "note": w.note,
        "created_at": iso(w.created_at),
        "resolved_at": iso(w.resolved_at),
    }


class ProfessionalEarningsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = professional_profile(request)
        if not profile:
            return Response(
                {"detail": "Solo los profesionales tienen ingresos."},
                status=status.HTTP_403_FORBIDDEN,
            )
        summary = number_map(professional_balance(profile))
        orders = (
            profile.orders.filter(
                payment_status__in=[Order.PaymentStatus.PAID, Order.PaymentStatus.REFUNDED]
            )
            .select_related("client", "service_request__selected_service", "service_request__selected_category")
            .order_by("-payment_confirmed_at", "-created_at")[:PAGE_LIMIT]
        )
        incomes = [
            {
                "order_id": o.id,
                "service": service_label(o),
                "client": person_name(o.client),
                "date": iso(o.payment_confirmed_at or o.created_at),
                "gross": num(o.professional_amount) + num(o.commission_amount),
                "commission": num(o.commission_amount),
                "commission_rate": num(o.commission_rate),
                "net": num(o.professional_amount),
                "payout_status": o.payout_status,
                "payout_status_label": o.get_payout_status_display(),
                "payout_settled_at": iso(o.payout_settled_at),
                "order_status_label": o.get_status_display(),
            }
            for o in orders
        ]
        withdrawals = [withdrawal_row(w) for w in profile.withdrawals.all()[:PAGE_LIMIT]]
        transfers = [w for w in withdrawals if w["status"] == Withdrawal.Status.PAID]
        return Response(
            {
                "summary": summary,
                "incomes": incomes,
                "withdrawals": withdrawals,
                "transfers": transfers,
            }
        )


class ProfessionalWithdrawalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = professional_profile(request)
        if not profile:
            return Response(
                {"detail": "Solo los profesionales pueden solicitar retiros."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            withdrawal = create_withdrawal(
                profile, request.data.get("amount"), request.data.get("destination", "")
            )
        except (FinanceError, ArithmeticError, ValueError, TypeError) as exc:
            message = str(exc) if isinstance(exc, FinanceError) else "Monto inválido."
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(withdrawal_row(withdrawal), status=status.HTTP_201_CREATED)


# ── Administrador ───────────────────────────────────────────────────────────


class AdminPaymentListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        return Response([payment_row(p) for p in related_payments()[:PAGE_LIMIT]])


class AdminPaymentVerifyView(APIView):
    """Consulta a Wompi el estado real de un pago que no llegó por webhook."""

    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        payment = Payment.objects.filter(pk=pk).first()
        if not payment:
            return Response({"detail": "Pago no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        if payment.status in (Payment.Status.APPROVED, Payment.Status.REFUNDED):
            return Response({"detail": "El pago ya está confirmado."}, status=status.HTTP_400_BAD_REQUEST)
        if payment.reference.startswith("DEV-") or not wompi_ready(payment.test_mode):
            return Response(
                {"detail": "Este pago no se puede verificar con la pasarela."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tx = fetch_wompi_transaction(payment.reference, payment.test_mode)
        except FinanceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        new_status = WOMPI_STATUS.get((tx or {}).get("status"))
        if not new_status:
            return Response({"detail": "Wompi aún no registra un resultado para este pago."})
        if tx.get("amount_in_cents") != payment.amount_in_cents or tx.get("currency") != payment.currency:
            return Response(
                {"detail": "El monto de Wompi no coincide con el registrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payment = apply_payment_update(
            payment, new_status, tx.get("id", ""), tx.get("payment_method_type", "")
        )
        return Response({"detail": f"Estado verificado: {payment.get_status_display()}."})


class AdminFinanceSummaryView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        data = number_map(platform_summary())
        data["series"] = [number_map(item) for item in monthly_series()]
        return Response(data)


def payout_row(o: Order) -> dict:
    return {
        "order_id": o.id,
        "professional": o.professional.display_name,
        "client": person_name(o.client),
        "service": service_label(o),
        "date": iso(o.payment_confirmed_at),
        "gross": num(o.professional_amount) + num(o.commission_amount),
        "commission": num(o.commission_amount),
        "commission_rate": num(o.commission_rate),
        "net": num(o.professional_amount),
        "order_status": o.status,
        "order_status_label": o.get_status_display(),
        "payout_status": o.payout_status,
        "payout_status_label": o.get_payout_status_display(),
        "payout_settled_at": iso(o.payout_settled_at),
        "eligible": is_settleable(o),
    }


def payout_queryset():
    return Order.objects.filter(
        payment_status__in=[Order.PaymentStatus.PAID, Order.PaymentStatus.REFUNDED]
    ).select_related(
        "professional",
        "client",
        "service_request__selected_service",
        "service_request__selected_category",
    )


class AdminPayoutListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        backfill_splits()
        rows = payout_queryset().order_by("-payment_confirmed_at")[:PAGE_LIMIT]
        return Response([payout_row(o) for o in rows if o.commission_rate is not None])


class AdminPayoutSettleView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request):
        order_ids = request.data.get("order_ids")
        if order_ids is not None:
            if not isinstance(order_ids, list) or not all(isinstance(i, int) for i in order_ids):
                return Response({"detail": "Lista de órdenes inválida."}, status=status.HTTP_400_BAD_REQUEST)
        elif request.data.get("all") is not True:
            return Response({"detail": "Indica las órdenes a liquidar."}, status=status.HTTP_400_BAD_REQUEST)
        count = settle_orders(order_ids)
        return Response({"settled": count, "detail": f"{count} orden(es) liquidada(s)."})


class AdminWithdrawalListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        rows = Withdrawal.objects.select_related("professional")[:PAGE_LIMIT]
        return Response([withdrawal_row(w) for w in rows])


class AdminWithdrawalResolveView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        try:
            withdrawal = resolve_withdrawal(
                pk,
                str(request.data.get("action", "")),
                request.user,
                reference=str(request.data.get("reference", "")),
                note=str(request.data.get("note", "")),
            )
        except Withdrawal.DoesNotExist:
            return Response({"detail": "Solicitud no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except FinanceError as exc:
            return bad_request(exc)
        return Response(withdrawal_row(withdrawal))


def refund_row(r: Refund) -> dict:
    return {
        "id": r.id,
        "order_id": r.order_id,
        "client": person_name(r.order.client),
        "professional": r.order.professional.display_name,
        "amount": num(r.amount),
        "reason": r.reason,
        "status": r.status,
        "status_label": r.get_status_display(),
        "note": r.note,
        "created_at": iso(r.created_at),
        "resolved_at": iso(r.resolved_at),
    }


class AdminRefundListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        rows = Refund.objects.select_related("order__client", "order__professional")[:PAGE_LIMIT]
        return Response([refund_row(r) for r in rows])

    def post(self, request):
        order_id = str(request.data.get("order_id", ""))
        order = Order.objects.filter(pk=int(order_id)).first() if order_id.isdigit() else None
        if not order:
            return Response({"detail": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        try:
            refund = create_refund(order, str(request.data.get("reason", "")), request.user)
        except FinanceError as exc:
            return bad_request(exc)
        return Response(refund_row(refund), status=status.HTTP_201_CREATED)


class AdminRefundResolveView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        try:
            refund = resolve_refund(
                pk,
                str(request.data.get("action", "")),
                request.user,
                note=str(request.data.get("note", "")),
            )
        except Refund.DoesNotExist:
            return Response({"detail": "Reembolso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except FinanceError as exc:
            return bad_request(exc)
        return Response(refund_row(refund))


def _csv_cell(value):
    # Evita que Excel interprete textos del usuario como fórmulas.
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
        return "'" + value
    return value


def _parse_day(value, end_of_day=False):
    try:
        day = date.fromisoformat(str(value))
    except ValueError:
        return None
    moment = datetime.combine(day, time.max if end_of_day else time.min)
    return timezone.make_aware(moment)


class AdminFinanceReportView(APIView):
    """Reporte financiero por rango de fechas, en JSON o CSV."""

    permission_classes = [IsPlatformStaff]

    def get(self, request):
        start = _parse_day(request.query_params.get("from", ""))
        end = _parse_day(request.query_params.get("to", ""), end_of_day=True)
        if request.query_params.get("from") and not start or request.query_params.get("to") and not end:
            return Response({"detail": "Fechas inválidas (use AAAA-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)
        backfill_splits()
        qs = payout_queryset().order_by("payment_confirmed_at")
        if start:
            qs = qs.filter(payment_confirmed_at__gte=start)
        if end:
            qs = qs.filter(payment_confirmed_at__lte=end)
        rows = [payout_row(o) for o in qs if o.commission_rate is not None]
        active = [r for r in rows if r["payout_status"] != Order.PayoutStatus.REFUNDED]
        totals = {
            "orders": len(active),
            "gross": sum(r["gross"] for r in active),
            "commissions": sum(r["commission"] for r in active),
            "professionals": sum(r["net"] for r in active),
        }
        if request.query_params.get("export") != "csv":
            return Response({"totals": totals, "rows": rows})

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["Orden", "Fecha de pago", "Cliente", "Profesional", "Servicio", "Bruto", "Comisión %",
             "Comisión Serviprox", "Neto profesional", "Estado de orden", "Estado de liquidación"]
        )
        for r in rows:
            writer.writerow(
                [_csv_cell(v) for v in (
                    r["order_id"], r["date"], r["client"], r["professional"], r["service"],
                    r["gross"], r["commission_rate"], r["commission"], r["net"],
                    r["order_status_label"], r["payout_status_label"],
                )]
            )
        response = HttpResponse("\ufeff" + buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="reporte-financiero-serviprox.csv"'
        return response
