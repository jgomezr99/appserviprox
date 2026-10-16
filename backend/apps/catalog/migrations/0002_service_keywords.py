from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="keywords",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Terminos y sinonimos para encontrar este servicio en la busqueda orientada.",
                verbose_name="palabras clave",
            ),
        ),
    ]
