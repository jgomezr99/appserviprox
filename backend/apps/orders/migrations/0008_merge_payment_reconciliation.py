from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0006_reconcile_premature_orders"),
        ("orders", "0007_backfill_payments"),
    ]

    operations = []
