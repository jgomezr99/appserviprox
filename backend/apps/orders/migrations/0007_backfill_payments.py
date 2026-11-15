from django.db import migrations


def backfill_payments(apps, schema_editor):
    """Crea el Payment aprobado de órdenes pagadas antes del historial de pagos."""
    Order = apps.get_model("orders", "Order")
    Payment = apps.get_model("orders", "Payment")
    for order in Order.objects.filter(payment_status="paid").exclude(payments__status="approved"):
        price = order.final_price or order.estimate_max or order.estimate_min
        if not price:
            continue
        reference = order.payment_reference or f"DEV-{order.pk}"
        if Payment.objects.filter(reference=reference).exists():
            reference = f"DEV-{order.pk}-{order.created_at:%Y%m%d%H%M%S}"
        payment = Payment.objects.create(
            order=order,
            client_id=order.client_id,
            reference=reference,
            amount_in_cents=int(price * 100),
            status="approved",
            payment_method="DEV",
        )
        if order.payment_confirmed_at:
            Payment.objects.filter(pk=payment.pk).update(created_at=order.payment_confirmed_at)


class Migration(migrations.Migration):
    dependencies = [("orders", "0006_finance")]

    operations = [migrations.RunPython(backfill_payments, migrations.RunPython.noop)]
