"""Reglas financieras: reparto de comisión, liquidaciones, retiros y reembolsos."""
import json
import secrets
from datetime import timedelta
import urllib.error
import urllib.request
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import quote

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import PlatformSettings
from apps.professionals.models import ProfessionalProfile

from .models import Order, Payment, Refund, Withdrawal
from .wompi import wompi_keys

CENT = Decimal("0.01")
DEFAULT_COMMISSION = Decimal("10")
MIN_WITHDRAWAL = Decimal("10000")
RESERVED_WITHDRAWAL_STATUSES = (
    Withdrawal.Status.PENDING,
    Withdrawal.Status.APPROVED,
    Withdrawal.Status.PAID,
)

METHOD_LABELS = {
    "CARD": "Tarjeta",
    "PSE": "PSE",
    "NEQUI": "Nequi",
    "BANCOLOMBIA_TRANSFER": "Transferencia Bancolombia",
    "BANCOLOMBIA_COLLECT": "Corresponsal Bancolombia",
    "DEV": "Pago simulado",
    "DEV_CREDIT": "Tarjeta de crédito (prueba)",
    "DEV_DEBIT": "Tarjeta débito (prueba)",
    "DEV_TRANSFER": "Transferencia bancaria (prueba)",
}


class FinanceError(Exception):
    """Regla de negocio incumplida; el mensaje se muestra al usuario."""


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


def method_label(code: str) -> str:
    return METHOD_LABELS.get((code or "").upper(), code or "—")


def commission_rate() -> Decimal:
    payments_cfg = PlatformSettings.load()["sections"].get("payments", {})
    try:
        rate = Decimal(str(payments_cfg.get("platform_commission", DEFAULT_COMMISSION)))
    except Exception:
        return DEFAULT_COMMISSION
    return min(max(rate, Decimal("0")), Decimal("100"))


MIN_PAYMENT = Decimal("1500")


def compute_discount(price) -> Decimal:
    """Descuento configurado por el administrador. La plataforma lo asume: nunca supera su comisión."""
    price = money(price)
    cfg = PlatformSettings.load()["sections"].get("payments", {})
    if cfg.get("discount_enabled") is not True or price <= 0:
        return Decimal("0.00")
    try:
        value = Decimal(str(cfg.get("discount_value") or 0))
    except Exception:
        return Decimal("0.00")
    if value <= 0:
        return Decimal("0.00")
    raw = price * min(value, Decimal("100")) / 100 if cfg.get("discount_type") == "percent" else value
    commission = money(price * commission_rate() / 100)
    return max(Decimal("0.00"), money(min(raw, commission, price - MIN_PAYMENT)))


def order_price(order: Order) -> Decimal:
    return money(order.final_price or order.estimate_max or order.estimate_min)


def order_gross(order: Order) -> Decimal:
    payment = order.payments.filter(
        status__in=[Payment.Status.APPROVED, Payment.Status.REFUNDED]
    ).first()
    if payment:
        return money(Decimal(payment.amount_in_cents) / 100)
    return order_price(order)


def register_split(order: Order, gross: Decimal | None = None, discount: Decimal = Decimal("0")) -> Order:
    """Fija comisión de Serviprox y ganancia del profesional sobre el pago confirmado.

    `gross` es el valor del servicio antes del descuento; la plataforma asume el descuento
    con su comisión, así que la ganancia del profesional no cambia.
    """
    gross = money(gross if gross is not None else order_gross(order))
    discount = money(discount)
    rate = commission_rate()
    full_commission = money(gross * rate / 100)
    order.commission_rate = rate
    order.commission_amount = max(Decimal("0.00"), full_commission - discount)
    order.professional_amount = gross - full_commission
    order.save(
        update_fields=[
            "commission_rate",
            "commission_amount",
            "professional_amount",
            "updated_at",
        ]
    )
    return order


def payment_gross(payment: Payment) -> Decimal:
    """Valor del servicio antes del descuento."""
    return money(Decimal(payment.amount_in_cents) / 100 + payment.discount_amount)


def backfill_splits() -> None:
    """Completa el reparto de órdenes pagadas antes de existir este módulo."""
    legacy = Order.objects.filter(
        payment_status=Order.PaymentStatus.PAID, commission_rate__isnull=True
    )
    for order in legacy:
        register_split(order)


def record_declined_dev_payment(order: Order, user=None, method: str = "DEV") -> Payment:
    """Registra un intento de pago de prueba rechazado; la orden sigue pendiente de pago."""
    price = order_price(order)
    discount = compute_discount(price)
    return Payment.objects.create(
        order=order,
        client=user or order.client,
        reference=f"DEV-DECL-{order.pk}-{secrets.token_hex(3)}",
        amount_in_cents=int((price - discount) * 100),
        discount_amount=discount,
        status=Payment.Status.DECLINED,
        payment_method=method,
        test_mode=True,
    )


def ensure_dev_payment(order: Order, user=None, method: str = "DEV") -> Payment:
    """Garantiza una fila de Payment para pagos simulados, así el historial siempre la muestra."""
    existing = order.payments.filter(status=Payment.Status.APPROVED).first()
    if existing:
        return existing
    price = order_price(order)
    discount = compute_discount(price)
    cents = int((price - discount) * 100)
    return Payment.objects.create(
        order=order,
        client=user or order.client,
        reference=order.payment_reference or f"DEV-{order.pk}",
        amount_in_cents=cents,
        discount_amount=discount,
        status=Payment.Status.APPROVED,
        payment_method=method,
        test_mode=True,
    )


@transaction.atomic
def apply_payment_update(
    payment: Payment, new_status: str, transaction_id: str = "", method: str = ""
) -> Payment:
    """Aplica el resultado de la pasarela al pago y, si se aprobó, a la orden."""
    payment.status = new_status
    payment.wompi_transaction_id = str(transaction_id or "")[:80]
    payment.payment_method = str(method or "")[:40]
    payment.save()

    if new_status == Payment.Status.APPROVED:
        order = Order.objects.select_for_update().get(pk=payment.order_id)
        order.payment_status = Order.PaymentStatus.PAID
        order.payment_confirmed_at = timezone.now()
        order.payment_reference = payment.reference
        order.save(
            update_fields=[
                "payment_status",
                "payment_confirmed_at",
                "payment_reference",
                "updated_at",
            ]
        )
        register_split(order, payment_gross(payment), payment.discount_amount)
    return payment


def fetch_wompi_transaction(reference: str, test_mode: bool = False) -> dict | None:
    """Consulta a Wompi la transacción asociada a una referencia."""
    public_key = wompi_keys(test_mode)["public"]
    host = "sandbox.wompi.co" if public_key.startswith("pub_test_") else "production.wompi.co"
    url = f"https://{host}/v1/transactions?reference={quote(reference)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:  # noqa: S310 (host fijo)
            payload = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise FinanceError("No pudimos consultar el estado en Wompi. Intenta de nuevo.") from exc
    data = payload.get("data") or []
    return data[0] if data else None


# ── Saldos del profesional ──────────────────────────────────────────────────


def _sum(qs, field: str) -> Decimal:
    return money(qs.aggregate(total=Sum(field))["total"])


def professional_balance(profile: ProfessionalProfile) -> dict:
    backfill_splits()
    orders = profile.orders.all()
    paid = orders.filter(payment_status=Order.PaymentStatus.PAID)
    settled = paid.filter(payout_status=Order.PayoutStatus.SETTLED)
    pending_settlement = paid.filter(payout_status=Order.PayoutStatus.PENDING)
    withdrawals = profile.withdrawals.all()
    reserved = _sum(withdrawals.filter(status__in=RESERVED_WITHDRAWAL_STATUSES), "amount")
    return {
        "commission_rate": float(commission_rate()),
        "gross_total": _sum(paid, "professional_amount") + _sum(paid, "commission_amount"),
        "commission_total": _sum(paid, "commission_amount"),
        "net_total": _sum(paid, "professional_amount"),
        "pending_settlement": _sum(pending_settlement, "professional_amount"),
        "settled_total": _sum(settled, "professional_amount"),
        "available_balance": _sum(settled, "professional_amount") - reserved,
        "withdrawn_total": _sum(withdrawals.filter(status=Withdrawal.Status.PAID), "amount"),
        "pending_withdrawals": _sum(
            withdrawals.filter(
                status__in=[Withdrawal.Status.PENDING, Withdrawal.Status.APPROVED]
            ),
            "amount",
        ),
    }


@transaction.atomic
def create_withdrawal(profile: ProfessionalProfile, amount, destination: str) -> Withdrawal:
    ProfessionalProfile.objects.select_for_update().get(pk=profile.pk)
    amount = money(amount)
    destination = (destination or "").strip()
    if len(destination) < 5:
        raise FinanceError("Indica la cuenta de destino (banco, tipo y número).")
    if amount < MIN_WITHDRAWAL:
        raise FinanceError(f"El retiro mínimo es ${MIN_WITHDRAWAL:,.0f} COP.")
    if amount > professional_balance(profile)["available_balance"]:
        raise FinanceError("El monto supera tu saldo disponible.")
    return Withdrawal.objects.create(
        professional=profile, amount=amount, destination=destination[:160]
    )


# ── Gestión administrativa ──────────────────────────────────────────────────


def is_settleable(order: Order) -> bool:
    return (
        order.payment_status == Order.PaymentStatus.PAID
        and order.status == Order.Status.COMPLETED
        and order.payout_status == Order.PayoutStatus.PENDING
    )


@transaction.atomic
def settle_orders(order_ids=None) -> int:
    """Liquida órdenes completadas y pagadas; sin ids, liquida todas las elegibles."""
    backfill_splits()
    qs = Order.objects.filter(
        payment_status=Order.PaymentStatus.PAID,
        status=Order.Status.COMPLETED,
        payout_status=Order.PayoutStatus.PENDING,
    )
    if order_ids is not None:
        qs = qs.filter(pk__in=order_ids)
    return qs.update(
        payout_status=Order.PayoutStatus.SETTLED, payout_settled_at=timezone.now()
    )


@transaction.atomic
def resolve_withdrawal(
    withdrawal_id: int, action: str, user, reference: str = "", note: str = ""
) -> Withdrawal:
    withdrawal = Withdrawal.objects.select_for_update().get(pk=withdrawal_id)
    open_states = {Withdrawal.Status.PENDING, Withdrawal.Status.APPROVED}
    if withdrawal.status not in open_states:
        raise FinanceError("Esta solicitud ya fue resuelta.")
    if action == "approve":
        if withdrawal.status != Withdrawal.Status.PENDING:
            raise FinanceError("La solicitud ya está aprobada.")
        withdrawal.status = Withdrawal.Status.APPROVED
    elif action == "reject":
        if not note.strip():
            raise FinanceError("Indica el motivo del rechazo.")
        withdrawal.status = Withdrawal.Status.REJECTED
    elif action == "pay":
        if not reference.strip():
            raise FinanceError("Indica la referencia de la transferencia.")
        withdrawal.status = Withdrawal.Status.PAID
        withdrawal.transfer_reference = reference.strip()[:80]
    else:
        raise FinanceError("Acción desconocida.")
    withdrawal.note = note.strip()[:240]
    withdrawal.resolved_by = user
    withdrawal.resolved_at = timezone.now()
    withdrawal.save()
    return withdrawal


@transaction.atomic
def create_refund(order: Order, reason: str, user) -> Refund:
    order = Order.objects.select_for_update().get(pk=order.pk)
    reason = (reason or "").strip()
    if len(reason) < 5:
        raise FinanceError("Indica el motivo del reembolso.")
    if order.payment_status != Order.PaymentStatus.PAID:
        raise FinanceError("Solo se pueden reembolsar órdenes pagadas.")
    if order.refunds.filter(status=Refund.Status.REQUESTED).exists():
        raise FinanceError("Ya hay un reembolso en revisión para esta orden.")
    payment = order.payments.filter(status=Payment.Status.APPROVED).first()
    return Refund.objects.create(
        order=order,
        payment=payment,
        amount=order_gross(order),
        reason=reason[:240],
        requested_by=user,
    )


@transaction.atomic
def resolve_refund(refund_id: int, action: str, user, note: str = "") -> Refund:
    refund = Refund.objects.select_for_update().get(pk=refund_id)
    if refund.status != Refund.Status.REQUESTED:
        raise FinanceError("Este reembolso ya fue resuelto.")
    if action == "reject":
        if not note.strip():
            raise FinanceError("Indica el motivo del rechazo.")
        refund.status = Refund.Status.REJECTED
    elif action == "approve":
        order = Order.objects.select_for_update().get(pk=refund.order_id)
        if order.payment_status != Order.PaymentStatus.PAID:
            raise FinanceError("La orden ya no está pagada.")
        if order.payout_status == Order.PayoutStatus.SETTLED:
            # El dinero ya es del profesional: solo se revierte si su saldo lo cubre.
            balance = professional_balance(order.professional)
            if balance["available_balance"] < money(order.professional_amount):
                raise FinanceError(
                    "El profesional ya retiró este valor; no se puede reembolsar automáticamente."
                )
        order.payment_status = Order.PaymentStatus.REFUNDED
        order.payout_status = Order.PayoutStatus.REFUNDED
        order.save(update_fields=["payment_status", "payout_status", "updated_at"])
        if refund.payment_id:
            Payment.objects.filter(pk=refund.payment_id).update(
                status=Payment.Status.REFUNDED, updated_at=timezone.now()
            )
        refund.status = Refund.Status.APPROVED
    else:
        raise FinanceError("Acción desconocida.")
    refund.note = note.strip()[:240]
    refund.resolved_by = user
    refund.resolved_at = timezone.now()
    refund.save()
    return refund


def platform_summary() -> dict:
    backfill_splits()
    paid = Order.objects.filter(payment_status=Order.PaymentStatus.PAID)
    payments = Payment.objects.all()
    approved_cents = payments.filter(status=Payment.Status.APPROVED).aggregate(
        total=Sum("amount_in_cents")
    )["total"] or 0
    pending_cents = payments.filter(status=Payment.Status.PENDING).aggregate(
        total=Sum("amount_in_cents")
    )["total"] or 0
    open_withdrawals = Withdrawal.objects.filter(
        status__in=[Withdrawal.Status.PENDING, Withdrawal.Status.APPROVED]
    )
    discounts = payments.filter(status=Payment.Status.APPROVED).aggregate(total=Sum("discount_amount"))["total"]
    return {
        "commission_rate": float(commission_rate()),
        "discounts_total": money(discounts),
        "payments_total": payments.count(),
        "collected": money(Decimal(approved_cents) / 100),
        "pending_collection": money(Decimal(pending_cents) / 100),
        "commissions": _sum(paid, "commission_amount"),
        "professionals_share": _sum(paid, "professional_amount"),
        "pending_settlement": _sum(
            paid.filter(payout_status=Order.PayoutStatus.PENDING), "professional_amount"
        ),
        "eligible_settlement_orders": paid.filter(
            status=Order.Status.COMPLETED, payout_status=Order.PayoutStatus.PENDING
        ).count(),
        "settled": _sum(
            paid.filter(payout_status=Order.PayoutStatus.SETTLED), "professional_amount"
        ),
        "withdrawals_open_count": open_withdrawals.count(),
        "withdrawals_open_amount": _sum(open_withdrawals, "amount"),
        "withdrawals_paid": _sum(
            Withdrawal.objects.filter(status=Withdrawal.Status.PAID), "amount"
        ),
        "refunds_open_count": Refund.objects.filter(status=Refund.Status.REQUESTED).count(),
        "refunds_total": _sum(Refund.objects.filter(status=Refund.Status.APPROVED), "amount"),
        "payments_by_status": {
            status: payments.filter(status=status).count() for status in Payment.Status.values
        },
    }


def monthly_series(months: int = 6) -> list[dict]:
    """Recaudo y comisiones de los últimos meses, para la vista general."""
    today = timezone.localdate()
    year, month = today.year, today.month
    buckets = []
    for _ in range(months):
        buckets.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    buckets.reverse()
    orders = Order.objects.filter(
        payment_status=Order.PaymentStatus.PAID, payment_confirmed_at__isnull=False
    )
    series = []
    for year, month in buckets:
        rows = orders.filter(payment_confirmed_at__year=year, payment_confirmed_at__month=month)
        commission = _sum(rows, "commission_amount")
        series.append(
            {
                "month": f"{year}-{month:02d}",
                "commissions": commission,
                "collected": commission + _sum(rows, "professional_amount"),
            }
        )
    return series


# Código de método registrado en un pago -> método del panel administrativo.
STATS_METHOD_GROUPS = {
    "CARD": "card", "DEV_CREDIT": "card", "DEV_DEBIT": "card",
    "PSE": "pse",
    "BANCOLOMBIA_TRANSFER": "transfer", "DEV_TRANSFER": "transfer",
    "NEQUI": "wallet", "DAVIPLATA": "wallet",
}
REJECTION_ALERT_RATE = Decimal("0.4")
REJECTION_ALERT_MIN_ATTEMPTS = 5


def payment_method_stats(days: int = 30, include_test: bool = False) -> dict:
    """Pagos agrupados por método del panel: aprobados, rechazados, monto y % de aprobación."""
    since = timezone.now() - timedelta(days=days)
    rows: dict[str, dict] = {}
    for payment in Payment.objects.filter(created_at__gte=since).only(
        "status", "payment_method", "amount_in_cents", "test_mode"
    )[:20000]:
        code = (payment.payment_method or "").upper()
        if not include_test and (payment.test_mode or code.startswith("DEV")):
            continue
        key = STATS_METHOD_GROUPS.get(code, "other")
        row = rows.setdefault(
            key,
            {"method": key, "total": 0, "approved": 0, "declined": 0, "pending": 0, "approved_amount": Decimal("0")},
        )
        row["total"] += 1
        if payment.status == Payment.Status.APPROVED:
            row["approved"] += 1
            row["approved_amount"] += Decimal(payment.amount_in_cents) / 100
        elif payment.status in (Payment.Status.DECLINED, Payment.Status.ERROR, Payment.Status.VOIDED):
            row["declined"] += 1
        elif payment.status == Payment.Status.PENDING:
            row["pending"] += 1
    for row in rows.values():
        finished = row["approved"] + row["declined"]
        row["approval_rate"] = round(row["approved"] / finished * 100, 1) if finished else None
        row["approved_amount"] = float(money(row["approved_amount"]))
    return rows


def rejection_alerts(stats: dict, labels: dict[str, str]) -> list[dict]:
    alerts = []
    for key, row in stats.items():
        finished = row["approved"] + row["declined"]
        if finished >= REJECTION_ALERT_MIN_ATTEMPTS and Decimal(row["declined"]) / finished >= REJECTION_ALERT_RATE:
            alerts.append(
                {
                    "level": "warning",
                    "method": key,
                    "message": f"{labels.get(key, key)}: {row['declined']} de {finished} pagos fueron rechazados en los últimos 7 días.",
                }
            )
    return alerts
