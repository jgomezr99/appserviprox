from django.db import migrations, models


def fill_arrival_codes(apps, schema_editor):
    import secrets
    Order = apps.get_model("orders", "Order")
    for order in Order.objects.filter(arrival_code=""):
        order.arrival_code = str(secrets.randbelow(9000) + 1000)
        order.save(update_fields=["arrival_code"])


class Migration(migrations.Migration):
    dependencies = [("orders", "0002_order_payment_confirmed_at_order_payment_reference_and_more")]
    operations = [
        migrations.AddField(model_name="order", name="arrival_code", field=models.CharField(blank=True, max_length=8, unique=True)),
        migrations.AddField(model_name="order", name="professional_latitude", field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
        migrations.AddField(model_name="order", name="professional_longitude", field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
        migrations.RunPython(fill_arrival_codes, migrations.RunPython.noop),
        migrations.CreateModel(
            name="WorkEvidence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="work-evidence/%Y/%m/")),
                ("caption", models.CharField(blank=True, max_length=160)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("order", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="work_evidence", to="orders.order")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]