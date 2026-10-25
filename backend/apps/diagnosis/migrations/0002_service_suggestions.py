import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_default_service_keywords"),
        ("diagnosis", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="diagnosticsession",
            name="service_ranking",
            field=models.JSONField(
                blank=True, default=list, verbose_name="ranking de servicios"
            ),
        ),
        migrations.AddField(
            model_name="diagnosticsession",
            name="suggested_service",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="diagnostic_suggestions",
                to="catalog.service",
                verbose_name="servicio sugerido",
            ),
        ),
    ]
