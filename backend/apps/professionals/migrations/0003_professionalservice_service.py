from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    ProfessionalService = apps.get_model("professionals", "ProfessionalService")
    Service = apps.get_model("catalog", "Service")

    for professional_service in list(ProfessionalService.objects.select_related("category")):
        services = list(
            Service.objects.filter(
                category_id=professional_service.category_id,
                is_active=True,
            ).order_by("name", "id")
        )
        if not services:
            raise RuntimeError(
                "No se puede migrar ProfessionalService a Service: "
                f"la categoria {professional_service.category_id} no tiene servicios."
            )

        first_service = services[0]
        professional_service.service_id = first_service.id
        professional_service.save(update_fields=["service"])

        for service in services[1:]:
            ProfessionalService.objects.get_or_create(
                profile_id=professional_service.profile_id,
                service_id=service.id,
                defaults={
                    "category_id": professional_service.category_id,
                    "price_min": service.price_min,
                    "price_max": service.price_max,
                    "years_experience": professional_service.years_experience,
                },
            )


def backwards(apps, schema_editor):
    ProfessionalService = apps.get_model("professionals", "ProfessionalService")

    seen = set()
    for professional_service in list(
        ProfessionalService.objects.select_related("service__category").order_by("id")
    ):
        category_id = professional_service.service.category_id
        key = (professional_service.profile_id, category_id)
        if key in seen:
            professional_service.delete()
            continue
        seen.add(key)
        professional_service.category_id = category_id
        professional_service.save(update_fields=["category"])


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("catalog", "0001_initial"),
        ("professionals", "0002_alter_professionalprofile_latitude_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="professionalservice",
            name="service",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="professional_services",
                to="catalog.service",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="professionalservice",
            name="unique_category_per_professional",
        ),
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="professionalservice",
            name="service",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="professional_services",
                to="catalog.service",
            ),
        ),
        migrations.RemoveField(
            model_name="professionalservice",
            name="category",
        ),
        migrations.AddConstraint(
            model_name="professionalservice",
            constraint=models.UniqueConstraint(
                fields=("profile", "service"),
                name="unique_service_per_professional",
            ),
        ),
    ]
