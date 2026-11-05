from django.db import migrations


def reconcile_premature_orders(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Event = apps.get_model("orders", "OrderEvent")
    Request = apps.get_model("service_requests", "ServiceRequest")
    alias = schema_editor.connection.alias
    # El endpoint antiguo de órdenes dejaba solicitudes matched sin destinatario.
    for order in Order.objects.using(alias).filter(status="requested", service_request__status="matched").select_related("service_request"):
        request = order.service_request
        if request.professional_id not in {None, order.professional_id}:
            continue
        if Order.objects.using(alias).filter(service_request_id=request.pk).count() != 1:
            continue
        Request.objects.using(alias).filter(pk=request.pk, status="matched").update(status="open", professional_id=order.professional_id)
    # Solo órdenes generadas por el bug conocido y sin avances reales posteriores.
    orders = Order.objects.using(alias).filter(
        status="traveling",
        events__note="Solicitud enviada al profesional. En camino a la ubicación del cliente.",
    ).select_related("professional", "service_request").distinct()
    for order in orders.iterator():
        events = Event.objects.using(alias).filter(order_id=order.pk)
        if events.exclude(status__in=["requested", "traveling"]).exists():
            continue
        if events.filter(created_by_id=order.professional.user_id).exists():
            continue
        request_status = order.service_request.status
        target = {"open": "requested", "accepted": "accepted", "rejected": "cancelled", "cancelled": "cancelled"}.get(request_status)
        if target is None:
            continue
        Order.objects.using(alias).filter(pk=order.pk).update(status=target)
        Event.objects.using(alias).create(
            order_id=order.pk, status=target,
            note="Estado corregido: el envío de la solicitud no inicia el desplazamiento.",
        )


class Migration(migrations.Migration):
    dependencies = [("orders", "0005_payment"), ("service_requests", "0002_direct_service_request")]
    operations = [migrations.RunPython(reconcile_premature_orders, migrations.RunPython.noop)]
