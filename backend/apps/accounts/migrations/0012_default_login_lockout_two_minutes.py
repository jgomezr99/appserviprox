from django.db import migrations


def set_two_minute_lockout(apps, schema_editor):
    settings_model = apps.get_model("accounts", "PlatformSettings")
    for row in settings_model.objects.all().iterator():
        data = row.data
        if not isinstance(data, dict):
            continue
        sections = data.get("sections")
        if not isinstance(sections, dict):
            continue
        security = sections.get("security")
        if not isinstance(security, dict) or security.get("lock") != "30 minutos":
            continue

        data = {**data, "sections": {**sections, "security": {**security, "lock": "2 minutos"}}}
        settings_model.objects.filter(pk=row.pk).update(data=data)


def restore_thirty_minute_lockout(apps, schema_editor):
    settings_model = apps.get_model("accounts", "PlatformSettings")
    for row in settings_model.objects.all().iterator():
        data = row.data
        if not isinstance(data, dict):
            continue
        sections = data.get("sections")
        if not isinstance(sections, dict):
            continue
        security = sections.get("security")
        if not isinstance(security, dict) or security.get("lock") != "2 minutos":
            continue

        data = {**data, "sections": {**sections, "security": {**security, "lock": "30 minutos"}}}
        settings_model.objects.filter(pk=row.pk).update(data=data)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0011_platformsettings"),
    ]

    operations = [
        migrations.RunPython(set_two_minute_lockout, restore_thirty_minute_lockout),
    ]
