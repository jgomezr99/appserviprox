"""Módulo administrativo de Contrataciones: lista, resumen, alertas, detalle y acciones sobre órdenes."""
import math
import random
from datetime import timedelta

from django.core.exceptions import PermissionDenied
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Notification
from apps.accounts.platform_views import IsPlatformStaff, _audit
from apps.professionals.models import ProfessionalProfile
from apps.pqrs.models import PQRReport
from apps.service_requests.models import RequestCandidate, ServiceRequest
from apps.service_requests.services import professional_offers_service

from .finance import method_label
from .models import Order, OrderAdminNote, Payment
from .services import InvalidTransition, transition

ACTIVE = [
    Order.Status.REQUESTED, Order.Status.ACCEPTED, Order.Status.SCHEDULED, Order.Status.TRAVELING,
    Order.Status.ARRIVED, Order.Status.IN_PROGRESS, Order.Status.BREAK, Order.Status.LUNCH,
    Order.Status.OTHER_SERVICE,
]
TERMINAL = [Order.Status.COMPLETED, Order.Status.CANCELLED]
MAX_PAGE_SIZE = 100

ALERT_LABELS = {
    "stalled": "Sin movimiento hace más de 48 horas",
    "overdue_visit": "Visita agendada vencida",
    "unpaid": "Terminadas sin pago hace más de 24 horas",
    "no_review": "Terminadas sin calificación hace más de 7 días",
}


def alert_filters(now):
    """Condiciones de cada alerta; se usan tanto para contar como para filtrar la lista."""
    return {
        "stalled": Q(status__in=ACTIVE, updated_at__lt=now - timedelta(hours=48)),
        "overdue_visit": Q(
            status__in=[Order.Status.ACCEPTED, Order.Status.SCHEDULED, Order.Status.TRAVELING],
            scheduled_for__lt=now - timedelta(hours=12),
        ),
        "unpaid": Q(
            status=Order.Status.COMPLETED, payment_status=Order.PaymentStatus.PENDING,
            updated_at__lt=now - timedelta(hours=24),
        ),
        "no_review": Q(status=Order.Status.COMPLETED, review__isnull=True, updated_at__lt=now - timedelta(days=7)),
    }


def person(user) -> str:
    if not user:
        return "—"
    return user.get_full_name() or user.email


def base_queryset():
    return Order.objects.select_related(
        "client", "professional__user", "service_request__selected_service",
        "service_request__selected_category", "service_request__household", "review",
    )


def order_alerts(order, now) -> list[str]:
    """Alertas de una orden; usa las mismas condiciones que `alert_filters` evaluadas sobre la fila."""
    flags = []
    if order.status in ACTIVE and order.updated_at < now - timedelta(hours=48):
        flags.append("stalled")
    if (
        order.status in (Order.Status.ACCEPTED, Order.Status.SCHEDULED, Order.Status.TRAVELING)
        and order.scheduled_for and order.scheduled_for < now - timedelta(hours=12)
    ):
        flags.append("overdue_visit")
    if (
        order.status == Order.Status.COMPLETED and order.payment_status == Order.PaymentStatus.PENDING
        and order.updated_at < now - timedelta(hours=24)
    ):
        flags.append("unpaid")
    if (
        order.status == Order.Status.COMPLETED and not hasattr(order, "review")
        and order.updated_at < now - timedelta(days=7)
    ):
        flags.append("no_review")
    return flags


def service_name(order) -> str:
    request = order.service_request
    return (request.selected_service.name if request.selected_service_id else request.selected_category.name)


def row(order, now) -> dict:
    request = order.service_request
    household = request.household
    review = getattr(order, "review", None)
    return {
        "id": order.id,
        "request_id": order.service_request_id,
        "created_at": order.created_at.isoformat(),
        "status": order.status,
        "status_label": order.get_status_display(),
        "service": service_name(order),
        "category": request.selected_category.name,
        "client": {
            "id": order.client_id, "name": person(order.client), "email": order.client.email,
            "phone": order.client.phone,
        },
        "professional": {"id": order.professional_id, "name": order.professional.display_name},
        "city": household.city,
        "neighborhood": household.neighborhood,
        "final_price": float(order.final_price) if order.final_price is not None else None,
        "payment_status": order.payment_status,
        "payment_status_label": order.get_payment_status_display(),
        "payout_status": order.payout_status,
        "payout_status_label": order.get_payout_status_display(),
        "scheduled_for": order.scheduled_for.isoformat() if order.scheduled_for else None,
        "rating": review.rating if review else None,
        "alerts": order_alerts(order, now),
    }


def parse_page(request, default_size=15):
    try:
        page = max(int(request.query_params.get("page", 1)), 1)
    except ValueError:
        page = 1
    try:
        size = min(max(int(request.query_params.get("page_size", default_size)), 1), MAX_PAGE_SIZE)
    except ValueError:
        size = default_size
    return page, size


class AdminHiringListView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        params = request.query_params
        now = timezone.now()
        qs = base_queryset()
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("payment") in ("paid", "pending", "refunded"):
            qs = qs.filter(payment_status=params["payment"])
        if params.get("city"):
            qs = qs.filter(service_request__household__city__icontains=params["city"])
        if params.get("professional", "").isdigit():
            qs = qs.filter(professional_id=int(params["professional"]))
        if params.get("date_from"):
            qs = qs.filter(created_at__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(created_at__date__lte=params["date_to"])
        alerts = alert_filters(now)
        if params.get("alert") in alerts:
            qs = qs.filter(alerts[params["alert"]])
        q = (params.get("q") or "").strip()
        if q:
            condition = (
                Q(client__email__icontains=q) | Q(client__first_name__icontains=q) | Q(client__last_name__icontains=q)
                | Q(professional__display_name__icontains=q)
                | Q(service_request__selected_service__name__icontains=q)
                | Q(service_request__selected_category__name__icontains=q)
                | Q(service_request__household__neighborhood__icontains=q)
            )
            if q.lstrip("#").isdigit():
                condition |= Q(pk=int(q.lstrip("#")))
            qs = qs.filter(condition)
        ordering = params.get("ordering", "-created_at")
        qs = qs.order_by(ordering if ordering in ("created_at", "-created_at", "final_price", "-final_price") else "-created_at")

        page, size = parse_page(request)
        total = qs.count()
        start = (page - 1) * size
        return Response(
            {
                "count": total, "page": page, "page_size": size,
                "results": [row(order, now) for order in qs[start:start + size]],
            }
        )


def month_buckets(months=6):
    today = timezone.localdate()
    year, month = today.year, today.month
    buckets = []
    for _ in range(months):
        buckets.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(buckets))


class AdminHiringSummaryView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request):
        now = timezone.now()
        orders = Order.objects.all()
        by_status = dict(orders.values_list("status").annotate(c=Count("id")))
        billable = orders.exclude(status=Order.Status.CANCELLED).filter(final_price__isnull=False)
        value = billable.aggregate(total=Sum("final_price"), avg=Avg("final_price"))

        since = (now - timedelta(days=29)).date()
        per_day = dict(
            orders.filter(created_at__date__gte=since)
            .annotate(day=TruncDate("created_at")).values_list("day").annotate(c=Count("id"))
        )
        daily = [
            {"date": (since + timedelta(days=i)).isoformat(), "count": per_day.get(since + timedelta(days=i), 0)}
            for i in range(30)
        ]
        per_month = {
            (d.year, d.month): c
            for d, c in orders.annotate(m=TruncMonth("created_at")).values_list("m").annotate(c=Count("id"))
            if d
        }
        monthly = [{"month": f"{y}-{m:02d}", "count": per_month.get((y, m), 0)} for y, m in month_buckets()]

        top_services = [
            {"name": name or "Sin servicio", "count": count}
            for name, count in orders.values_list("service_request__selected_service__name")
            .annotate(c=Count("id")).order_by("-c")[:5]
        ]
        top_professionals = [
            {"id": pid, "name": name, "count": count, "rating": round(avg, 2) if avg else None}
            for pid, name, count, avg in orders.values_list("professional_id", "professional__display_name")
            .annotate(c=Count("id"), r=Avg("review__rating")).order_by("-c")
            .values_list("professional_id", "professional__display_name", "c", "r")[:5]
        ]

        filters = alert_filters(now)
        alerts = [
            {"key": key, "label": ALERT_LABELS[key], "count": orders.filter(cond).count()}
            for key, cond in filters.items()
        ]
        open_requests = ServiceRequest.objects.filter(status=ServiceRequest.Status.OPEN, orders__isnull=True)
        no_professional = open_requests.filter(professional__isnull=True).count()
        awaiting = open_requests.filter(professional__isnull=False)
        stale_awaiting = awaiting.filter(created_at__lt=now - timedelta(hours=24)).count()

        return Response(
            {
                "total": orders.count(),
                "by_status": by_status,
                "active": orders.filter(status__in=ACTIVE).count(),
                "completed": by_status.get(Order.Status.COMPLETED, 0),
                "cancelled": by_status.get(Order.Status.CANCELLED, 0),
                "value_total": float(value["total"] or 0),
                "avg_ticket": float(value["avg"] or 0),
                "daily": daily,
                "monthly": monthly,
                "top_services": top_services,
                "top_professionals": top_professionals,
                "alerts": [a for a in alerts if a["count"] > 0],
                "requests": {
                    "no_professional": no_professional,
                    "awaiting": awaiting.count(),
                    "awaiting_stale": stale_awaiting,
                },
                "generated_at": now.isoformat(),
            }
        )


class AdminHiringDetailView(APIView):
    permission_classes = [IsPlatformStaff]

    def get(self, request, pk):
        order = base_queryset().filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Contratación no encontrada."}, status=http.HTTP_404_NOT_FOUND)
        now = timezone.now()
        data = row(order, now)
        service_request = order.service_request
        household = service_request.household
        review = getattr(order, "review", None)
        data.update(
            {
                "description": service_request.description,
                "client_notes": order.client_notes,
                "urgency": service_request.get_urgency_display(),
                "address": ", ".join(p for p in (household.address_line, household.neighborhood, household.city) if p),
                "estimate_min": float(order.estimate_min) if order.estimate_min is not None else None,
                "estimate_max": float(order.estimate_max) if order.estimate_max is not None else None,
                "payment_reference": order.payment_reference,
                "payment_confirmed_at": order.payment_confirmed_at.isoformat() if order.payment_confirmed_at else None,
                "commission_amount": float(order.commission_amount) if order.commission_amount is not None else None,
                "professional_amount": float(order.professional_amount) if order.professional_amount is not None else None,
                "payout_settled_at": order.payout_settled_at.isoformat() if order.payout_settled_at else None,
                "professional_detail": {
                    "email": order.professional.user.email if order.professional.user_id else "",
                    "phone": order.professional.user.phone if order.professional.user_id else "",
                    "rating": float(order.professional.rating_avg or 0),
                    "jobs_completed": order.professional.jobs_completed,
                    "verified": order.professional.is_verified,
                },
                "review": {"rating": review.rating, "comment": review.comment} if review else None,
                "events": [
                    {
                        "status": e.status, "label": e.get_status_display(), "note": e.note,
                        "by": person(e.created_by) if e.created_by_id else "Sistema",
                        "created_at": e.created_at.isoformat(),
                    }
                    for e in order.events.select_related("created_by")
                ],
                "evidence": [
                    {"id": e.id, "caption": e.caption, "created_at": e.created_at.isoformat(),
                     "url": f"/api/v1/orders/{order.id}/evidence/{e.id}/"}
                    for e in order.work_evidence.all()
                ],
                "payments": [
                    {
                        "id": p.id, "reference": p.reference, "status": p.status, "status_label": p.get_status_display(),
                        "amount": p.amount_in_cents / 100, "discount": float(p.discount_amount),
                        "method": method_label(p.payment_method), "created_at": p.created_at.isoformat(),
                    }
                    for p in order.payments.all()
                ],
                "notes": [
                    {"id": n.id, "text": n.text, "author": n.author_name, "created_at": n.created_at.isoformat()}
                    for n in order.admin_notes.all()
                ],
                "can_cancel": order.status in ACTIVE and order.payment_status == Order.PaymentStatus.PENDING,
                "cancel_blocked_reason": (
                    "La orden tiene un pago confirmado: gestiona primero el reembolso en Pagos e ingresos."
                    if order.status in ACTIVE and order.payment_status != Order.PaymentStatus.PENDING else ""
                ),
                "can_settle": (
                    order.payment_status == Order.PaymentStatus.PAID and order.status == Order.Status.COMPLETED
                    and order.payout_status == Order.PayoutStatus.PENDING
                ),
            }
        )
        return Response(data)


class AdminHiringCancelView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        order = Order.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Contratación no encontrada."}, status=http.HTTP_404_NOT_FOUND)
        reason = str(request.data.get("reason") or "").strip()
        if len(reason) < 5:
            return Response({"detail": "Indica el motivo de la cancelación (mínimo 5 caracteres)."}, status=400)
        if order.payment_status != Order.PaymentStatus.PENDING:
            return Response(
                {"detail": "La orden tiene un pago confirmado: gestiona primero el reembolso en Pagos e ingresos."},
                status=400,
            )
        try:
            transition(order, Order.Status.CANCELLED, user=request.user, note=f"Cancelada por administración: {reason}"[:200])
        except InvalidTransition as exc:
            return Response({"detail": str(exc)}, status=400)
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=http.HTTP_403_FORBIDDEN)
        _audit(request, "Contratación cancelada", f"Orden #{order.id}", reason)
        return Response({"detail": "Contratación cancelada.", "id": order.id})


class AdminHiringNoteView(APIView):
    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        order = Order.objects.filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Contratación no encontrada."}, status=http.HTTP_404_NOT_FOUND)
        text = str(request.data.get("text") or "").strip()
        if len(text) < 3:
            return Response({"detail": "Escribe la nota (mínimo 3 caracteres)."}, status=400)
        note = OrderAdminNote.objects.create(
            order=order, author=request.user, author_name=person(request.user), text=text[:1000]
        )
        return Response(
            {"id": note.id, "text": note.text, "author": note.author_name, "created_at": note.created_at.isoformat()},
            status=http.HTTP_201_CREATED,
        )


class AdminHiringPqrView(APIView):
    """Abre un PQR a partir de una contratación, con los datos del cliente y del profesional."""

    permission_classes = [IsPlatformStaff]

    def post(self, request, pk):
        order = base_queryset().filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Contratación no encontrada."}, status=http.HTTP_404_NOT_FOUND)
        kind = request.data.get("type")
        if kind not in ("queja", "reclamo", "peticion"):
            return Response({"detail": "Elige el tipo: queja, reclamo o petición."}, status=400)
        description = str(request.data.get("description") or "").strip()
        if len(description) < 10:
            return Response({"detail": "Describe el caso (mínimo 10 caracteres)."}, status=400)
        profile = order.professional
        client = order.client
        household = order.service_request.household
        year = timezone.now().year
        radicado = f"PQR-ADM-{year}-{random.randint(1000, 9999)}"
        while PQRReport.objects.filter(radicado_number=radicado).exists():
            radicado = f"PQR-ADM-{year}-{random.randint(1000, 9999)}"
        pqr = PQRReport.objects.create(
            radicado_number=radicado, client=client, client_name=person(client), client_phone=client.phone,
            client_email=client.email, client_document_id=client.document_id, client_address=household.address_line,
            contractor=profile, contractor_id_ref=str(profile.id), contractor_name=profile.display_name,
            contractor_company=profile.display_name, contractor_specialty=service_name(order), contractor_avatar="",
            pqr_type=kind, reason="contratacion_admin", related_to=f"Contratación #{order.id}",
            description=description[:2000],
        )
        _audit(request, "PQR abierto desde una contratación", f"Orden #{order.id} → {radicado}")
        return Response({"id": pqr.id, "radicado_number": radicado}, status=http.HTTP_201_CREATED)


def haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * radius * math.asin(math.sqrt(a)), 1)


def open_requests_queryset():
    return ServiceRequest.objects.filter(status=ServiceRequest.Status.OPEN, orders__isnull=True).select_related(
        "client", "household", "selected_service", "selected_category", "professional",
    )


class AdminHiringRequestsView(APIView):
    """Solicitudes abiertas que todavía no se convirtieron en contratación."""

    permission_classes = [IsPlatformStaff]

    def get(self, request):
        qs = open_requests_queryset().order_by("created_at")
        kind = request.query_params.get("kind")
        if kind == "no_professional":
            qs = qs.filter(professional__isnull=True)
        elif kind == "awaiting":
            qs = qs.filter(professional__isnull=False)
        now = timezone.now()
        page, size = parse_page(request)
        total = qs.count()
        start = (page - 1) * size
        results = []
        for r in qs[start:start + size]:
            results.append(
                {
                    "id": r.id,
                    "created_at": r.created_at.isoformat(),
                    "hours_waiting": int((now - r.created_at).total_seconds() // 3600),
                    "client": {"name": person(r.client), "email": r.client.email, "phone": r.client.phone},
                    "service": r.selected_service.name if r.selected_service_id else r.selected_category.name,
                    "category": r.selected_category.name,
                    "city": r.household.city,
                    "neighborhood": r.household.neighborhood,
                    "urgency": r.urgency,
                    "urgency_label": r.get_urgency_display(),
                    "description": r.description,
                    "professional": (
                        {"id": r.professional_id, "name": r.professional.display_name} if r.professional_id else None
                    ),
                }
            )
        return Response({"count": total, "page": page, "page_size": size, "results": results})


class AdminHiringProfessionalsView(APIView):
    """Profesionales que ofrecen el servicio de una solicitud, del más cercano al más lejano."""

    permission_classes = [IsPlatformStaff]

    def get(self, request, request_id):
        service_request = open_requests_queryset().filter(pk=request_id).first()
        if service_request is None:
            return Response({"detail": "Solicitud no encontrada o ya contratada."}, status=http.HTTP_404_NOT_FOUND)
        household = service_request.household
        profiles = (
            ProfessionalProfile.objects.filter(
                is_active=True, services__service_id=service_request.selected_service_id,
                services__service__is_active=True, services__service__category__is_active=True,
            )
            .exclude(user_id=service_request.client_id).select_related("user").distinct()
        )
        results = []
        for p in profiles:
            results.append(
                {
                    "id": p.id, "name": p.display_name, "rating": float(p.rating_avg or 0),
                    "jobs_completed": p.jobs_completed, "verified": p.is_verified, "city": p.city,
                    "distance_km": haversine_km(household.latitude, household.longitude, p.latitude, p.longitude),
                    "current": p.id == service_request.professional_id,
                }
            )
        results.sort(key=lambda item: (item["distance_km"] is None, item["distance_km"] or 0, -item["rating"]))
        return Response(results[:30])


class AdminHiringAssignView(APIView):
    """Dirige una solicitud abierta a un profesional; él la acepta desde Mis solicitudes."""

    permission_classes = [IsPlatformStaff]

    def post(self, request, request_id):
        service_request = open_requests_queryset().filter(pk=request_id).first()
        if service_request is None:
            return Response({"detail": "Solicitud no encontrada o ya contratada."}, status=http.HTTP_404_NOT_FOUND)
        professional_id = request.data.get("professional_id")
        profile = ProfessionalProfile.objects.select_related("user").filter(pk=professional_id, is_active=True).first() \
            if str(professional_id).isdigit() else None
        if profile is None:
            return Response({"detail": "Profesional no encontrado o inactivo."}, status=400)
        if profile.user_id == service_request.client_id:
            return Response({"detail": "El cliente no puede ser el profesional de su propia solicitud."}, status=400)
        if not professional_offers_service(profile, service_request.selected_service_id):
            return Response({"detail": "Ese profesional no ofrece este servicio."}, status=400)

        previous = service_request.professional.display_name if service_request.professional_id else "sin profesional"
        service_request.professional = profile
        service_request.save(update_fields=["professional", "updated_at"])
        household = service_request.household
        RequestCandidate.objects.update_or_create(
            request=service_request, professional=profile,
            defaults={
                "distance_km": haversine_km(household.latitude, household.longitude, profile.latitude, profile.longitude) or 0,
                "status": RequestCandidate.Status.CONTACTED,
            },
        )
        if profile.user_id:
            Notification.objects.create(
                user=profile.user, title="Nueva solicitud asignada",
                text=f"Serviprox te asignó la solicitud #{service_request.id}. Revísala y respóndela.",
                notification_type=Notification.NotificationType.SISTEMA,
                link=f"/profesional/solicitudes/{service_request.id}", target_id=str(service_request.id),
            )
        _audit(request, "Solicitud asignada a un profesional", f"Solicitud #{service_request.id}",
               f"{previous} → {profile.display_name}")
        return Response({"detail": f"Solicitud asignada a {profile.display_name}.", "id": service_request.id})
