from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0004_appproblemreport_user_email"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppProblemAttachment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "file",
                    models.FileField(upload_to="app-problem-evidence/%Y/%m/"),
                ),
                ("original_name", models.CharField(max_length=255)),
                ("content_type", models.CharField(blank=True, default="", max_length=150)),
                ("size_bytes", models.PositiveBigIntegerField(default=0)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "problem",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="pqrs.appproblemreport",
                    ),
                ),
            ],
            options={"ordering": ["uploaded_at", "id"]},
        ),
    ]