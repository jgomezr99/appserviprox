from django.db import migrations

from apps.professionals.geo import city_center


def locate_professionals_without_gps(apps, schema_editor):
    Profile = apps.get_model("professionals", "ProfessionalProfile")
    for profile in Profile.objects.filter(latitude__isnull=True) | Profile.objects.filter(longitude__isnull=True):
        center = city_center(profile.city)
        if center:
            Profile.objects.filter(pk=profile.pk).update(latitude=center[0], longitude=center[1])


class Migration(migrations.Migration):

    dependencies = [
        ("professionals", "0008_benefitredemption"),
    ]

    operations = [
        migrations.RunPython(locate_professionals_without_gps, migrations.RunPython.noop),
    ]
