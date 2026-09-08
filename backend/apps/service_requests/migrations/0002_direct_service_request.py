import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
        ("professionals", "0003_professionalservice_service"),
        ("service_requests", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicerequest",
            name="professional",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="direct_requests",
                to="professionals.professionalprofile",
                verbose_name="profesional destinatario",
            ),
        ),
        migrations.AddField(
            model_name="servicerequest",
            name="selected_service",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="requests_selected",
                to="catalog.service",
                verbose_name="servicio confirmado por el cliente",
            ),
        ),
        migrations.AlterField(
            model_name="servicerequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Borrador"),
                    ("open", "Publicada"),
                    ("matched", "Con profesional asignado"),
                    ("accepted", "Aceptada"),
                    ("rejected", "Rechazada"),
                    ("closed", "Cerrada"),
                    ("cancelled", "Cancelada"),
                ],
                default="open",
                max_length=20,
            ),
        ),
    ]
