import decimal

import django.db.models.deletion
from django.db import migrations, models
from django.utils.translation import gettext_lazy as _


class Migration(migrations.Migration):

    dependencies = [
        ("professionals", "0007_certificate"),
    ]

    operations = [
        migrations.CreateModel(
            name="BenefitRedemption",
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
                ("benefit_id", models.CharField(max_length=100)),
                ("title", models.CharField(max_length=180)),
                ("points", models.PositiveIntegerField()),
                (
                    "recharge_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", _("Pendiente")),
                            ("fulfilled", _("Entregado")),
                            ("cancelled", _("Cancelado")),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="benefit_redemptions",
                        to="professionals.professionalprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
