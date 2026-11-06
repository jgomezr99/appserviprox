from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0005_appproblemattachment"),
    ]

    operations = [
        migrations.AddField(
            model_name="pqrreport",
            name="priority",
            field=models.CharField(
                blank=True,
                choices=[("", "Sin prioridad"), ("Alta", "Alta"), ("Media", "Media"), ("Baja", "Baja")],
                default="",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="pqrreport",
            name="assigned_to",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="pqrreport",
            name="related_to",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="appproblemreport",
            name="title",
            field=models.CharField(blank=True, default="", max_length=180),
        ),
        migrations.AddField(
            model_name="appproblemreport",
            name="priority",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Sin prioridad"),
                    ("Crítica", "Crítica"),
                    ("Alta", "Alta"),
                    ("Media", "Media"),
                    ("Baja", "Baja"),
                ],
                default="",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="appproblemreport",
            name="assigned_to",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="appproblemreport",
            name="version",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
